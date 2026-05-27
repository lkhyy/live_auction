import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AuctionStatus, AuctionEventType } from '@prisma/client';
import { auctionRuleSnapshotSchema, type AuctionRuleSnapshot, stripReservePrice, DEFAULT_ANOMALY_DETECTION } from '@live-auction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SettlementService } from './settlement.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateAuctionDto } from './dto/auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { CatalogService } from '../catalog/catalog.service';
import { OrderService } from '../order/order.service';
import { LiveRoomService } from '../live-room/live-room.service';

@Injectable()
export class AuctionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settlement: SettlementService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
    private readonly catalog: CatalogService,
    private readonly orders: OrderService,
    @Inject(forwardRef(() => LiveRoomService))
    private readonly liveRooms: LiveRoomService,
  ) {}

  async create(hostId: string, dto: CreateAuctionDto) {
    await this.catalog.findOwned(hostId, dto.lotId);
    const rules = auctionRuleSnapshotSchema.parse(dto.rules);
    return this.prisma.auction.create({
      data: {
        lotId: dto.lotId,
        hostId,
        title: dto.title,
        status: AuctionStatus.DRAFT,
        ruleSnapshot: rules,
        scheduledStartAt: dto.scheduledStartAt ? new Date(dto.scheduledStartAt) : null,
        capPrice: rules.capPrice ?? null,
        currentPrice: rules.startPrice ?? 0,
      },
      include: { lot: true },
    });
  }

  async update(hostId: string, auctionId: string, dto: UpdateAuctionDto) {
    const auction = await this.get(auctionId);
    if (auction.hostId !== hostId) throw new ForbiddenException();
    if (
      auction.status !== AuctionStatus.DRAFT &&
      auction.status !== AuctionStatus.SCHEDULED
    ) {
      throw new BadRequestException('Only DRAFT or SCHEDULED auctions can be updated');
    }
    const data: {
      title?: string;
      ruleSnapshot?: AuctionRuleSnapshot;
      capPrice?: number | null;
      currentPrice?: number;
    } = {};
    if (dto.title) data.title = dto.title;
    if (dto.rules) {
      const prev = auction.ruleSnapshot as AuctionRuleSnapshot;
      const merged = {
        ...prev,
        ...dto.rules,
        softClose: {
          ...prev.softClose,
          ...dto.rules.softClose,
        },
        anomalyDetection: dto.rules.anomalyDetection
          ? {
              ...DEFAULT_ANOMALY_DETECTION,
              ...prev.anomalyDetection,
              ...dto.rules.anomalyDetection,
              range: {
                ...DEFAULT_ANOMALY_DETECTION.range,
                ...prev.anomalyDetection?.range,
                ...dto.rules.anomalyDetection.range,
              },
              increment: {
                ...DEFAULT_ANOMALY_DETECTION.increment,
                ...prev.anomalyDetection?.increment,
                ...dto.rules.anomalyDetection.increment,
              },
              timing: {
                ...DEFAULT_ANOMALY_DETECTION.timing,
                ...prev.anomalyDetection?.timing,
                ...dto.rules.anomalyDetection.timing,
              },
              collusion: {
                ...DEFAULT_ANOMALY_DETECTION.collusion,
                ...prev.anomalyDetection?.collusion,
                ...dto.rules.anomalyDetection.collusion,
              },
              stats: {
                ...DEFAULT_ANOMALY_DETECTION.stats,
                ...prev.anomalyDetection?.stats,
                ...dto.rules.anomalyDetection.stats,
              },
            }
          : prev.anomalyDetection,
      };
      const rules = auctionRuleSnapshotSchema.parse(merged);
      data.ruleSnapshot = rules;
      data.capPrice = rules.capPrice ?? null;
      data.currentPrice = rules.startPrice;
    }
    return this.prisma.auction.update({
      where: { id: auctionId },
      data,
      include: { lot: true },
    });
  }

  async dashboard(hostId: string) {
    const auctions = await this.prisma.auction.findMany({
      where: { hostId },
      orderBy: { createdAt: 'desc' },
      include: {
        lot: true,
        winner: { select: { displayName: true } },
        order: { select: { id: true, status: true, amount: true } },
        _count: { select: { bids: true } },
      },
    });
    const enriched = await Promise.all(
      auctions.map(async (a) => {
        let participantCount = 0;
        if (a.status === 'LIVE') {
          participantCount = await this.redis.getParticipantCount(a.id);
        }
        return { ...a, participantCount };
      }),
    );
    return enriched;
  }

  list(status?: AuctionStatus) {
    return this.prisma.auction.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        lot: true,
        host: { select: { displayName: true } },
        winner: { select: { id: true, displayName: true } },
      },
    });
  }

  async get(id: string, viewer?: { userId: string; role: string }) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        lot: true,
        host: { select: { displayName: true } },
        winner: { select: { id: true, displayName: true } },
        order: true,
        _count: { select: { bids: true } },
      },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    const participantCount =
      auction.status === 'LIVE' ? await this.redis.getParticipantCount(id) : 0;
    const rawRules = auction.ruleSnapshot as AuctionRuleSnapshot;
    const isOwner =
      viewer &&
      (viewer.role === 'ADMIN' ||
        (viewer.role === 'HOST' && auction.hostId === viewer.userId));
    const rules = isOwner ? rawRules : stripReservePrice(rawRules);
    return {
      ...auction,
      ruleSnapshot: rules,
      participantCount,
      rules,
    };
  }

  async goLive(hostId: string, auctionId: string) {
    const auction = await this.get(auctionId);
    if (auction.hostId !== hostId) throw new ForbiddenException();
    if (auction.status !== AuctionStatus.DRAFT && auction.status !== AuctionStatus.SCHEDULED) {
      throw new BadRequestException('Auction cannot go live from current status');
    }

    const rules = auction.ruleSnapshot as AuctionRuleSnapshot;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + rules.durationSeconds * 1000);

    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.LIVE,
        startAt,
        endAt,
        currentPrice: rules.startPrice ?? 0,
      },
    });

    await this.redis.initAuctionState(auctionId, rules, endAt.getTime());
    await this.prisma.auctionEvent.create({
      data: {
        auctionId,
        type: AuctionEventType.STARTED,
        payload: { startAt, endAt },
      },
    });

    const snapshot = await this.settlement.buildSnapshot(auctionId);
    this.realtime.broadcastAuctionStarted(auctionId, snapshot);
    this.realtime.startTimerSync(auctionId);

    if (auction.roomId) {
      await this.prisma.liveRoom.update({
        where: { id: auction.roomId },
        data: { activeAuctionId: auctionId, status: 'LIVE' },
      });
      await this.liveRooms.broadcastShowcaseIfNeeded(auction.roomId);
    }

    return updated;
  }

  async cancel(hostId: string, auctionId: string, reason: string) {
    const auction = await this.get(auctionId);
    if (auction.hostId !== hostId) throw new ForbiddenException();
    if (auction.status !== AuctionStatus.LIVE) {
      throw new BadRequestException('Only live auctions can be cancelled');
    }

    const rules = auction.ruleSnapshot as AuctionRuleSnapshot;
    if (rules.allowHostCancel === false) {
      throw new BadRequestException('Host cancel is disabled for this auction');
    }

    const state = await this.redis.getState(auctionId);
    const currentPrice = state.currentPrice
      ? Number(state.currentPrice)
      : Number(auction.currentPrice);
    const leaderId = state.leaderId || null;

    await this.redis.setStatus(auctionId, 'CANCELLED');
    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.CANCELLED,
        settleReason: 'HOST_CANCEL',
        endAt: new Date(),
        currentPrice,
      },
    });

    await this.prisma.auctionEvent.create({
      data: {
        auctionId,
        type: AuctionEventType.CANCELLED,
        payload: { reason, currentPrice, leaderId },
      },
    });

    if (auction.roomId) {
      const room = await this.prisma.liveRoom.findUnique({
        where: { id: auction.roomId },
        select: { activeAuctionId: true },
      });
      if (room?.activeAuctionId === auctionId) {
        await this.prisma.liveRoom.update({
          where: { id: auction.roomId },
          data: { activeAuctionId: null },
        });
      }
    }

    this.realtime.stopTimerSync(auctionId);
    const snapshot = await this.settlement.buildSnapshot(auctionId);
    this.realtime.broadcastCancelled(auctionId, reason, snapshot);
    await this.liveRooms.broadcastShowcaseIfNeeded(auction.roomId);

    return updated;
  }

  getRules(auctionId: string): Promise<AuctionRuleSnapshot> {
    return this.get(auctionId).then((a) => a.ruleSnapshot as AuctionRuleSnapshot);
  }

  async listBids(hostId: string, auctionId: string) {
    const auction = await this.get(auctionId);
    if (auction.hostId !== hostId) throw new ForbiddenException();
    return this.prisma.bid.findMany({
      where: { auctionId },
      orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }],
      include: { user: { select: { id: true, displayName: true } } },
      take: 100,
    });
  }
}
