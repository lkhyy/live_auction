import { useEffect, useRef } from 'react';
import { WS_EVENTS, resolveViewerKey, type LiveRoomShowcase } from '@live-auction/shared';
import { acquireRoomSocket, releaseRoomSocket } from '../lib/realtimeSocket';
import { useAuthStore } from '../stores/authStore';

export function useLiveRoomSocket(
  roomId: string | undefined,
  onShowcase: (data: LiveRoomShowcase) => void,
) {
  const userId = useAuthStore((s) => s.user?.id);
  const onShowcaseRef = useRef(onShowcase);
  onShowcaseRef.current = onShowcase;

  useEffect(() => {
    if (!roomId) return;

    const socket = acquireRoomSocket(roomId);

    const joinRoom = () => {
      socket.emit(WS_EVENTS.JOIN_LIVE_ROOM, {
        roomId,
        viewerKey: resolveViewerKey(userId, socket.id),
      });
    };

    const onShowcaseUpdate = (data: LiveRoomShowcase) => {
      onShowcaseRef.current(data);
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once('connect', joinRoom);
    }

    socket.on(WS_EVENTS.SHOWCASE_UPDATED, onShowcaseUpdate);

    return () => {
      socket.off(WS_EVENTS.SHOWCASE_UPDATED, onShowcaseUpdate);
      socket.off('connect', joinRoom);
      releaseRoomSocket(roomId);
    };
  }, [roomId, userId]);
}
