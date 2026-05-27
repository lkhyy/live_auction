import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RedisService } from './redis/redis.service';
import { SettlementService } from './auction/settlement.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  const corsFromEnv = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({
    origin: isDev
      ? (origin, callback) => {
          // 开发：允许本机 + 局域网 IP 访问（手机扫 192.168.x:5173）
          if (
            !origin ||
            /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
              origin,
            )
          ) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        }
      : (corsFromEnv ?? ['http://localhost:5173']),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('Live Auction API')
    .setDescription('直播竞拍系统 API')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const redis = app.get(RedisService);
  await redis.loadScripts();

  const settlement = app.get(SettlementService);
  settlement.scheduleExpiryCheck();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}

bootstrap();
