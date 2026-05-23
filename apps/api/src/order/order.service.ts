import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
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
