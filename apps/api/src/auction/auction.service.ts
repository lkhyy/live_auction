import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AuctionStatus, AuctionEventType } from '@prisma/client';
import { auctionRuleSnapshotSchema, type AuctionRuleSnapshot } from '@live-auction/shared';
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
    if (auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT auctions can be updated');
    }
    const data: {
      title?: string;
      ruleSnapshot?: AuctionRuleSnapshot;
      capPrice?: number | null;
      currentPrice?: number;
    } = {};
    if (dto.title) data.title = dto.title;
    if (dto.rules) {
      const rules = auctionRuleSnapshotSchema.parse({
        ...(auction.ruleSnapshot as object),
        ...dto.rules,
        softClose: {
          ...(auction.ruleSnapshot as AuctionRuleSnapshot).softClose,
          ...dto.rules.softClose,
        },
      });
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

  async get(id: string) {
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
    const rules = auction.ruleSnapshot as AuctionRuleSnapshot;
    return { ...auction, participantCount, rules };
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

    await this.redis.setStatus(auctionId, 'CANCELLED');
    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.CANCELLED, settleReason: 'HOST_CANCEL' },
    });

    await this.prisma.auctionEvent.create({
      data: {
        auctionId,
        type: AuctionEventType.CANCELLED,
        payload: { reason },
      },
    });

    this.realtime.stopTimerSync(auctionId);
    this.realtime.broadcastCancelled(auctionId, reason);
    return updated;
  }

  getRules(auctionId: string): Promise<AuctionRuleSnapshot> {
    return this.get(auctionId).then((a) => a.ruleSnapshot as AuctionRuleSnapshot);
  }
}
