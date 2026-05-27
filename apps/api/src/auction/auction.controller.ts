import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuctionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { AuctionService } from './auction.service';
import { BiddingService } from './bidding.service';
import { CreateAuctionDto } from './dto/auction.dto';
import { CancelAuctionDto } from './dto/cancel.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';

@ApiTags('auctions')
@Controller('auctions')
export class AuctionController {
  constructor(
    private readonly auction: AuctionService,
    private readonly bidding: BiddingService,
  ) {}

  @Get()
  list(@Query('status') status?: AuctionStatus) {
    return this.auction.list(status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('dashboard')
  @Roles('HOST', 'ADMIN')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.auction.dashboard(user.userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.auction.get(id, user);
  }

  @Get(':id/snapshot')
  snapshot(@Param('id') id: string) {
    return this.bidding.getSnapshot(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/bids')
  @Roles('HOST', 'ADMIN')
  listBids(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auction.listBids(user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('HOST', 'ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAuctionDto) {
    return this.auction.create(user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles('HOST', 'ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAuctionDto,
  ) {
    return this.auction.update(user.userId, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/go-live')
  @Roles('HOST', 'ADMIN')
  goLive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auction.goLive(user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/cancel')
  @Roles('HOST', 'ADMIN')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelAuctionDto,
  ) {
    return this.auction.cancel(user.userId, id, dto.reason);
  }
}
