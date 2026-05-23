import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { AuctionRuleSnapshot } from '@live-auction/shared';
import { PLACE_BID_SCRIPT, type LuaBidResult } from './place-bid.script';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  private placeBidSha: string | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private keys(auctionId: string) {
    return {
      state: `auction:${auctionId}:state`,
      bids: `auction:${auctionId}:bids`,
      seq: `auction:${auctionId}:seq`,
      rateLimit: (userId: string) => `auction:${auctionId}:rl:${userId}`,
      viewers: `auction:${auctionId}:viewers`,
    };
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
    pipeline.del(k.state, k.bids, k.seq);
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

  async clearAuction(auctionId: string) {
    const k = this.keys(auctionId);
    await this.redis.del(k.state, k.bids, k.seq, k.viewers);
  }

  async addViewer(auctionId: string, clientId: string) {
    await this.redis.sadd(this.keys(auctionId).viewers, clientId);
  }

  async removeViewer(auctionId: string, clientId: string) {
    await this.redis.srem(this.keys(auctionId).viewers, clientId);
  }

  async getParticipantCount(auctionId: string): Promise<number> {
    return this.redis.scard(this.keys(auctionId).viewers);
  }

  getClient(): Redis {
    return this.redis;
  }
}
