/** WebSocket 加入直播间/拍品时携带的观众标识 */
export interface JoinLiveRoomPayload {
  roomId: string;
  viewerKey?: string;
}

export interface JoinAuctionPayload {
  auctionId: string;
  viewerKey?: string;
}

/** 已登录 user:{uuid}，未登录 anon:{socketId} */
export function resolveViewerKey(userId?: string | null, socketId?: string): string {
  if (userId) return `user:${userId}`;
  return `anon:${socketId ?? 'unknown'}`;
}
