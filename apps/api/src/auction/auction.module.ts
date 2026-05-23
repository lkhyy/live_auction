import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BID_QUEUE, SETTLE_QUEUE } from '@live-auction/shared';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { BiddingService } from './bidding.service';
import { BiddingController } from './bidding.controller';
import { SettlementService } from './settlement.service';
import { BidPersistProcessor } from './processors/bid-persist.processor';
import { AuctionSettleProcessor } from './processors/auction-settle.processor';
import { RealtimeModule } from '../realtime/realtime.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrderModule } from '../order/order.module';
import { LiveRoomModule } from '../live-room/live-room.module';

@Module({
  imports: [
    CatalogModule,
    OrderModule,
    forwardRef(() => LiveRoomModule),
    BullModule.registerQueue({ name: BID_QUEUE }, { name: SETTLE_QUEUE }),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [AuctionController, BiddingController],
  providers: [
    AuctionService,
    BiddingService,
    SettlementService,
    BidPersistProcessor,
    AuctionSettleProcessor,
  ],
  exports: [AuctionService, BiddingService, SettlementService],
})
export class AuctionModule {}
