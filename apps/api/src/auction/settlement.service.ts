import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AuctionStatus, AuctionEventType } from '@prisma/client';
import { type AuctionSnapshot, type SettleReason } from '@live-auction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { OrderService } from '../order/order.service';
import { LiveRoomService } from '../live-room/live-room.service';

@Injectable()
export class SettlementService {
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
    const leaderboard = await this.redis.getLeaderboard(auctionId);
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
    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.SETTLED,
        winnerId: winnerId || null,
        currentPrice: finalPrice,
        settleReason: reason,
        endAt: new Date(),
      },
    });

    await this.redis.setStatus(auctionId, 'SETTLED');
    await this.prisma.auctionEvent.create({
      data: {
        auctionId,
        type:
          reason === 'CAP_PRICE'
            ? AuctionEventType.CAP_REACHED
            : AuctionEventType.SETTLED,
        payload: { reason, winnerId, finalPrice },
      },
    });

    if (winnerId && finalPrice > 0) {
      await this.orders.createFromAuction(auctionId, winnerId, finalPrice);
    }

    const snapshot = await this.buildSnapshot(auctionId);
    this.realtime.stopTimerSync(auctionId);
    this.realtime.broadcastAuctionEnded(auctionId, {
      reason,
      winnerId,
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

  async checkExpiredAuctions() {
    const live = await this.prisma.auction.findMany({
      where: { status: AuctionStatus.LIVE },
    });
    const now = Date.now();
    for (const a of live) {
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
    }
  }

  scheduleExpiryCheck() {
    setInterval(() => {
      void this.checkExpiredAuctions();
    }, 1000);
  }
}
