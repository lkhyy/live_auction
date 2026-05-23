import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { WS_EVENTS, type AuctionSnapshot, type LiveRoomShowcase } from '@live-auction/shared';
import { RedisService } from '../redis/redis.service';
import { SettlementService } from '../auction/settlement.service';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private timerIntervals = new Map<string, NodeJS.Timeout>();
  private clientAuctions = new Map<string, string>();
  private clientLiveRooms = new Map<string, string>();

  constructor(
    private readonly redis: RedisService,
    @Inject(forwardRef(() => SettlementService))
    private readonly settlement: SettlementService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    if (this.config.get('SOCKET_IO_REDIS_ADAPTER', 'true') === 'true') {
      const pub = this.redis.getClient().duplicate();
      const sub = this.redis.getClient().duplicate();
      this.server.adapter(createAdapter(pub, sub));
      this.logger.log('Socket.io Redis adapter enabled');
    }
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const auctionId = this.clientAuctions.get(client.id);
    if (auctionId) {
      void this.redis.removeViewer(auctionId, client.id);
      this.clientAuctions.delete(client.id);
    }
    const roomId = this.clientLiveRooms.get(client.id);
    if (roomId) {
      void this.redis.removeViewer(`room:${roomId}`, client.id);
      this.clientLiveRooms.delete(client.id);
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WS_EVENTS.JOIN_LIVE_ROOM)
  async handleJoinLiveRoom(client: Socket, roomId: string) {
    await client.join(this.liveRoomChannel(roomId));
    await this.redis.addViewer(`room:${roomId}`, client.id);
    this.clientLiveRooms.set(client.id, roomId);
    return { joined: roomId };
  }

  @SubscribeMessage(WS_EVENTS.LEAVE_LIVE_ROOM)
  async handleLeaveLiveRoom(client: Socket, roomId: string) {
    void client.leave(this.liveRoomChannel(roomId));
    await this.redis.removeViewer(`room:${roomId}`, client.id);
    this.clientLiveRooms.delete(client.id);
    return { left: roomId };
  }

  private liveRoomChannel(roomId: string) {
    return `live-room:${roomId}`;
  }

  broadcastShowcase(roomId: string, showcase: LiveRoomShowcase) {
    this.server.to(this.liveRoomChannel(roomId)).emit(WS_EVENTS.SHOWCASE_UPDATED, showcase);
  }

  @SubscribeMessage(WS_EVENTS.JOIN_AUCTION)
  async handleJoin(client: Socket, auctionId: string) {
    const prev = this.clientAuctions.get(client.id);
    if (prev && prev !== auctionId) {
      void this.redis.removeViewer(prev, client.id);
      void client.leave(this.room(prev));
    }
    await client.join(this.room(auctionId));
    await this.redis.addViewer(auctionId, client.id);
    this.clientAuctions.set(client.id, auctionId);
    const snapshot = await this.settlement.buildSnapshot(auctionId);
    client.emit(WS_EVENTS.SNAPSHOT, snapshot);
    this.server.to(this.room(auctionId)).emit(WS_EVENTS.TIMER_SYNC, {
      type: 'timer_sync',
      auctionId,
      serverNow: Date.now(),
      endAt: snapshot.endAt,
      version: snapshot.version,
      seq: snapshot.seq,
      participantCount: snapshot.participantCount,
    });
    return { joined: auctionId };
  }

  @SubscribeMessage(WS_EVENTS.LEAVE_AUCTION)
  async handleLeave(client: Socket, auctionId: string) {
    void client.leave(this.room(auctionId));
    await this.redis.removeViewer(auctionId, client.id);
    this.clientAuctions.delete(client.id);
    return { left: auctionId };
  }

  private room(auctionId: string) {
    return `auction:${auctionId}`;
  }

  broadcastAuctionStarted(auctionId: string, snapshot: AuctionSnapshot) {
    this.server.to(this.room(auctionId)).emit(WS_EVENTS.AUCTION_STARTED, snapshot);
  }

  broadcastBidUpdate(
    auctionId: string,
    payload: {
      seq: number;
      version: number;
      currentPrice: number;
      leaderId: string;
      leaderDisplayName: string;
      endAt: number;
      amount: number;
      userId: string;
      leaderboard: AuctionSnapshot['leaderboard'];
      settledByCap?: boolean;
    },
  ) {
    const serverNow = Date.now();
    this.server.to(this.room(auctionId)).emit(WS_EVENTS.BID_UPDATE, {
      type: 'bid_update',
      auctionId,
      serverNow,
      ...payload,
    });
    this.emitTimerSync(auctionId);
  }

  broadcastAuctionEnded(
    auctionId: string,
    data: {
      reason: string;
      winnerId: string | null;
      finalPrice: number;
      snapshot: AuctionSnapshot;
    },
  ) {
    this.server.to(this.room(auctionId)).emit(WS_EVENTS.AUCTION_ENDED, {
      type: 'auction_ended',
      auctionId,
      seq: data.snapshot.seq,
      ...data,
    });
  }

  broadcastCancelled(auctionId: string, reason: string) {
    this.server.to(this.room(auctionId)).emit(WS_EVENTS.AUCTION_CANCELLED, {
      type: 'auction_cancelled',
      auctionId,
      reason,
    });
  }

  broadcastTimerExtended(auctionId: string, data: { endAt: number; seq: number }) {
    this.server.to(this.room(auctionId)).emit(WS_EVENTS.TIMER_EXTENDED, {
      type: 'timer_extended',
      auctionId,
      endAt: data.endAt,
      seq: data.seq,
      message: '竞拍已延长',
    });
  }

  broadcastOutbid(
    auctionId: string,
    data: { userId: string; newPrice: number; newLeaderName: string },
  ) {
    this.server.to(this.room(auctionId)).emit(WS_EVENTS.OUTBID, {
      type: 'outbid',
      auctionId,
      ...data,
      message: `您的出价已被超越，当前价 ¥${data.newPrice}`,
    });
  }

  startTimerSync(auctionId: string) {
    if (this.timerIntervals.has(auctionId)) return;
    const interval = setInterval(() => {
      void this.emitTimerSync(auctionId);
    }, 1000);
    this.timerIntervals.set(auctionId, interval);
  }

  stopTimerSync(auctionId: string) {
    const interval = this.timerIntervals.get(auctionId);
    if (interval) {
      clearInterval(interval);
      this.timerIntervals.delete(auctionId);
    }
  }

  async emitTimerSync(auctionId: string) {
    try {
      const snapshot = await this.settlement.buildSnapshot(auctionId);
      if (snapshot.status !== 'LIVE') {
        this.stopTimerSync(auctionId);
        return;
      }
      this.server.to(this.room(auctionId)).emit(WS_EVENTS.TIMER_SYNC, {
        type: 'timer_sync',
        auctionId,
        serverNow: Date.now(),
        endAt: snapshot.endAt,
        version: snapshot.version,
        seq: snapshot.seq,
        participantCount: snapshot.participantCount,
      });
    } catch (err) {
      this.logger.warn(`Timer sync failed for ${auctionId}`, err);
    }
  }
}
