import type { AuctionRuleSnapshot } from '../schemas/auction-rules';

/** 用户端 API 响应中移除最低成交价 */
export function stripReservePrice(rules: AuctionRuleSnapshot): AuctionRuleSnapshot {
  const { reservePrice: _, ...rest } = rules;
  return rest as AuctionRuleSnapshot;
}
