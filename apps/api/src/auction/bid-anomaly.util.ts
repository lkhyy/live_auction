import {
  type AnomalyDetectionConfig,
  type AuctionRuleSnapshot,
  DEFAULT_ANOMALY_DETECTION,
} from '@live-auction/shared';

export interface BidLogEntry {
  userId: string;
  amount: number;
  prevPrice: number;
  atMs: number;
  endAtMs: number;
}

export interface AnomalyHit {
  code: string;
  category: 1 | 2 | 3 | 4 | 5;
  reason: string;
  severity: 'reject' | 'warn';
}

export interface BidAnomalyContext {
  rules: AuctionRuleSnapshot;
  amount: number;
  prevPrice: number;
  minRequired: number;
  userId: string;
  atMs: number;
  endAtMs: number;
  bidLog: BidLogEntry[];
  leaderboardAmounts: number[];
}

function getDetection(rules: AuctionRuleSnapshot): AnomalyDetectionConfig {
  return { ...DEFAULT_ANOMALY_DETECTION, ...rules.anomalyDetection };
}

function floorPrice(rules: AuctionRuleSnapshot): number {
  return rules.reservePrice ?? rules.startPrice ?? 0;
}

function appraisalPrice(rules: AuctionRuleSnapshot, det: AnomalyDetectionConfig): number | null {
  return det.range.appraisalPrice ?? rules.capPrice ?? null;
}

