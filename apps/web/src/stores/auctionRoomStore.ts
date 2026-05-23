import { create } from 'zustand';
import type { AuctionSnapshot } from '@live-auction/shared';

interface AuctionRoomState {
  snapshot: AuctionSnapshot | null;
  lastSeq: number;
  clockOffset: number;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  bidPending: boolean;
  setSnapshot: (s: AuctionSnapshot) => void;
  applyBidUpdate: (payload: {
    seq: number;
    version: number;
    currentPrice: number;
    leaderId: string;
    leaderDisplayName: string;
    endAt: number;
    serverNow: number;
    leaderboard: AuctionSnapshot['leaderboard'];
  }) => void;
  applyTimerSync: (payload: {
    serverNow: number;
    endAt: number;
    version: number;
    seq: number;
    participantCount?: number;
  }) => void;
  setClockOffset: (offset: number) => void;
  setConnectionStatus: (status: AuctionRoomState['connectionStatus']) => void;
  setBidPending: (pending: boolean) => void;
}

export const useAuctionRoomStore = create<AuctionRoomState>((set, get) => ({
  snapshot: null,
  lastSeq: 0,
  clockOffset: 0,
  connectionStatus: 'connecting',
  bidPending: false,

  setSnapshot: (snapshot) =>
    set({
      snapshot,
      lastSeq: snapshot.seq,
      clockOffset: snapshot.serverNow - Date.now(),
    }),

  applyBidUpdate: (payload) => {
    if (payload.seq <= get().lastSeq) return;
    const prev = get().snapshot;
    if (!prev) return;
    set({
      lastSeq: payload.seq,
      clockOffset: payload.serverNow - Date.now(),
      snapshot: {
        ...prev,
        currentPrice: payload.currentPrice,
        leaderId: payload.leaderId,
        leaderDisplayName: payload.leaderDisplayName,
        endAt: payload.endAt,
        version: payload.version,
        seq: payload.seq,
        serverNow: payload.serverNow,
        leaderboard: payload.leaderboard,
      },
    });
  },

  applyTimerSync: (payload) => {
    if (payload.seq < get().lastSeq) return;
    const prev = get().snapshot;
    if (!prev) return;
    set({
      clockOffset: payload.serverNow - Date.now(),
      snapshot: {
        ...prev,
        endAt: payload.endAt,
        version: payload.version,
        seq: Math.max(payload.seq, prev.seq),
        serverNow: payload.serverNow,
        participantCount: payload.participantCount ?? prev.participantCount,
      },
    });
  },

  setClockOffset: (offset) => set({ clockOffset: offset }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setBidPending: (bidPending) => set({ bidPending }),
}));

export function getRemainingMs(state: {
  snapshot: AuctionSnapshot | null;
  clockOffset: number;
}): number {
  if (!state.snapshot) return 0;
  const now = Date.now() + state.clockOffset;
  return Math.max(0, state.snapshot.endAt - now);
}
