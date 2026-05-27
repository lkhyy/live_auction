import { useEffect, useState } from 'react';
import type { ShowcaseItem } from '@live-auction/shared';

/** 与服务端 showcase.mapper formatCountdown 一致 */
export function formatShowcaseCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')} 结束`;
}

/**
 * 橱窗竞拍中商品的实时倒计时文案（本地按 endAt 递减，不依赖 3s 轮询）
 */
export function useShowcaseCountdownLabel(item: ShowcaseItem): string {
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    resolveRemainingMs(item),
  );

  useEffect(() => {
    if (item.displayStatus !== 'BIDDING') {
      setRemainingMs(null);
      return;
    }

    const tick = () => setRemainingMs(resolveRemainingMs(item));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [item.displayStatus, item.endAt, item.auctionId, item.remainingMs]);

  if (item.displayStatus === 'BIDDING' && remainingMs != null) {
    return `竞拍中 ${formatShowcaseCountdownMs(remainingMs)}`;
  }
  return item.statusLabel;
}

function resolveRemainingMs(item: ShowcaseItem): number | null {
  if (item.endAt != null) {
    return Math.max(0, item.endAt - Date.now());
  }
  if (item.remainingMs != null) {
    return Math.max(0, item.remainingMs);
  }
  return null;
}
