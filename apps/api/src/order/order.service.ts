import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { MyParticipation } from '@live-auction/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromAuction(auctionId: string, buyerId: string, amount: number) {
    const existing = await this.prisma.order.findUnique({ where: { auctionId } });
    if (existing) return existing;

    return this.prisma.order.create({
      data: {
        auctionId,
        buyerId,
        amount,
        status: OrderStatus.PENDING_PAYMENT,
      },
      include: {
        auction: { include: { lot: true } },
        buyer: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async listForHost(hostId: string) {
    return this.prisma.order.findMany({
      where: { auction: { hostId } },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: { select: { id: true, title: true, status: true } },
        buyer: { select: { id: true, displayName: true } },
      },
    });
  }

  async listForBuyer(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          include: { lot: { select: { title: true, imageUrl: true } } },
        },
      },
    });
  }

  async listParticipations(buyerId: string): Promise<MyParticipation[]> {
    const groups = await this.prisma.bid.groupBy({
      by: ['auctionId'],
      where: { userId: buyerId },
      _max: { amount: true, createdAt: true },
    });

    if (groups.length === 0) return [];

    const auctionIds = groups.map((g) => g.auctionId);
    const auctions = await this.prisma.auction.findMany({
      where: { id: { in: auctionIds } },
      include: {
        lot: { select: { imageUrl: true } },
        room: { select: { id: true, title: true, status: true } },
        order: { select: { status: true } },
      },
    });

    const auctionMap = new Map(auctions.map((a) => [a.id, a]));

    const leadingChecks = await Promise.all(
      auctionIds.map(async (auctionId) => {
        const auction = auctionMap.get(auctionId);
        if (!auction) return { auctionId, leaderId: null as string | null };
        const topBid = await this.prisma.bid.findFirst({
          where: { auctionId, amount: auction.currentPrice },
          orderBy: { createdAt: 'desc' },
          select: { userId: true },
        });
        return { auctionId, leaderId: topBid?.userId ?? auction.winnerId ?? null };
      }),
    );
    const leaderMap = new Map(leadingChecks.map((c) => [c.auctionId, c.leaderId]));

    const participations = groups
      .map((g): MyParticipation | null => {
        const auction = auctionMap.get(g.auctionId);
        if (!auction || !g._max.amount || !g._max.createdAt) return null;

        const myMaxBid = Number(g._max.amount);
        const currentPrice = Number(auction.currentPrice);
        const leaderId = leaderMap.get(g.auctionId);

        return {
          auctionId: auction.id,
          title: auction.title,
          status: String(auction.status),
          currentPrice: String(currentPrice),
          myMaxBid: String(myMaxBid),
          isLeading: leaderId === buyerId && myMaxBid === currentPrice,
          lastBidAt: g._max.createdAt.toISOString(),
          roomId: auction.roomId,
          roomTitle: auction.room?.title ?? null,
          roomStatus: auction.room ? String(auction.room.status) : null,
          imageUrl: auction.lot.imageUrl,
          orderStatus: auction.order ? String(auction.order.status) : null,
        };
      })
      .filter((p): p is MyParticipation => p !== null);

    participations.sort(
      (a, b) => new Date(b.lastBidAt).getTime() - new Date(a.lastBidAt).getTime(),
    );

    return participations;
  }

  async get(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        auction: { include: { lot: true, host: { select: { displayName: true } } } },
        buyer: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const isBuyer = order.buyerId === userId;
    const isHost = order.auction.hostId === userId;
    if (!isBuyer && !isHost && role !== 'ADMIN') {
      throw new ForbiddenException();
    }
    return order;
  }

  async payMock(orderId: string, userId: string) {
    const order = await this.get(orderId, userId, 'BUYER');
    if (order.buyerId !== userId) throw new ForbiddenException();
    if (order.status === OrderStatus.PAID) return order;

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID, paidAt: new Date() },
      include: {
        auction: { include: { lot: true } },
      },
    });
  }
}