/** 明显笔误：相对应出价的 10 的整数幂倍偏离 */
export function isObviousTypo(amount: number, reference: number): boolean {
  if (reference <= 0) return false;
  const ratio = amount / reference;
  if (ratio >= 10) {
    let r = ratio;
    while (r >= 10 && r % 10 === 0) r /= 10;
    if (r === 1 || r === 10) return true;
  }
  if (ratio <= 0.1 && ratio > 0) {
    let r = 1 / ratio;
    while (r >= 10 && r % 10 === 0) r /= 10;
    if (r === 1 || r === 10) return true;
  }
  return false;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function isAlternatingPattern(userIds: string[], minCycles: number): boolean {
  const need = minCycles * 2;
  if (userIds.length < need) return false;
  const tail = userIds.slice(-need);
  const unique = new Set(tail);
  if (unique.size !== 2) return false;
  for (let i = 1; i < tail.length; i++) {
    if (tail[i] === tail[i - 1]) return false;
  }
  return true;
}

/** 出价前：极端值直接拒绝 */
export function validateBidBeforeAccept(ctx: BidAnomalyContext): AnomalyHit[] {
  const det = getDetection(ctx.rules);
  if (!det.enabled) return [];

  const hits: AnomalyHit[] = [];
  const { range } = det;
  const startPrice = ctx.rules.startPrice ?? 0;

  if (range.rejectExtremeValues) {
    if (ctx.amount === 0 || ctx.amount === 1) {
      hits.push({
        code: 'RANGE_EXTREME_ZERO',
        category: 1,
        reason: '报价为 0 元或 1 元，属于极端不合理值',
        severity: 'reject',
      });
    }
    if (startPrice > 0 && ctx.amount > startPrice * range.maxReasonableMultiplier) {
      hits.push({
        code: 'RANGE_EXTREME_HIGH',
        category: 1,
        reason: `报价 ¥${ctx.amount} 远超合理上限（起拍价 ${range.maxReasonableMultiplier} 倍）`,
        severity: 'reject',
      });
    }
    if (isObviousTypo(ctx.amount, ctx.minRequired)) {
      hits.push({
        code: 'RANGE_TYPO',
        category: 1,
        reason: `报价 ¥${ctx.amount} 疑似笔误（相对最低应出价 ¥${ctx.minRequired} 偏差为 10 的幂次）`,
        severity: 'reject',
      });
    }
  }

  return hits;
}

/** 出价成功后：全量异常扫描（仅预警，不自动取消） */
export function analyzeBidAnomalies(ctx: BidAnomalyContext): AnomalyHit[] {
  const det = getDetection(ctx.rules);
  if (!det.enabled) return [];

  const hits: AnomalyHit[] = [];
  const { amount, prevPrice, userId, atMs, endAtMs, bidLog, leaderboardAmounts } = ctx;
  const jump = amount - prevPrice;
  const floor = floorPrice(ctx.rules);
  const appraisal = appraisalPrice(ctx.rules, det);

  // 一、数值区间
  if (floor > 0 && amount < floor * det.range.lowPriceRatio) {
    hits.push({
      code: 'RANGE_LOW',
      category: 1,
      reason: `报价 ¥${amount} 低于最低限价 ¥${floor} 的 ${det.range.lowPriceRatio * 100}%`,
      severity: 'warn',
    });
  }
  if (appraisal != null && amount > appraisal * det.range.highPriceRatio) {
    hits.push({
      code: 'RANGE_HIGH',
      category: 1,
      reason: `报价 ¥${amount} 超过评估价 ¥${appraisal} 的 ${det.range.highPriceRatio} 倍`,
      severity: 'warn',
    });
  }

  // 二、加价幅度（jump > 0 时检测）
  if (jump > 0 && prevPrice > 0 && jump > prevPrice * det.increment.maxIncrementRatio) {
    hits.push({
      code: 'INCREMENT_LARGE_RATIO',
      category: 2,
      reason: `单次加价 ¥${jump} 超过当前价 ¥${prevPrice} 的 ${det.increment.maxIncrementRatio * 100}%`,
      severity: 'warn',
    });
  }
  if (
    jump > 0 &&
    det.increment.maxIncrementAmount != null &&
    jump > det.increment.maxIncrementAmount
  ) {
    hits.push({
      code: 'INCREMENT_LARGE_AMOUNT',
      category: 2,
      reason: `单次加价 ¥${jump} 超过允许上限 ¥${det.increment.maxIncrementAmount}`,
      severity: 'warn',
    });
  }
  if (amount < ctx.minRequired) {
    hits.push({
      code: 'INCREMENT_TOO_SMALL',
      category: 2,
      reason: `加价 ¥${jump} 低于最小加价幅度 ¥${ctx.rules.minIncrement}`,
      severity: 'warn',
    });
  }
  if (prevPrice > 0 && amount < prevPrice) {
    hits.push({
      code: 'INCREMENT_REVERSE',
      category: 2,
      reason: `反向降价：报价 ¥${amount} 低于上一轮 ¥${prevPrice}`,
      severity: 'warn',
    });
  }

  // 三、时序行为
  const windowMs = det.timing.windowSeconds * 1000;
  const inWindow = bidLog.filter((e) => atMs - e.atMs <= windowMs);
  if (inWindow.length >= det.timing.maxBidsInWindow) {
    hits.push({
      code: 'TIMING_HIGH_FREQ',
      category: 3,
      reason: `${det.timing.windowSeconds} 秒内已有 ${inWindow.length} 次出价，疑似刷屏`,
      severity: 'warn',
    });
  }
  const userInWindow = inWindow.filter((e) => e.userId === userId);
  if (userInWindow.length >= det.timing.maxUserBidsInWindow) {
    hits.push({
      code: 'TIMING_USER_SPAM',
      category: 3,
      reason: `该用户 ${det.timing.windowSeconds} 秒内连续出价 ${userInWindow.length} 次`,
      severity: 'warn',
    });
  }
  const userTotal = bidLog.filter((e) => e.userId === userId).length;
  if (userTotal >= det.timing.maxUserTotalBids) {
    hits.push({
      code: 'TIMING_USER_REPEAT',
      category: 3,
      reason: `该用户累计出价 ${userTotal} 次，频繁改价`,
      severity: 'warn',
    });
  }
  const msToEnd = endAtMs - atMs;
  if (
    msToEnd > 0 &&
    msToEnd <= det.timing.endSnipeWindowSeconds * 1000 &&
    prevPrice > 0 &&
    jump / prevPrice >= det.timing.endSnipeIncrementRatio
  ) {
    hits.push({
      code: 'TIMING_END_SNIPE',
      category: 3,
      reason: `结束前 ${det.timing.endSnipeWindowSeconds} 秒内异常跳价（涨幅 ${Math.round((jump / prevPrice) * 100)}%）`,
      severity: 'warn',
    });
  }

  // 四、串通
  if (leaderboardAmounts.length >= det.collusion.minBidders) {
    const sorted = [...leaderboardAmounts].sort((a, b) => b - a);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top > 0 && (top - bottom) / top <= det.collusion.spreadRatio) {
      hits.push({
        code: 'COLLUSION_TIGHT_SPREAD',
        category: 4,
        reason: `${det.collusion.minBidders} 人报价价差仅 ${Math.round(((top - bottom) / top) * 100)}%，疑似趋同`,
        severity: 'warn',
      });
    }
  }
  const userIds = bidLog.map((e) => e.userId);
  if (isAlternatingPattern(userIds, det.collusion.alternatingMinCycles)) {
    hits.push({
      code: 'COLLUSION_ALTERNATING',
      category: 4,
      reason: `检测到 ${det.collusion.alternatingMinCycles} 轮以上两人交替加价模式`,
      severity: 'warn',
    });
  }
  if (bidLog.length >= 2) {
    const prev = bidLog[bidLog.length - 2];
    const last = bidLog[bidLog.length - 1];
    if (
      prev.userId !== last.userId &&
      prev.prevPrice > 0 &&
      (prev.amount - prev.prevPrice) / prev.prevPrice >= det.collusion.pumpTransferRatio
    ) {
      hits.push({
        code: 'COLLUSION_PUMP_TRANSFER',
        category: 4,
        reason: '前一用户大幅抬价后被另一用户接盘，疑似配合',
        severity: 'warn',
      });
    }
  }

  // 五、统计偏离
  const allAmounts = bidLog.map((e) => e.amount);
  if (allAmounts.length >= det.stats.minSamples) {
    const m = mean(allAmounts);
    const sd = stdDev(allAmounts);
    if (sd > 0 && Math.abs(amount - m) > det.stats.stdDevMultiplier * sd) {
      hits.push({
        code: 'STATS_STD_DEV',
        category: 5,
        reason: `报价偏离均值 ${det.stats.stdDevMultiplier} 倍标准差（均值 ¥${m.toFixed(0)}）`,
        severity: 'warn',
      });
    }
  }
  if (leaderboardAmounts.length >= 2) {
    const sorted = [...new Set(leaderboardAmounts)].sort((a, b) => b - a);
    if (sorted[1] > 0 && sorted[0] / sorted[1] >= det.stats.isolationGapRatio) {
      hits.push({
        code: 'STATS_ISOLATION',
        category: 5,
        reason: `当前价 ¥${sorted[0]} 与次高价 ¥${sorted[1]} 断层明显（${(sorted[0] / sorted[1]).toFixed(1)} 倍）`,
        severity: 'warn',
      });
    }
  }

  return hits;
}

export function summarizeAnomalyHits(hits: AnomalyHit[]): string {
  return hits.map((h) => h.reason).join('；');
}
