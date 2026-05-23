import { Module, forwardRef } from '@nestjs/common';
import { LiveRoomService } from './live-room.service';
import { LiveRoomController } from './live-room.controller';
import { AuctionModule } from '../auction/auction.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [forwardRef(() => AuctionModule), forwardRef(() => RealtimeModule)],
  controllers: [LiveRoomController],
  providers: [LiveRoomService],
  exports: [LiveRoomService],
})
export class LiveRoomModule {}
