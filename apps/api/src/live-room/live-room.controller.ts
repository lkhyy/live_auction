import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { LiveRoomService } from './live-room.service';
import { AddAuctionToRoomDto, CreateLiveRoomDto } from './dto/live-room.dto';

@ApiTags('live-rooms')
@Controller('live-rooms')
export class LiveRoomController {
  constructor(private readonly liveRooms: LiveRoomService) {}

  @Get()
  list() {
    return this.liveRooms.list();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('mine')
  @Roles('HOST', 'ADMIN')
  listMine(@CurrentUser() user: AuthUser) {
    return this.liveRooms.listByHost(user.userId);
  }

  @Get('live')
  listLive() {
    return this.liveRooms.listLive();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.liveRooms.getById(id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/showcase')
  showcase(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.liveRooms.getShowcase(id, user?.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('HOST', 'ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLiveRoomDto) {
    return this.liveRooms.create(user.userId, dto.title);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/go-live')
  @Roles('HOST', 'ADMIN')
  goLive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.liveRooms.goLive(user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/auctions')
  @Roles('HOST', 'ADMIN')
  addAuction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddAuctionToRoomDto,
  ) {
    return this.liveRooms.addAuction(user.userId, id, dto.auctionId, dto.sortOrder);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/switch/:auctionId')
  @Roles('HOST', 'ADMIN')
  switchItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('auctionId') auctionId: string,
  ) {
    return this.liveRooms.switchActiveAuction(user.userId, id, auctionId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/clear-active')
  @Roles('HOST', 'ADMIN')
  clearActive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.liveRooms.clearActiveExplain(user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id/auctions/:auctionId')
  @Roles('HOST', 'ADMIN')
  detachAuction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('auctionId') auctionId: string,
  ) {
    return this.liveRooms.detachAuction(user.userId, id, auctionId);
  }
}
