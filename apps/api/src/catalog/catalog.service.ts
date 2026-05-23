import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLotDto, UpdateLotDto } from './dto/lot.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  create(hostId: string, dto: CreateLotDto) {
    return this.prisma.lot.create({
      data: {
        hostId,
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        category: dto.category,
        status: LotStatus.DRAFT,
      },
    });
  }

  async update(hostId: string, lotId: string, dto: UpdateLotDto) {
    const lot = await this.findOwned(hostId, lotId);
    return this.prisma.lot.update({
      where: { id: lot.id },
      data: dto,
    });
  }

  async publish(hostId: string, lotId: string) {
    const lot = await this.findOwned(hostId, lotId);
    return this.prisma.lot.update({
      where: { id: lot.id },
      data: { status: LotStatus.ACTIVE },
    });
  }

  list(hostId?: string) {
    return this.prisma.lot.findMany({
      where: hostId ? { hostId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { host: { select: { displayName: true } } },
    });
  }

  async findOwned(hostId: string, lotId: string) {
    const lot = await this.prisma.lot.findUnique({ where: { id: lotId } });
    if (!lot) throw new NotFoundException('Lot not found');
    if (lot.hostId !== hostId) throw new ForbiddenException();
    return lot;
  }
}
