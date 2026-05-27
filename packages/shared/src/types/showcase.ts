/** 橱窗列表展示状态（对齐产品 UI） */
export type ShowcaseDisplayStatus =
  | 'BIDDING'   // 竞拍中
  | 'UPCOMING'  // 即将开拍
  | 'FAILED'    // 竞拍未成交
  | 'SOLD'      // 竞拍结束-成交
  | 'CLOSING'   // 截拍中
  | 'CANCELLED'; // 主播取消

export interface ShowcaseItem {
  auctionId: string;
  sortOrder: number;
  title: string;
  imageUrl?: string | null;
  displayStatus: ShowcaseDisplayStatus;
  statusLabel: string;
  priceLabel: string;
  price: number;
  startPrice: number;
  minIncrement: number;
  capPrice?: number | null;
  /** 最低成交价，仅管理端 showcase 返回 */
  reservePrice?: number | null;
  endAt?: number;
  remainingMs?: number;
  isExplaining: boolean;
  buttonText: string;
  buttonEnabled: boolean;
  buttonAction: 'BID' | 'VIEW' | 'NONE' | 'CLOSING';
  bidCount: number;
  /** 成交后关联订单 ID，仅管理端 showcase 返回 */
  orderId?: string | null;
  /** 价格异常预警已触发，仅管理端 showcase 返回 */
  priceAlertActive?: boolean;
}

export interface LiveRoomShowcase {
  roomId: string;
  title: string;
  roomStatus: 'PREPARE' | 'LIVE' | 'ENDED';
  hostDisplayName: string;
  activeAuctionId: string | null;
  participantCount: number;
  items: ShowcaseItem[];
}
