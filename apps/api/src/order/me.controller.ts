import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';

import { PrismaService } from '../prisma/prisma.service';

import { ChangePasswordDto, UpdateProfileDto } from './dto/me.dto';

import { MeService } from './me.service';

import { OrderService } from './order.service';



@ApiTags('me')

@ApiBearerAuth()

@UseGuards(JwtAuthGuard)

@Controller('me')

export class MeController {

  constructor(

    private readonly orders: OrderService,

    private readonly prisma: PrismaService,

    private readonly me: MeService,

  ) {}



  @Get()

  profile(@CurrentUser() user: AuthUser) {

    return this.me.getProfile(user.userId);

  }



  @Patch()

  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {

    return this.me.updateProfile(user.userId, dto.displayName);

  }



  @Post('change-password')

  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {

    return this.me.changePassword(user.userId, dto.currentPassword, dto.newPassword);

  }



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



  @Get('participations')

  myParticipations(@CurrentUser() user: AuthUser) {

    return this.orders.listParticipations(user.userId);

  }

}

