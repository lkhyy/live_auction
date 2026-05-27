import {

  ConflictException,

  HttpException,

  HttpStatus,

  Inject,

  Injectable,

  NotFoundException,

  forwardRef,

} from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';

import { Queue } from 'bullmq';

import { ConfigService } from '@nestjs/config';

import { AuctionStatus } from '@prisma/client';

import {

  BID_ERROR_CODES,

  BID_QUEUE,

  type AuctionRuleSnapshot,

  type BidResult,

} from '@live-auction/shared';

import { PrismaService } from '../prisma/prisma.service';

import { RedisService } from '../redis/redis.service';

import type { LuaBidResult } from '../redis/place-bid.script';

import { SettlementService } from './settlement.service';

import { RealtimeGateway } from '../realtime/realtime.gateway';

import { PlaceBidDto } from './dto/bid.dto';

import { LiveRoomService } from '../live-room/live-room.service';

import {

  analyzeBidAnomalies,

  summarizeAnomalyHits,

  validateBidBeforeAccept,

} from './bid-anomaly.util';



@Injectable()

export class BiddingService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly redis: RedisService,

    private readonly settlement: SettlementService,

    @Inject(forwardRef(() => RealtimeGateway))

    private readonly realtime: RealtimeGateway,

    private readonly config: ConfigService,

    @InjectQueue(BID_QUEUE) private readonly bidQueue: Queue,

    @Inject(forwardRef(() => LiveRoomService))

    private readonly liveRooms: LiveRoomService,

  ) {}



  async placeBid(

    userId: string,

    displayName: string,

    auctionId: string,

    dto: PlaceBidDto,

    idempotencyKey?: string,

  ): Promise<BidResult> {

    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });

    if (!auction) throw new NotFoundException('Auction not found');

    if (auction.status !== AuctionStatus.LIVE) {

      return { success: false, errorCode: BID_ERROR_CODES.AUCTION_NOT_LIVE };

    }



    if (idempotencyKey) {

      const existing = await this.prisma.bid.findUnique({ where: { idempotencyKey } });

      if (existing) {

        const snapshot = await this.settlement.buildSnapshot(auctionId);

        return { success: true, bidId: existing.id, snapshot };

      }

    }



    const limit = this.config.get<number>('BID_RATE_LIMIT_PER_USER', 2);

    const windowMs = this.config.get<number>('BID_RATE_LIMIT_WINDOW_MS', 1000);

    const allowed = await this.redis.checkRateLimit(auctionId, userId, limit, windowMs);

    if (!allowed) {

      throw new HttpException(BID_ERROR_CODES.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);

    }



    const rules = auction.ruleSnapshot as AuctionRuleSnapshot;

    const state = await this.redis.getState(auctionId);

    const startPrice = rules.startPrice ?? 0;

    const currentPrice = Number(state.currentPrice ?? startPrice);

    const bidCount = await this.redis.getBidCount(auctionId);

    const minRequired = bidCount === 0 ? startPrice : currentPrice + rules.minIncrement;

    const endAtMs = Number(state.endAt ?? auction.endAt?.getTime() ?? 0);

    const atMs = Date.now();

    const bidLog = await this.redis.getBidLog(auctionId);



    const rejectHits = validateBidBeforeAccept({

      rules,

      amount: dto.amount,

      prevPrice: currentPrice,

      minRequired,

      userId,

      atMs,

      endAtMs,

      bidLog,

      leaderboardAmounts: [],

    });

    if (rejectHits.length > 0) {

      return {

        success: false,

        errorCode: BID_ERROR_CODES.INVALID_AMOUNT,

        snapshot: await this.settlement.buildSnapshot(auctionId),

      };

    }



    const result = await this.redis.placeBid({

      auctionId,

      userId,

      displayName,

      amount: dto.amount,

      rules,

      expectedVersion: dto.expectedVersion,

    });



    if (!result.ok) {

      return this.handleBidFailure(auctionId, result);

    }



    const success = result as Extract<LuaBidResult, { ok: true }>;

    const snapshot = await this.settlement.buildSnapshot(auctionId);



    await this.redis.appendBidLog(auctionId, {

      userId,

      amount: success.currentPrice,

      prevPrice: currentPrice,

      atMs,

      endAtMs: success.endAt,

    });



    await this.bidQueue.add('persist', {

      auctionId,

      userId,

      amount: success.currentPrice,

      idempotencyKey,

      version: success.version,

    });



    if (success.settledByCap === 1) {

      await this.settlement.settle(auctionId, 'CAP_PRICE', success.leaderId, success.currentPrice);

    } else {

      this.realtime.broadcastBidUpdate(auctionId, {

        seq: success.seq,

        version: success.version,

        currentPrice: success.currentPrice,

        leaderId: success.leaderId,

        leaderDisplayName: success.leaderDisplayName,

        endAt: success.endAt,

        amount: success.currentPrice,

        userId: success.leaderId,

        leaderboard: snapshot.leaderboard,

      });



      if (success.extended === 1) {

        this.realtime.broadcastTimerExtended(auctionId, {

          endAt: success.endAt,

          seq: success.seq,

        });

      }



      const prevLeader = success.previousLeaderId;

      if (prevLeader && prevLeader !== success.leaderId && prevLeader !== userId) {

        this.realtime.broadcastOutbid(auctionId, {

          userId: prevLeader,

          newPrice: success.currentPrice,

          newLeaderName: success.leaderDisplayName,

        });

      }



      await this.liveRooms.broadcastShowcaseIfNeeded(auction.roomId);



      await this.maybeTriggerAnomalyAlerts(

        auctionId,

        auction.roomId,

        {

          rules,

          amount: success.currentPrice,

          prevPrice: currentPrice,

          minRequired,

          userId,

          atMs,

          endAtMs: success.endAt,

          bidLog: await this.redis.getBidLog(auctionId),

          leaderboardAmounts: snapshot.leaderboard.map((e) => e.amount),

        },

      );

    }



    return {

      success: true,

      snapshot,

      settledByCap: success.settledByCap === 1,

    };

  }



  private async handleBidFailure(

    auctionId: string,

    result: LuaBidResult,

  ): Promise<BidResult> {

    const snapshot = await this.settlement.buildSnapshot(auctionId);

    if (!result.ok && result.code === 'VERSION_CONFLICT') {

      throw new ConflictException({ errorCode: BID_ERROR_CODES.VERSION_CONFLICT, snapshot });

    }

    return {

      success: false,

      errorCode: result.ok ? undefined : result.code,

      snapshot,

    };

  }



  async getSnapshot(auctionId: string) {

    return this.settlement.buildSnapshot(auctionId);

  }



  private async maybeTriggerAnomalyAlerts(

    auctionId: string,

    roomId: string | null,

    ctx: Parameters<typeof analyzeBidAnomalies>[0],

  ) {

    if (!roomId) return;



    const warnHits = analyzeBidAnomalies(ctx).filter((h) => h.severity === 'warn');

    if (warnHits.length === 0) return;



    const newCodes = await this.redis.markAnomalyCodes(

      auctionId,

      warnHits.map((h) => h.code),

    );

    if (newCodes.length === 0) return;



    const newHits = warnHits.filter((h) => newCodes.includes(h.code));

    await this.redis.markPriceAlertSent(auctionId);



    this.realtime.broadcastPriceAlert(roomId, {

      auctionId,

      currentPrice: ctx.amount,

      threshold: 0,

      reason: summarizeAnomalyHits(newHits),

      reasons: newHits.map((h) => h.reason),

    });

    await this.liveRooms.broadcastShowcaseIfNeeded(roomId);

  }

}


