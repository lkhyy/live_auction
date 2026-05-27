export type AuctionStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'LIVE'
  | 'CLOSING'
  | 'SETTLED'
  | 'CANCELLED'
  | 'FAILED';

export type SettleReason =
  | 'TIME_UP'
  | 'CAP_PRICE'
  | 'HOST_CANCEL'
  | 'MANUAL'
  | 'RESERVE_NOT_MET';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  amount: number;
  rank: number;
}

export interface AuctionSnapshot {
  auctionId: string;
  status: AuctionStatus;
  currentPrice: number;
  startPrice: number;
  leaderId: string | null;
  leaderDisplayName: string | null;
  endAt: number;
  serverNow: number;
  version: number;
  seq: number;
  minIncrement: number;
  capPrice?: number;
  participantCount?: number;
  leaderboard: LeaderboardEntry[];
  settleReason?: SettleReason;
}

export interface BidResult {
  success: boolean;
  errorCode?: string;
  snapshot?: AuctionSnapshot;
  bidId?: string;
  settledByCap?: boolean;
}
