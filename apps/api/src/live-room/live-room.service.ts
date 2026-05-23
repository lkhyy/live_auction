import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AuctionStatus, LiveRoomStatus } from '@prisma/client';
import type { LiveRoomShowcase } from '@live-auction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuctionService } from '../auction/auction.service';
import { SettlementService } from '../auction/settlement.service';
import { mapToShowcaseItem } from './showcase.mapper';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class LiveRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => AuctionService))
    private readonly auctionService: AuctionService,
    @Inject(forwardRef(() => SettlementService))
    private readonly settlement: SettlementService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
  ) {}

  async list() {
    return this.prisma.liveRoom.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        host: { select: { displayName: true } },
        _count: { select: { auctions: true } },
      },
    });
  }

  async listLive() {
    return this.prisma.liveRoom.findMany({
      where: { status: LiveRoomStatus.LIVE },
      orderBy: { startedAt: 'desc' },
      include: { host: { select: { displayName: true } } },
    });
  }

  async create(hostId: string, title: string) {
    return this.prisma.liveRoom.create({
      data: { hostId, title },
    });
  }

  async getShowcase(roomId: string): Promise<LiveRoomShowcase> {
    const room = await this.prisma.liveRoom.findUnique({
      where: { id: roomId },
      include: {
        host: { select: { displayName: true } },
        auctions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lot: true,
            _count: { select: { bids: true } },
          },
        },
      },
    });
    if (!room) throw new NotFoundException('Live room not found');

    const participantCount = await this.redis.getParticipantCount(`room:${roomId}`);

    const items = await Promise.all(
      room.auctions.map(async (auction) => {
        let redis: { currentPrice?: number; endAt?: number; bidCount?: number } | undefined;
        if (auction.status === AuctionStatus.LIVE || auction.status === AuctionStatus.CLOSING) {
          const state = await this.redis.getState(auction.id);
          const bidCount = await this.prisma.bid.count({ where: { auctionId: auction.id } });
          redis = {
            currentPrice: state.currentPrice ? Number(state.currentPrice) : undefined,
            endAt: state.endAt ? Number(state.endAt) : undefined,
            bidCount,
          };
        }
        return mapToShowcaseItem(auction, room.activeAuctionId, redis);
      }),
    );

    return {
      roomId: room.id,
      title: room.title,
      roomStatus: room.status,
      hostDisplayName: room.host.displayName,
      activeAuctionId: room.activeAuctionId,
      participantCount,
      items,
    };
  }

  async addAuction(hostId: string, roomId: string, auctionId: string, sortOrder?: number) {
    await this.ensureHost(hostId, roomId);
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction || auction.hostId !== hostId) {
      throw new NotFoundException('Auction not found');
    }
    const maxOrder = await this.prisma.auction.aggregate({
      where: { roomId },
      _max: { sortOrder: true },
    });
    const order = sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1;
    return this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        roomId,
        sortOrder: order,
        status:
          auction.status === AuctionStatus.DRAFT
            ? AuctionStatus.SCHEDULED
            : auction.status,
      },
    });
  }

  async goLive(hostId: string, roomId: string) {
    await this.ensureHost(hostId, roomId);
    const first = await this.prisma.auction.findFirst({
      where: {
        roomId,
        status: { in: [AuctionStatus.SCHEDULED, AuctionStatus.DRAFT] },
      },
      orderBy: { sortOrder: 'asc' },
    });
    if (!first) {
      throw new BadRequestException('No scheduled auctions in this room');
    }

    await this.prisma.liveRoom.update({
      where: { id: roomId },
      data: { status: LiveRoomStatus.LIVE, startedAt: new Date() },
    });

    return this.switchActiveAuction(hostId, roomId, first.id);
  }

  async switchActiveAuction(hostId: string, roomId: string, auctionId: string) {
    const room = await this.ensureHost(hostId, roomId);
    const target = await this.prisma.auction.findFirst({
      where: { id: auctionId, roomId },
    });
    if (!target) throw new NotFoundException('Auction not in this room');

    if (room.activeAuctionId && room.activeAuctionId !== auctionId) {
      const current = await this.prisma.auction.findUnique({
        where: { id: room.activeAuctionId },
      });
      if (current?.status === AuctionStatus.LIVE) {
        await this.endActiveAuction(room.activeAuctionId, roomId);
      }
    }

    if (target.status === AuctionStatus.SCHEDULED || target.status === AuctionStatus.DRAFT) {
      await this.auctionService.goLive(hostId, auctionId);
    }

    await this.prisma.liveRoom.update({
      where: { id: roomId },
      data: { activeAuctionId: auctionId, status: LiveRoomStatus.LIVE },
    });

    const showcase = await this.getShowcase(roomId);
    this.realtime.broadcastShowcase(roomId, showcase);
    return showcase;
  }

  async endActiveAuction(auctionId: string, roomId: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction || auction.status !== AuctionStatus.LIVE) return;

    await this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.CLOSING },
    });
    this.realtime.broadcastShowcase(roomId, await this.getShowcase(roomId));

    const state = await this.redis.getState(auctionId);
    const leaderId = state.leaderId || null;
    const price = Number(state.currentPrice ?? auction.currentPrice);
    await this.settlement.settle(auctionId, 'TIME_UP', leaderId || null, price);
    await this.broadcastShowcaseIfNeeded(roomId);
  }

  async ensureHost(hostId: string, roomId: string) {
    const room = await this.prisma.liveRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Live room not found');
    if (room.hostId !== hostId) throw new ForbiddenException();
    return room;
  }

  async broadcastShowcaseIfNeeded(roomId: string | null | undefined) {
    if (!roomId) return;
    const showcase = await this.getShowcase(roomId);
    this.realtime.broadcastShowcase(roomId, showcase);
  }
}
