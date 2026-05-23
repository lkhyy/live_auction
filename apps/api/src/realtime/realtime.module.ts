import { Module, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { AuctionModule } from '../auction/auction.module';
import { LiveRoomModule } from '../live-room/live-room.module';

@Module({
  imports: [forwardRef(() => AuctionModule), forwardRef(() => LiveRoomModule)],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
