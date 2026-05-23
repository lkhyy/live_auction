import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from '@live-auction/shared';
import type { AuctionSnapshot, BidUpdatePayload, TimerSyncPayload } from '@live-auction/shared';
import { message } from 'antd';
import { Toast } from 'antd-mobile';
import { auctionsApi } from '../lib/api';
import { useAuctionRoomStore } from '../stores/auctionRoomStore';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

function isMobilePath() {
  return window.location.pathname.startsWith('/m');
}

export function useAuctionSocket(auctionId: string | undefined, userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setSnapshot,
    applyBidUpdate,
    applyTimerSync,
    setConnectionStatus,
  } = useAuctionRoomStore();

  useEffect(() => {
    if (!auctionId) return;

    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        const snapshot = await auctionsApi.snapshot(auctionId);
        if (!cancelled) setSnapshot(snapshot);
      } catch (e) {
        console.error('Failed to load snapshot', e);
      }
    };

    void loadSnapshot();

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });
    socketRef.current = socket;

    const notify = (title: string, body: string) => {
      if (isMobilePath()) {
        Toast.show({ content: `${title}: ${body}`, duration: 3000 });
      } else {
        message.info(`${title} — ${body}`);
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    };

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socket.emit(WS_EVENTS.JOIN_AUCTION, auctionId);
      void loadSnapshot();
    });

    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    socket.io.on('reconnect', () => {
      setConnectionStatus('connected');
      socket.emit(WS_EVENTS.JOIN_AUCTION, auctionId);
      void loadSnapshot();
    });

    socket.on(WS_EVENTS.SNAPSHOT, (data: AuctionSnapshot) => {
      setSnapshot(data);
    });

    socket.on(WS_EVENTS.BID_UPDATE, (data: BidUpdatePayload) => {
      applyBidUpdate({
        seq: data.seq,
        version: data.version,
        currentPrice: data.currentPrice,
        leaderId: data.leaderId,
        leaderDisplayName: data.leaderDisplayName,
        endAt: data.endAt,
        serverNow: data.serverNow,
        leaderboard: data.leaderboard,
      });
    });

    socket.on(WS_EVENTS.TIMER_SYNC, (data: TimerSyncPayload & { participantCount?: number }) => {
      applyTimerSync(data);
      const prev = useAuctionRoomStore.getState().snapshot;
      if (prev && data.participantCount != null) {
        useAuctionRoomStore.setState({
          snapshot: { ...useAuctionRoomStore.getState().snapshot!, participantCount: data.participantCount },
        });
      }
    });

    socket.on(WS_EVENTS.TIMER_EXTENDED, (data: { message?: string; endAt: number }) => {
      notify('竞拍延时', data.message ?? '倒计时已延长');
      applyTimerSync({
        serverNow: Date.now(),
        endAt: data.endAt,
        version: useAuctionRoomStore.getState().snapshot?.version ?? 0,
        seq: useAuctionRoomStore.getState().lastSeq,
      });
    });

    socket.on(
      WS_EVENTS.OUTBID,
      (data: { userId: string; message?: string; newPrice: number }) => {
        if (userId && data.userId === userId) {
          notify('被超越', data.message ?? `当前价 ¥${data.newPrice}`);
        }
      },
    );

    socket.on(WS_EVENTS.AUCTION_ENDED, (data: { snapshot: AuctionSnapshot; finalPrice?: number }) => {
      setSnapshot(data.snapshot);
      notify('竞拍结束', `成交价 ¥${data.snapshot.currentPrice}`);
    });

    socket.on(WS_EVENTS.AUCTION_CANCELLED, () => {
      notify('竞拍取消', '本场竞拍已被主播取消');
      void loadSnapshot();
    });

    socket.on(WS_EVENTS.AUCTION_STARTED, (data: AuctionSnapshot) => {
      setSnapshot(data);
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    setConnectionStatus('connecting');

    return () => {
      cancelled = true;
      socket.emit(WS_EVENTS.LEAVE_AUCTION, auctionId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    auctionId,
    userId,
    setSnapshot,
    applyBidUpdate,
    applyTimerSync,
    setConnectionStatus,
  ]);

  return socketRef;
}
