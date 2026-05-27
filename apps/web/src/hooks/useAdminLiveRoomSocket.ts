import { useEffect, useRef } from 'react';
import { WS_EVENTS, resolveViewerKey } from '@live-auction/shared';
import { message } from 'antd';
import { acquireRoomSocket, releaseRoomSocket } from '../lib/realtimeSocket';
import { useAuthStore } from '../stores/authStore';

export function useAdminLiveRoomSocket(
  roomId: string | null | undefined,
  onRefresh: () => void,
) {
  const userId = useAuthStore((s) => s.user?.id);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!roomId) return;

    const socket = acquireRoomSocket(roomId);

    const joinRoom = () => {
      socket.emit(WS_EVENTS.JOIN_LIVE_ROOM, {
        roomId,
        viewerKey: resolveViewerKey(userId, socket.id),
      });
    };

    const onShowcaseUpdate = () => onRefreshRef.current();

    const onPriceAlert = (data: {
      reason: string;
      reasons?: string[];
      currentPrice: number;
      auctionId: string;
    }) => {
      const text = data.reasons?.length ? data.reasons.join('；') : data.reason;
      message.warning(`竞价异常预警：${text}`);
      onRefreshRef.current();
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once('connect', joinRoom);
    }

    socket.on(WS_EVENTS.SHOWCASE_UPDATED, onShowcaseUpdate);
    socket.on(WS_EVENTS.PRICE_ALERT, onPriceAlert);

    return () => {
      socket.off(WS_EVENTS.SHOWCASE_UPDATED, onShowcaseUpdate);
      socket.off(WS_EVENTS.PRICE_ALERT, onPriceAlert);
      socket.off('connect', joinRoom);
      releaseRoomSocket(roomId);
    };
  }, [roomId, userId]);
}
