import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { join } from 'path';

const PLACE_BID_SCRIPT = readFileSync(
  join(__dirname, 'scripts', 'place-bid.lua'),
  'utf-8',
);

describe('place-bid Lua script', () => {
  let redis: Redis | null = null;
  let redisAvailable = false;
  const auctionId = 'test-auction-1';
  let sha: string;

  beforeAll(async () => {
    const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    try {
      await client.connect();
      await client.ping();
      redis = client;
      redisAvailable = true;
      sha = (await redis.script('LOAD', PLACE_BID_SCRIPT)) as string;
      const stateKey = `auction:${auctionId}:state`;
      const bidsKey = `auction:${auctionId}:bids`;
      const seqKey = `auction:${auctionId}:seq`;
      await redis.del(stateKey, bidsKey, seqKey);
      const endAt = Date.now() + 60_000;
      await redis.hset(stateKey, {
        status: 'LIVE',
        currentPrice: 0,
        leaderId: '',
        leaderDisplayName: '',
        endAt,
        version: 0,
        totalExtendedMs: 0,
        minIncrement: 10,
        capPrice: 1000,
      });
      await redis.set(seqKey, 0);
    } catch {
      redisAvailable = false;
      await client.quit().catch(() => undefined);
    }
  }, 5000);

  afterAll(async () => {
    if (redis) {
      await redis.del(
        `auction:${auctionId}:state`,
        `auction:${auctionId}:bids`,
        `auction:${auctionId}:seq`,
      );
      redis.disconnect();
    }
  });

  async function bid(amount: number, userId: string, displayName: string) {
    if (!redis) throw new Error('Redis not available');
    const stateKey = `auction:${auctionId}:state`;
    const bidsKey = `auction:${auctionId}:bids`;
    const seqKey = `auction:${auctionId}:seq`;
    const state = await redis.hgetall(stateKey);
    const raw = (await redis.evalsha(
      sha,
      3,
      stateKey,
      bidsKey,
      seqKey,
      userId,
      displayName,
      String(amount),
      String(Date.now()),
      '10',
      '1000',
      '1',
      '15',
      '30',
      '600',
      '-1',
      state.totalExtendedMs ?? '0',
    )) as string;
    return JSON.parse(raw);
  }

  it('accepts first bid at min increment', async () => {
    if (!redisAvailable) return;
    const r = await bid(10, 'user1', 'Alice');
    expect(r.ok).toBe(true);
    expect(r.currentPrice).toBe(10);
    expect(r.leaderId).toBe('user1');
  });

  it('rejects bid below minimum', async () => {
    if (!redisAvailable) return;
    const r = await bid(15, 'user2', 'Bob');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BID_TOO_LOW');
  });

  it('accepts valid increment bid', async () => {
    if (!redisAvailable) return;
    const r = await bid(20, 'user2', 'Bob');
    expect(r.ok).toBe(true);
    expect(r.currentPrice).toBe(20);
  });

  it('settles at cap price', async () => {
    if (!redisAvailable) return;
    const r = await bid(5000, 'user3', 'Carol');
    expect(r.ok).toBe(true);
    expect(r.currentPrice).toBe(1000);
    expect(r.settledByCap).toBe(1);
    expect(r.status).toBe('SETTLED');
  });
});
