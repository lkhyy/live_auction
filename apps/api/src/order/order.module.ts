import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  controllers: [OrderController, MeController],
  providers: [OrderService, MeService],
  exports: [OrderService],
})
export class OrderModule {}
