import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { OrderService } from './order.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @Roles('HOST', 'ADMIN')
  listHost(@CurrentUser() user: AuthUser) {
    return this.orders.listForHost(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.get(id, user.userId, user.role);
  }

  @Post(':id/pay-mock')
  payMock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.payMock(id, user.userId);
  }
}
