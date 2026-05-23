import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BID_QUEUE } from '@live-auction/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuctionEventType } from '@prisma/client';

interface BidPersistJob {
  auctionId: string;
  userId: string;
  amount: number;
  idempotencyKey?: string;
  version: number;
}

@Processor(BID_QUEUE)
export class BidPersistProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<BidPersistJob>) {
    const { auctionId, userId, amount, idempotencyKey, version } = job.data;

    if (idempotencyKey) {
      const existing = await this.prisma.bid.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing;
    }

    const bid = await this.prisma.bid.create({
      data: {
        auctionId,
        userId,
        amount,
        idempotencyKey,
      },
    });

    await this.prisma.auction.update({
      where: { id: auctionId },
      data: { currentPrice: amount },
    });

    await this.prisma.auctionEvent.create({
      data: {
        auctionId,
        type: AuctionEventType.BID_ACCEPTED,
        payload: { bidId: bid.id, userId, amount, version },
      },
    });

    return bid;
  }
}
