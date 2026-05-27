import { io, type Socket } from 'socket.io-client';
import { WS_EVENTS } from '@live-auction/shared';
import { wsBaseUrl } from './backendUrl';
const DISCONNECT_DELAY_MS = 150;

interface SocketEntry {
  socket: Socket;
  refs: number;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

const roomSockets = new Map<string, SocketEntry>();
const auctionSockets = new Map<string, SocketEntry>();

function acquireSocket(map: Map<string, SocketEntry>, key: string): Socket {
  let entry = map.get(key);
  if (!entry) {
    const socket = io(wsBaseUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });
    entry = { socket, refs: 0, disconnectTimer: null };
    map.set(key, entry);
  }
  if (entry.disconnectTimer) {
    clearTimeout(entry.disconnectTimer);
    entry.disconnectTimer = null;
  }
  entry.refs += 1;
  return entry.socket;
}

function releaseSocket(
  map: Map<string, SocketEntry>,
  key: string,
  onLeave: (socket: Socket) => void,
) {
  const entry = map.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;

  entry.disconnectTimer = setTimeout(() => {
    const current = map.get(key);
    if (!current || current.refs > 0) return;
    onLeave(current.socket);
    current.socket.disconnect();
    map.delete(key);
  }, DISCONNECT_DELAY_MS);
}

export function acquireRoomSocket(roomId: string): Socket {
  return acquireSocket(roomSockets, roomId);
}

export function releaseRoomSocket(roomId: string) {
  releaseSocket(roomSockets, roomId, (socket) => {
    socket.emit(WS_EVENTS.LEAVE_LIVE_ROOM, roomId);
  });
}

export function acquireAuctionSocket(auctionId: string): Socket {
  return acquireSocket(auctionSockets, auctionId);
}

export function releaseAuctionSocket(auctionId: string) {
  releaseSocket(auctionSockets, auctionId, (socket) => {
    socket.emit(WS_EVENTS.LEAVE_AUCTION, auctionId);
  });
}
