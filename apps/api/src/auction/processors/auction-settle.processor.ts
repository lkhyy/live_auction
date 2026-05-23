import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SETTLE_QUEUE } from '@live-auction/shared';

@Processor(SETTLE_QUEUE)
export class AuctionSettleProcessor extends WorkerHost {
  async process(job: Job) {
    return { processed: true, jobId: job.id };
  }
}
