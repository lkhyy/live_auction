import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANOMALY_DETECTION,
  type AuctionRuleSnapshot,
} from '@live-auction/shared';
import {
  analyzeBidAnomalies,
  isObviousTypo,
  validateBidBeforeAccept,
} from './bid-anomaly.util';

const baseRules: AuctionRuleSnapshot = {
  startPrice: 100,
  minIncrement: 10,
  reservePrice: 200,
  capPrice: 1000,
  durationSeconds: 600,
  softClose: {
    enabled: true,
    extensionSeconds: 15,
    triggerWindowSeconds: 30,
    maxTotalExtensionSeconds: 600,
  },
  allowHostCancel: true,
  anomalyDetection: { ...DEFAULT_ANOMALY_DETECTION, enabled: true },
};

function ctx(overrides: Partial<Parameters<typeof analyzeBidAnomalies>[0]> = {}) {
  return {
    rules: baseRules,
    amount: 500,
    prevPrice: 400,
    minRequired: 410,
    userId: 'u1',
    atMs: 100_000,
    endAtMs: 130_000,
    bidLog: [],
    leaderboardAmounts: [500, 490, 480],
    ...overrides,
  };
}

describe('validateBidBeforeAccept', () => {
  it('rejects 0 and 1 yuan', () => {
    const hits = validateBidBeforeAccept(ctx({ amount: 1, minRequired: 100 }));
    expect(hits.some((h) => h.code === 'RANGE_EXTREME_ZERO')).toBe(true);
  });

  it('rejects obvious typo', () => {
    expect(isObviousTypo(1100, 110)).toBe(true);
    const hits = validateBidBeforeAccept(ctx({ amount: 1100, minRequired: 110 }));
    expect(hits.some((h) => h.code === 'RANGE_TYPO')).toBe(true);
  });
});

describe('analyzeBidAnomalies', () => {
  it('detects low price below floor ratio', () => {
    const hits = analyzeBidAnomalies(ctx({ amount: 150, prevPrice: 140, minRequired: 150 }));
    expect(hits.some((h) => h.code === 'RANGE_LOW')).toBe(true);
  });

  it('detects high price above appraisal ratio', () => {
    const hits = analyzeBidAnomalies(ctx({ amount: 2100, prevPrice: 2000, minRequired: 2010 }));
    expect(hits.some((h) => h.code === 'RANGE_HIGH')).toBe(true);
  });

  it('detects large increment jump', () => {
    const hits = analyzeBidAnomalies(ctx({ amount: 700, prevPrice: 400, minRequired: 410 }));
    expect(hits.some((h) => h.code === 'INCREMENT_LARGE_RATIO')).toBe(true);
  });

  it('detects high frequency bidding', () => {
    const log = Array.from({ length: 5 }, (_, i) => ({
      userId: `u${i}`,
      amount: 100 + i * 10,
      prevPrice: 90 + i * 10,
      atMs: 95_000 + i * 1000,
      endAtMs: 130_000,
    }));
    const hits = analyzeBidAnomalies(ctx({ bidLog: log, atMs: 100_000 }));
    expect(hits.some((h) => h.code === 'TIMING_HIGH_FREQ')).toBe(true);
  });

  it('detects alternating collusion pattern', () => {
    const log = ['a', 'b', 'a', 'b', 'a', 'b'].map((userId, i) => ({
      userId,
      amount: 200 + i * 10,
      prevPrice: 190 + i * 10,
      atMs: 80_000 + i * 2000,
      endAtMs: 130_000,
    }));
    const hits = analyzeBidAnomalies(ctx({ bidLog: log }));
    expect(hits.some((h) => h.code === 'COLLUSION_ALTERNATING')).toBe(true);
  });

  it('skips when detection disabled', () => {
    const hits = analyzeBidAnomalies(
      ctx({
        rules: {
          ...baseRules,
          anomalyDetection: { ...DEFAULT_ANOMALY_DETECTION, enabled: false },
        },
      }),
    );
    expect(hits).toHaveLength(0);
  });
});
