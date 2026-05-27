import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { AuctionStatus, AuctionEventType } from '@prisma/client';
import {
  type AuctionSnapshot,
  type AuctionRuleSnapshot,
  type SettleReason,
} from '@live-auction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { OrderService } from '../order/order.service';
import { LiveRoomService } from '../live-room/live-room.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
    private readonly orders: OrderService,
    @Inject(forwardRef(() => LiveRoomService))
    private readonly liveRooms: LiveRoomService,
  ) {}

  async buildSnapshot(auctionId: string): Promise<AuctionSnapshot> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { winner: { select: { displayName: true } } },
    });
    if (!auction) throw new Error('Auction not found');

    const state = await this.redis.getState(auctionId);
    const leaderboard = await this.enrichLeaderboard(
      await this.redis.getLeaderboard(auctionId),
    );
    const rules = auction.ruleSnapshot as {
      minIncrement: number;
      capPrice?: number;
      startPrice?: number;
    };
    const seq = Number((await this.redis.getClient().get(`auction:${auctionId}:seq`)) ?? 0);
    const participantCount = await this.redis.getParticipantCount(auctionId);

    const endAt = state.endAt
      ? Number(state.endAt)
      : auction.endAt?.getTime() ?? 0;
    const currentPrice = state.currentPrice
      ? Number(state.currentPrice)
      : Number(auction.currentPrice);
    const startPrice = state.startPrice
      ? Number(state.startPrice)
      : rules.startPrice ?? 0;

    return {
      auctionId,
      status: (state.status as AuctionSnapshot['status']) || auction.status,
      currentPrice,
      startPrice,
      leaderId: state.leaderId || auction.winnerId || null,
      leaderDisplayName:
        state.leaderDisplayName || auction.winner?.displayName || null,
      endAt,
      serverNow: Date.now(),
      version: Number(state.version ?? 0),
      seq,
      minIncrement: rules.minIncrement,
      capPrice: rules.capPrice,
      participantCount,
      leaderboard,
      settleReason: auction.settleReason as SettleReason | undefined,
    };
  }

  async settle(
    auctionId: string,
    reason: SettleReason,
    winnerId: string | null,
    finalPrice: number,
  ) {
    const auctionRow = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: { ruleSnapshot: true },
    });
    const rules = (auctionRow?.ruleSnapshot ?? {}) as AuctionRuleSnapshot;
    const reserve = rules.reservePrice;

    let effectiveWinnerId = winnerId;
    let effectiveReason = reason;
    if (
      effectiveWinnerId &&
      reserve != null &&
      reserve > 0 &&
      finalPrice < reserve
    ) {
      effectiveWinnerId = null;
      effectiveReason = 'RESERVE_NOT_MET';
    }

    effectiveWinnerId = await this.resolveWinnerId(effectiveWinnerId);

    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.SETTLED,
        winnerId: effectiveWinnerId || null,
        currentPrice: finalPrice,
        settleReason: effectiveReason,
        endAt: new Date(),
      },
    });

    await this.redis.setStatus(auctionId, 'SETTLED');
    await this.prisma.auctionEvent.create({
      data: {
        auctionId,
        type:
          effectiveReason === 'CAP_PRICE'
            ? AuctionEventType.CAP_REACHED
            : AuctionEventType.SETTLED,
        payload: {
          reason: effectiveReason,
          winnerId: effectiveWinnerId,
          finalPrice,
          reservePrice: reserve ?? null,
        },
      },
    });

    if (effectiveWinnerId && finalPrice > 0) {
      await this.orders.createFromAuction(auctionId, effectiveWinnerId, finalPrice);
    }

    const snapshot = await this.buildSnapshot(auctionId);
    this.realtime.stopTimerSync(auctionId);
    this.realtime.broadcastAuctionEnded(auctionId, {
      reason: effectiveReason,
      winnerId: effectiveWinnerId,
      finalPrice,
      snapshot,
    });

    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: { roomId: true },
    });
    await this.liveRooms.broadcastShowcaseIfNeeded(auction?.roomId);

    return updated;
  }

  /** 丢弃 Redis 中已不存在用户的排名，并用 DB 昵称覆盖 ZSet 成员名 */
  private async enrichLeaderboard(
    entries: Array<{ userId: string; displayName: string; amount: number; rank: number }>,
  ) {
    if (entries.length === 0) return entries;
    const ids = [...new Set(entries.map((e) => e.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));
    return entries
      .filter((e) => nameById.has(e.userId))
      .map((e, idx) => ({
        userId: e.userId,
        displayName: nameById.get(e.userId)!,
        amount: e.amount,
        rank: idx + 1,
      }));
  }

  /** Redis leaderId 可能在仅重跑 MySQL seed 后与 users 表不一致 */
  private async resolveWinnerId(winnerId: string | null): Promise<string | null> {
    if (!winnerId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: winnerId },
      select: { id: true },
    });
    if (!user) {
      this.logger.warn(`settle: winner ${winnerId} not in DB, settling without winner`);
      return null;
    }
    return winnerId;
  }

  async checkExpiredAuctions() {
    const live = await this.prisma.auction.findMany({
      where: { status: AuctionStatus.LIVE },
    });
    const now = Date.now();
    for (const a of live) {
      try {
        const state = await this.redis.getState(a.id);
        const endAt = Number(state.endAt ?? a.endAt?.getTime() ?? 0);
        const redisStatus = state.status;
        if (redisStatus === 'SETTLED') {
          const leaderId = state.leaderId || null;
          const price = Number(state.currentPrice ?? 0);
          if (a.status === AuctionStatus.LIVE) {
            await this.settle(
              a.id,
              state.settleReason === 'CAP_PRICE' ? 'CAP_PRICE' : 'TIME_UP',
              leaderId || null,
              price,
            );
          }
          continue;
        }
        if (endAt > 0 && now >= endAt) {
          const leaderId = state.leaderId || null;
          const price = Number(state.currentPrice ?? 0);
          await this.settle(a.id, 'TIME_UP', leaderId || null, price);
        }
      } catch (err) {
        this.logger.error(
          { auctionId: a.id, err },
          'checkExpiredAuctions failed for auction',
        );
      }
    }
  }

  scheduleExpiryCheck() {
    setInterval(() => {
      void this.checkExpiredAuctions();
    }, 1000);
  }
}
