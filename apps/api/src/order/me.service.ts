import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { MeProfile } from '@live-auction/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<MeProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.toProfile(user);
  }

  async updateProfile(userId: string, displayName: string): Promise<MeProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName },
    });
    return this.toProfile(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  private toProfile(user: {
    id: string;
    email: string;
    role: string;
    displayName: string;
    createdAt: Date;
  }): MeProfile {
    return {
      id: user.id,
      email: user.email,
      role: user.role as MeProfile['role'],
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
