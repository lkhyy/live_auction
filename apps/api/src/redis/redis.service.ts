import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { AuctionRuleSnapshot } from '@live-auction/shared';
import { PLACE_BID_SCRIPT, type LuaBidResult } from './place-bid.script';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  private placeBidSha: string | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private static readonly VIEWER_STALE_MS = 60_000;

  private keys(auctionId: string) {
    return {
      state: `auction:${auctionId}:state`,
      bids: `auction:${auctionId}:bids`,
      seq: `auction:${auctionId}:seq`,
      rateLimit: (userId: string) => `auction:${auctionId}:rl:${userId}`,
      viewerUsers: `auction:${auctionId}:viewerUsers`,
      viewerSockets: `auction:${auctionId}:viewerSockets`,
    };
  }

  private parseViewerEntry(raw: string): { socketId: string; lastSeenMs: number } | null {
    try {
      const parsed = JSON.parse(raw) as { socketId: string; lastSeenMs: number };
      if (typeof parsed.socketId === 'string' && typeof parsed.lastSeenMs === 'number') {
        return parsed;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private async pruneStaleViewers(scopeId: string): Promise<void> {
    const k = this.keys(scopeId);
    const all = await this.redis.hgetall(k.viewerUsers);
    const cutoff = Date.now() - RedisService.VIEWER_STALE_MS;
    for (const [viewerKey, raw] of Object.entries(all)) {
      const entry = this.parseViewerEntry(raw);
      if (!entry || entry.lastSeenMs < cutoff) {
        await this.redis.hdel(k.viewerUsers, viewerKey);
        if (entry?.socketId) {
          await this.redis.hdel(k.viewerSockets, entry.socketId);
        }
      }
    }
  }

  async loadScripts(): Promise<void> {
    this.placeBidSha = (await this.redis.script('LOAD', PLACE_BID_SCRIPT)) as string;
  }

  async initAuctionState(
    auctionId: string,
    rules: AuctionRuleSnapshot,
    endAtMs: number,
  ): Promise<void> {
    const k = this.keys(auctionId);
    const pipeline = this.redis.pipeline();
    pipeline.del(k.state, k.bids, k.seq, this.bidLogKey(auctionId), this.anomalyCodesKey(auctionId));
    const startPrice = rules.startPrice ?? 0;
    pipeline.hset(k.state, {
      status: 'LIVE',
      startPrice,
      currentPrice: startPrice,
      leaderId: '',
      leaderDisplayName: '',
      previousLeaderId: '',
      endAt: endAtMs,
      version: 0,
      totalExtendedMs: 0,
      minIncrement: rules.minIncrement,
      capPrice: rules.capPrice ?? '',
    });
    pipeline.set(k.seq, 0);
    await pipeline.exec();
  }

  async getState(auctionId: string): Promise<Record<string, string>> {
    return this.redis.hgetall(this.keys(auctionId).state);
  }

  async placeBid(params: {
    auctionId: string;
    userId: string;
    displayName: string;
    amount: number;
    rules: AuctionRuleSnapshot;
    expectedVersion?: number;
  }): Promise<LuaBidResult> {
    const k = this.keys(params.auctionId);
    const state = await this.getState(params.auctionId);
    const nowMs = Date.now();
    const totalExtendedMs = Number(state.totalExtendedMs ?? 0);
    const soft = params.rules.softClose;

    const argv = [
      params.userId,
      params.displayName,
      String(params.amount),
      String(nowMs),
      String(params.rules.minIncrement),
      params.rules.capPrice != null ? String(params.rules.capPrice) : '',
      soft.enabled ? '1' : '0',
      String(soft.extensionSeconds),
      String(soft.triggerWindowSeconds),
      String(soft.maxTotalExtensionSeconds),
      String(params.expectedVersion ?? -1),
      String(totalExtendedMs),
    ];

    let raw: string;
    if (this.placeBidSha) {
      try {
        raw = (await this.redis.evalsha(
          this.placeBidSha,
          3,
          k.state,
          k.bids,
          k.seq,
          ...argv,
        )) as string;
      } catch {
        this.placeBidSha = (await this.redis.script('LOAD', PLACE_BID_SCRIPT)) as string;
        raw = (await this.redis.evalsha(
          this.placeBidSha,
          3,
          k.state,
          k.bids,
          k.seq,
          ...argv,
        )) as string;
      }
    } else {
      raw = (await this.redis.eval(
        PLACE_BID_SCRIPT,
        3,
        k.state,
        k.bids,
        k.seq,
        ...argv,
      )) as string;
    }

    return JSON.parse(raw) as LuaBidResult;
  }

  async checkRateLimit(
    auctionId: string,
    userId: string,
    limit: number,
    windowMs: number,
  ): Promise<boolean> {
    const key = this.keys(auctionId).rateLimit(userId);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, windowMs);
    }
    return count <= limit;
  }

  async getLeaderboard(
    auctionId: string,
    limit = 20,
  ): Promise<Array<{ userId: string; displayName: string; amount: number; rank: number }>> {
    const raw = await this.redis.zrevrange(
      this.keys(auctionId).bids,
      0,
      limit - 1,
      'WITHSCORES',
    );
    const result: Array<{ userId: string; displayName: string; amount: number; rank: number }> =
      [];
    for (let i = 0; i < raw.length; i += 2) {
      const member = raw[i];
      const amount = Number(raw[i + 1]);
      const colon = member.indexOf(':');
      const userId = colon >= 0 ? member.slice(0, colon) : member;
      const displayName = colon >= 0 ? member.slice(colon + 1) : '';
      result.push({ userId, displayName, amount, rank: result.length + 1 });
    }
    return result;
  }

  async setStatus(auctionId: string, status: string, extra?: Record<string, string>) {
    const k = this.keys(auctionId).state;
    await this.redis.hset(k, { status, ...extra });
  }

  priceAlertKey(auctionId: string) {
    return `auction:${auctionId}:priceAlertSent`;
  }

  bidLogKey(auctionId: string) {
    return `auction:${auctionId}:bidLog`;
  }

  anomalyCodesKey(auctionId: string) {
    return `auction:${auctionId}:anomalyCodes`;
  }

  async getBidCount(auctionId: string): Promise<number> {
    return this.redis.zcard(this.keys(auctionId).bids);
  }

  async appendBidLog(
    auctionId: string,
    entry: {
      userId: string;
      amount: number;
      prevPrice: number;
      atMs: number;
      endAtMs: number;
    },
  ): Promise<void> {
    const key = this.bidLogKey(auctionId);
    await this.redis.lpush(key, JSON.stringify(entry));
    await this.redis.ltrim(key, 0, 99);
  }

  async getBidLog(auctionId: string, limit = 50): Promise<
    Array<{
      userId: string;
      amount: number;
      prevPrice: number;
      atMs: number;
      endAtMs: number;
    }>
  > {
    const raw = await this.redis.lrange(this.bidLogKey(auctionId), 0, limit - 1);
    return raw
      .map((s) => JSON.parse(s) as {
        userId: string;
        amount: number;
        prevPrice: number;
        atMs: number;
        endAtMs: number;
      })
      .reverse();
  }

  /** 返回本次新触发的异常 code（已触发过的不再返回） */
  async markAnomalyCodes(auctionId: string, codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const key = this.anomalyCodesKey(auctionId);
    const added: string[] = [];
    for (const code of codes) {
      const n = await this.redis.sadd(key, code);
      if (n === 1) added.push(code);
    }
    return added;
  }

  async isPriceAlertSent(auctionId: string): Promise<boolean> {
    const flagged = (await this.redis.get(this.priceAlertKey(auctionId))) === '1';
    if (flagged) return true;
    return (await this.redis.scard(this.anomalyCodesKey(auctionId))) > 0;
  }

  async markPriceAlertSent(auctionId: string): Promise<void> {
    await this.redis.set(this.priceAlertKey(auctionId), '1');
  }

  async clearAuction(auctionId: string) {
    const k = this.keys(auctionId);
    await this.redis.del(
      k.state,
      k.bids,
      k.seq,
      k.viewerUsers,
      k.viewerSockets,
      this.bidLogKey(auctionId),
      this.anomalyCodesKey(auctionId),
      this.priceAlertKey(auctionId),
      `auction:${auctionId}:viewers`,
    );
  }

  async addViewer(scopeId: string, socketId: string, viewerKey: string) {
    await this.pruneStaleViewers(scopeId);
    const k = this.keys(scopeId);
    const now = Date.now();

    const existingRaw = await this.redis.hget(k.viewerUsers, viewerKey);
    if (existingRaw) {
      const existing = this.parseViewerEntry(existingRaw);
      if (existing && existing.socketId !== socketId) {
        await this.redis.hdel(k.viewerSockets, existing.socketId);
      }
    }

    await this.redis.hset(
      k.viewerUsers,
      viewerKey,
      JSON.stringify({ socketId, lastSeenMs: now }),
    );
    await this.redis.hset(k.viewerSockets, socketId, viewerKey);
    await this.redis.expire(k.viewerUsers, 120);
    await this.redis.expire(k.viewerSockets, 120);
  }

  async removeViewer(scopeId: string, socketId: string) {
    const k = this.keys(scopeId);
    const viewerKey = await this.redis.hget(k.viewerSockets, socketId);
    if (!viewerKey) return;

    const raw = await this.redis.hget(k.viewerUsers, viewerKey);
    if (raw) {
      const entry = this.parseViewerEntry(raw);
      if (entry?.socketId === socketId) {
        await this.redis.hdel(k.viewerUsers, viewerKey);
      }
    }
    await this.redis.hdel(k.viewerSockets, socketId);
  }

  async getParticipantCount(scopeId: string): Promise<number> {
    await this.pruneStaleViewers(scopeId);
    return this.redis.hlen(this.keys(scopeId).viewerUsers);
  }

  getClient(): Redis {
    return this.redis;
  }
}
