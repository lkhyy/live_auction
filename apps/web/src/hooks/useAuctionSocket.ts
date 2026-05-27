import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { WS_EVENTS, resolveViewerKey } from '@live-auction/shared';
import type { AuctionSnapshot, BidUpdatePayload, TimerSyncPayload } from '@live-auction/shared';
import { message } from 'antd';
import { Toast } from 'antd-mobile';
import { auctionsApi } from '../lib/api';
import { acquireAuctionSocket, releaseAuctionSocket } from '../lib/realtimeSocket';
import { useAuctionRoomStore } from '../stores/auctionRoomStore';

function isMobilePath() {
  return window.location.pathname.startsWith('/m');
}

export function useAuctionSocket(auctionId: string | undefined, userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
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

    const socket = acquireAuctionSocket(auctionId);
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

    const joinAuction = () => {
      setConnectionStatus('connected');
      socket.emit(WS_EVENTS.JOIN_AUCTION, {
        auctionId,
        viewerKey: resolveViewerKey(userIdRef.current, socket.id),
      });
      void loadSnapshot();
    };

    const onDisconnect = () => setConnectionStatus('disconnected');
    const onReconnectAttempt = () => setConnectionStatus('reconnecting');
    const onReconnect = () => joinAuction();

    const onSnapshot = (data: AuctionSnapshot) => setSnapshot(data);

    const onBidUpdate = (data: BidUpdatePayload) => {
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
    };

    const onTimerSync = (data: TimerSyncPayload & { participantCount?: number }) => {
      applyTimerSync(data);
    };

    const onTimerExtended = (data: { message?: string; endAt: number; seq?: number }) => {
      notify('竞拍延时', data.message ?? '倒计时已延长');
      const prev = useAuctionRoomStore.getState().snapshot;
      if (!prev) return;
      useAuctionRoomStore.setState({
        snapshot: {
          ...prev,
          endAt: data.endAt,
          seq: data.seq ?? prev.seq,
        },
      });
    };

    const onOutbid = (data: { userId: string; message?: string; newPrice: number }) => {
      if (userIdRef.current && data.userId === userIdRef.current) {
        notify('被超越', data.message ?? `当前价 ¥${data.newPrice}`);
      }
    };

    const onAuctionEnded = (data: { snapshot: AuctionSnapshot; finalPrice?: number }) => {
      setSnapshot(data.snapshot);
      notify('竞拍结束', `成交价 ¥${data.snapshot.currentPrice}`);
    };

    const onAuctionCancelled = (data: { snapshot?: AuctionSnapshot }) => {
      notify('竞拍取消', '本场竞拍已被主播取消');
      if (data.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        void loadSnapshot();
      }
      window.dispatchEvent(new CustomEvent('auction:cancelled'));
    };

    const onAuctionStarted = (data: AuctionSnapshot) => setSnapshot(data);

    if (socket.connected) {
      joinAuction();
    } else {
      setConnectionStatus('connecting');
      socket.once('connect', joinAuction);
    }

    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onReconnect);
    socket.on(WS_EVENTS.SNAPSHOT, onSnapshot);
    socket.on(WS_EVENTS.BID_UPDATE, onBidUpdate);
    socket.on(WS_EVENTS.TIMER_SYNC, onTimerSync);
    socket.on(WS_EVENTS.TIMER_EXTENDED, onTimerExtended);
    socket.on(WS_EVENTS.OUTBID, onOutbid);
    socket.on(WS_EVENTS.AUCTION_ENDED, onAuctionEnded);
    socket.on(WS_EVENTS.AUCTION_CANCELLED, onAuctionCancelled);
    socket.on(WS_EVENTS.AUCTION_STARTED, onAuctionStarted);

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    return () => {
      cancelled = true;
      socket.off('connect', joinAuction);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onReconnect);
      socket.off(WS_EVENTS.SNAPSHOT, onSnapshot);
      socket.off(WS_EVENTS.BID_UPDATE, onBidUpdate);
      socket.off(WS_EVENTS.TIMER_SYNC, onTimerSync);
      socket.off(WS_EVENTS.TIMER_EXTENDED, onTimerExtended);
      socket.off(WS_EVENTS.OUTBID, onOutbid);
      socket.off(WS_EVENTS.AUCTION_ENDED, onAuctionEnded);
      socket.off(WS_EVENTS.AUCTION_CANCELLED, onAuctionCancelled);
      socket.off(WS_EVENTS.AUCTION_STARTED, onAuctionStarted);
      releaseAuctionSocket(auctionId);
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
