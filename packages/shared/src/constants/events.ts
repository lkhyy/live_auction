export const WS_EVENTS = {
  JOIN_AUCTION: 'join_auction',
  LEAVE_AUCTION: 'leave_auction',
  AUCTION_STARTED: 'auction_started',
  BID_UPDATE: 'bid_update',
  TIMER_SYNC: 'timer_sync',
  LEADERBOARD: 'leaderboard',
  AUCTION_ENDED: 'auction_ended',
  AUCTION_CANCELLED: 'auction_cancelled',
  SNAPSHOT: 'snapshot',
  TIMER_EXTENDED: 'timer_extended',
  OUTBID: 'outbid',
  JOIN_LIVE_ROOM: 'join_live_room',
  LEAVE_LIVE_ROOM: 'leave_live_room',
  SHOWCASE_UPDATED: 'showcase_updated',
} as const;

export const BID_QUEUE = 'bid-persist';
export const SETTLE_QUEUE = 'auction-settle';
export const ORDER_QUEUE = 'order-create';
