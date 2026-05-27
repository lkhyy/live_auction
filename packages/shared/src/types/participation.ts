export interface MyParticipation {
  auctionId: string;
  title: string;
  status: string;
  currentPrice: string;
  myMaxBid: string;
  isLeading: boolean;
  lastBidAt: string;
  roomId: string | null;
  roomTitle: string | null;
  roomStatus: string | null;
  imageUrl: string | null;
  orderStatus: string | null;
}
