import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { AuctionModule } from './auction/auction.module';
import { RealtimeModule } from './realtime/realtime.module';
import { OrderModule } from './order/order.module';
import { LiveRoomModule } from './live-room/live-room.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: new URL(config.get('REDIS_URL', 'redis://localhost:6379')).hostname,
          port: Number(
            new URL(config.get('REDIS_URL', 'redis://localhost:6379')).port || 6379,
          ),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    CatalogModule,
    AuctionModule,
    RealtimeModule,
    OrderModule,
    LiveRoomModule,
  ],
})
export class AppModule {}
