import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { BiddingService } from './bidding.service';
import { PlaceBidDto } from './dto/bid.dto';

@ApiTags('bidding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auctions/:id/bids')
export class BiddingController {
  constructor(
    private readonly bidding: BiddingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async placeBid(
    @CurrentUser() user: AuthUser,
    @Param('id') auctionId: string,
    @Body() dto: PlaceBidDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.userId } });
    return this.bidding.placeBid(
      user.userId,
      dbUser?.displayName ?? 'User',
      auctionId,
      dto,
      idempotencyKey,
    );
  }
}
