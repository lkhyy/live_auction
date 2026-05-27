import type { Auction, Lot } from '@prisma/client';
import type { ShowcaseDisplayStatus, ShowcaseItem } from '@live-auction/shared';

type AuctionWithLot = Auction & {
  lot: Lot;
  order?: { id: string } | null;
  _count?: { bids: number };
};

interface RuleSnapshot {
  startPrice?: number;
  minIncrement?: number;
  capPrice?: number;
  reservePrice?: number;
}

export function mapToShowcaseItem(
  auction: AuctionWithLot,
  activeAuctionId: string | null,
  redis?: { currentPrice?: number; endAt?: number; bidCount?: number },
  options?: { includeReserve?: boolean; priceAlertActive?: boolean },
): ShowcaseItem {
  const rules = auction.ruleSnapshot as RuleSnapshot;
  const startPrice = Number(rules.startPrice ?? 0);
  const minIncrement = Number(rules.minIncrement ?? 1);
  const reservePrice =
    options?.includeReserve && rules.reservePrice != null
      ? Number(rules.reservePrice)
      : undefined;
  const capPrice =
    auction.capPrice != null
      ? Number(auction.capPrice)
      : rules.capPrice != null
        ? Number(rules.capPrice)
        : null;
  const dbPrice = Number(auction.currentPrice);
  const currentPrice = redis?.currentPrice ?? dbPrice;
  const bidCount = redis?.bidCount ?? auction._count?.bids ?? 0;
  const hasBids = bidCount > 0 || currentPrice > startPrice;
  const isExplaining = activeAuctionId === auction.id;

  const base = {
    auctionId: auction.id,
    sortOrder: auction.sortOrder,
    title: auction.title,
    imageUrl: auction.lot.imageUrl,
    startPrice,
    minIncrement,
    capPrice,
    reservePrice,
    isExplaining,
    bidCount,
    priceAlertActive: options?.priceAlertActive ?? false,
  };

  switch (auction.status) {
    case 'LIVE': {
      const endAt = redis?.endAt ?? auction.endAt?.getTime();
      const remainingMs = endAt ? Math.max(0, endAt - Date.now()) : undefined;
      return {
        ...base,
        displayStatus: 'BIDDING',
        statusLabel:
          remainingMs != null
            ? `竞拍中 ${formatCountdown(remainingMs)}`
            : '竞拍中',
        priceLabel: hasBids ? '当前最高价' : '起拍价',
        price: hasBids ? currentPrice : startPrice,
        endAt,
        remainingMs,
        buttonText: '立即出价',
        buttonEnabled: true,
        buttonAction: 'BID',
      };
    }
    case 'CLOSING':
      return {
        ...base,
        displayStatus: 'CLOSING',
        statusLabel: '竞拍结束',
        priceLabel: '落槌价',
        price: currentPrice,
        buttonText: '截拍中',
        buttonEnabled: true,
        buttonAction: 'CLOSING',
      };
    case 'SCHEDULED':
    case 'DRAFT':
      return {
        ...base,
        displayStatus: 'UPCOMING',
        statusLabel: '即将开拍',
        priceLabel: '起拍价',
        price: startPrice,
        buttonText: '去看看',
        buttonEnabled: true,
        buttonAction: 'VIEW',
      };
    case 'SETTLED':
      if (auction.winnerId) {
        return {
          ...base,
          displayStatus: 'SOLD',
          statusLabel: '已成交',
          priceLabel: '成交金额',
          price: currentPrice,
          buttonText: '已结束',
          buttonEnabled: false,
          buttonAction: 'NONE',
          orderId: auction.order?.id ?? null,
        };
      }
      return {
        ...base,
        displayStatus: 'FAILED',
        statusLabel: '竞拍未成交',
        priceLabel: '起拍价',
        price: startPrice,
        buttonText: '已结束',
        buttonEnabled: false,
        buttonAction: 'NONE',
      };
    case 'CANCELLED':
      return {
        ...base,
        displayStatus: 'CANCELLED',
        statusLabel: '已取消',
        priceLabel: hasBids ? '取消前价格' : '起拍价',
        price: hasBids ? currentPrice : startPrice,
        buttonText: '已取消',
        buttonEnabled: false,
        buttonAction: 'NONE',
      };
    case 'FAILED':
    default:
      return {
        ...base,
        displayStatus: 'FAILED',
        statusLabel: '竞拍未成交',
        priceLabel: '起拍价',
        price: startPrice,
        buttonText: '已结束',
        buttonEnabled: false,
        buttonAction: 'NONE',
      };
  }
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')} 结束`;
}
