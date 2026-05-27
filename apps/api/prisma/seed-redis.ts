import Redis from 'ioredis';
import type { AuctionRuleSnapshot } from '@live-auction/shared';

function keys(auctionId: string) {
  return {
    state: `auction:${auctionId}:state`,
    bids: `auction:${auctionId}:bids`,
    seq: `auction:${auctionId}:seq`,
  };
}

/** 与 RedisService.initAuctionState 对齐，供 seed 演示 LIVE 拍品（无预置出价/排名） */
export async function seedAuctionRedis(
  redis: Redis,
  auctionId: string,
  rules: AuctionRuleSnapshot,
  endAtMs: number,
): Promise<void> {
  const k = keys(auctionId);
  const startPrice = rules.startPrice ?? 0;
  const pipeline = redis.pipeline();
  pipeline.del(k.state, k.bids, k.seq);
  pipeline.hset(k.state, {
    status: 'LIVE',
    startPrice,
    currentPrice: startPrice,
    leaderId: '',
    leaderDisplayName: '',
    previousLeaderId: '',
    endAt: endAtMs,
    version: 0,
    totalExtendedMs: 0,
    minIncrement: rules.minIncrement,
    capPrice: rules.capPrice ?? '',
  });
  pipeline.set(k.seq, 0);
  await pipeline.exec();
}

export function createSeedRedis(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, { maxRetriesPerRequest: 1 });
}
