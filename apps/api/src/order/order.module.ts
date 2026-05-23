import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { MeController } from './me.controller';

@Module({
  controllers: [OrderController, MeController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
