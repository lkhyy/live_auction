import { z } from 'zod';

/** @deprecated 旧版预警，读取时自动迁移到 anomalyDetection */
export const priceAlertSchema = z.object({
  enabled: z.boolean().default(false),
  multiplier: z.number().positive().optional(),
  absoluteThreshold: z.number().positive().optional(),
});

export const anomalyRangeSchema = z.object({
  /** 报价 < 最低限价 × 此比例 → 异常低价（最低限价=reservePrice 或 startPrice） */
  lowPriceRatio: z.number().min(0).max(1).default(0.9),
  /** 报价 > 评估价 × 此比例 → 异常高价（评估价=appraisalPrice 或 capPrice） */
  highPriceRatio: z.number().min(1).default(2),
  /** 评估价；未填则用 capPrice */
  appraisalPrice: z.number().positive().optional(),
  /** 拒绝 0/1 元及明显笔误出价 */
  rejectExtremeValues: z.boolean().default(true),
  /** 报价 > 起拍价 × 此倍数 → 极端高价 */
  maxReasonableMultiplier: z.number().positive().default(1000),
});

export const anomalyIncrementSchema = z.object({
  /** 单次涨幅 > 当前价 × 此比例 → 异常跳价 */
  maxIncrementRatio: z.number().positive().default(0.5),
  /** 单次涨幅 > 此固定金额 → 异常跳价（可选） */
  maxIncrementAmount: z.number().positive().optional(),
});

export const anomalyTimingSchema = z.object({
  windowSeconds: z.number().int().positive().default(10),
  /** 窗口内全场出价次数上限 */
  maxBidsInWindow: z.number().int().positive().default(5),
  /** 窗口内单用户出价次数上限 */
  maxUserBidsInWindow: z.number().int().positive().default(3),
  /** 结束前 N 秒内的狙击窗口 */
  endSnipeWindowSeconds: z.number().int().positive().default(30),
  /** 狙击窗口内单次涨幅 > 当前价 × 此比例 → 异常 */
  endSnipeIncrementRatio: z.number().positive().default(0.5),
  /** 单用户累计出价次数过多 → 频繁改价 */
  maxUserTotalBids: z.number().int().positive().default(20),
});

export const anomalyCollusionSchema = z.object({
  minBidders: z.number().int().positive().default(3),
  /** 前几名报价价差 / 最高价 ≤ 此比例 → 高度趋同 */
  spreadRatio: z.number().min(0).max(1).default(0.05),
  /** A-B-A-B 交替最少轮数 */
  alternatingMinCycles: z.number().int().positive().default(3),
  /** 接盘检测：被超越前涨幅 ≥ 此比例 */
  pumpTransferRatio: z.number().positive().default(0.3),
});

export const anomalyStatsSchema = z.object({
  minSamples: z.number().int().positive().default(5),
  stdDevMultiplier: z.number().positive().default(3),
  /** 当前价 / 次高价 ≥ 此比例 → 孤立点 */
  isolationGapRatio: z.number().positive().default(2),
});

export const anomalyDetectionSchema = z.object({
  enabled: z.boolean().default(true),
  range: anomalyRangeSchema.default({}),
  increment: anomalyIncrementSchema.default({}),
  timing: anomalyTimingSchema.default({}),
  collusion: anomalyCollusionSchema.default({}),
  stats: anomalyStatsSchema.default({}),
});

export const softCloseSchema = z.object({
  enabled: z.boolean().default(true),
  extensionSeconds: z.union([
    z.literal(10),
    z.literal(15),
    z.literal(20),
    z.literal(30),
  ]),
  triggerWindowSeconds: z.number().int().min(1).max(120).default(30),
  maxTotalExtensionSeconds: z.number().int().min(0).default(600),
});

function migrateLegacyPriceAlert(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.anomalyDetection || !raw.priceAlert) return raw;
  const pa = raw.priceAlert as { enabled?: boolean; multiplier?: number; absoluteThreshold?: number };
  return {
    ...raw,
    anomalyDetection: {
      enabled: pa.enabled ?? false,
      range: {
        highPriceRatio: pa.multiplier ?? 2,
        appraisalPrice: pa.absoluteThreshold,
      },
    },
  };
}

const auctionRuleSnapshotInner = z.object({
  startPrice: z.number().min(0).default(0),
  minIncrement: z.number().positive(),
  reservePrice: z.number().positive().optional(),
  capPrice: z.number().positive().optional(),
  durationSeconds: z.number().int().positive().default(300),
  softClose: softCloseSchema,
  allowHostCancel: z.boolean().default(true),
  anomalyDetection: anomalyDetectionSchema.optional(),
  priceAlert: priceAlertSchema.optional(),
});

export const auctionRuleSnapshotSchema = z.preprocess(
  (val) => (val && typeof val === 'object' ? migrateLegacyPriceAlert(val as Record<string, unknown>) : val),
  auctionRuleSnapshotInner,
);

export type AuctionRuleSnapshot = z.infer<typeof auctionRuleSnapshotInner>;
export type SoftCloseConfig = z.infer<typeof softCloseSchema>;
export type PriceAlertConfig = z.infer<typeof priceAlertSchema>;
export type AnomalyDetectionConfig = z.infer<typeof anomalyDetectionSchema>;

export const createAuctionSchema = z.object({
  lotId: z.string().uuid(),
  title: z.string().min(1).max(200),
  rules: auctionRuleSnapshotSchema,
  scheduledStartAt: z.string().datetime().optional(),
});

export const placeBidSchema = z.object({
  amount: z.number().min(0),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
export type PlaceBidInput = z.infer<typeof placeBidSchema>;

/** 默认异常检测配置 */
export const DEFAULT_ANOMALY_DETECTION: AnomalyDetectionConfig = {
  enabled: true,
  range: {
    lowPriceRatio: 0.9,
    highPriceRatio: 2,
    rejectExtremeValues: true,
    maxReasonableMultiplier: 1000,
  },
  increment: { maxIncrementRatio: 0.5 },
  timing: {
    windowSeconds: 10,
    maxBidsInWindow: 5,
    maxUserBidsInWindow: 3,
    endSnipeWindowSeconds: 30,
    endSnipeIncrementRatio: 0.5,
    maxUserTotalBids: 20,
  },
  collusion: {
    minBidders: 3,
    spreadRatio: 0.05,
    alternatingMinCycles: 3,
    pumpTransferRatio: 0.3,
  },
  stats: {
    minSamples: 5,
    stdDevMultiplier: 3,
    isolationGapRatio: 2,
  },
};
