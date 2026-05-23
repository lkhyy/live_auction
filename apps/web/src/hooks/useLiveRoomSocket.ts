import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { WS_EVENTS, type LiveRoomShowcase } from '@live-auction/shared';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

export function useLiveRoomSocket(
  roomId: string | undefined,
  onShowcase: (data: LiveRoomShowcase) => void,
) {
  useEffect(() => {
    if (!roomId) return;

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => {
      socket.emit(WS_EVENTS.JOIN_LIVE_ROOM, roomId);
    });

    socket.on(WS_EVENTS.SHOWCASE_UPDATED, (data: LiveRoomShowcase) => {
      onShowcase(data);
    });

    return () => {
      socket.emit(WS_EVENTS.LEAVE_LIVE_ROOM, roomId);
      socket.disconnect();
    };
  }, [roomId, onShowcase]);
}
