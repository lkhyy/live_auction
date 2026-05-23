import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from './order.service';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly orders: OrderService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('orders')
  myOrders(@CurrentUser() user: AuthUser) {
    return this.orders.listForBuyer(user.userId);
  }

  @Get('bids')
  myBids(@CurrentUser() user: AuthUser) {
    return this.prisma.bid.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          select: { id: true, title: true, status: true, currentPrice: true },
        },
      },
    });
  }
}
