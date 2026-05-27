import type { AuctionSnapshot, LeaderboardEntry, SettleReason } from './auction';

export interface TimerSyncPayload {
  type: 'timer_sync';
  auctionId: string;
  serverNow: number;
  endAt: number;
  version: number;
  seq: number;
}

export interface BidUpdatePayload {
  type: 'bid_update';
  auctionId: string;
  seq: number;
  version: number;
  currentPrice: number;
  leaderId: string;
  leaderDisplayName: string;
  endAt: number;
  serverNow: number;
  amount: number;
  userId: string;
  leaderboard: LeaderboardEntry[];
  settledByCap?: boolean;
}

export interface AuctionEndedPayload {
  type: 'auction_ended';
  auctionId: string;
  seq: number;
  reason: SettleReason;
  winnerId: string | null;
  finalPrice: number;
  snapshot: AuctionSnapshot;
}

export interface AuctionCancelledPayload {
  type: 'auction_cancelled';
  auctionId: string;
  reason: string;
  snapshot?: AuctionSnapshot;
}

export interface PriceAlertPayload {
  type: 'price_alert';
  auctionId: string;
  roomId: string;
  currentPrice: number;
  threshold: number;
  reason: string;
  reasons?: string[];
}

export type WsBroadcastPayload =
  | TimerSyncPayload
  | BidUpdatePayload
  | AuctionEndedPayload
  | AuctionCancelledPayload
  | PriceAlertPayload
  | AuctionSnapshot;
