import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { CatalogService } from './catalog.service';
import { CreateLotDto, UpdateLotDto } from './dto/lot.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lots')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  @Roles('HOST', 'ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLotDto) {
    return this.catalog.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('mine') mine?: string) {
    return this.catalog.list(mine === 'true' ? user.userId : undefined);
  }

  @Patch(':id')
  @Roles('HOST', 'ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLotDto,
  ) {
    return this.catalog.update(user.userId, id, dto);
  }

  @Post(':id/publish')
  @Roles('HOST', 'ADMIN')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.publish(user.userId, id);
  }
}
