import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { auctionsApi } from '../lib/api';
import { useAuctionRoomStore } from '../stores/auctionRoomStore';
import { message } from 'antd';
import { Toast } from 'antd-mobile';

const THROTTLE_MS = 400;

function showError(msg: string) {
  if (window.location.pathname.startsWith('/m')) {
    Toast.show({ icon: 'fail', content: msg });
  } else {
    message.error(msg);
  }
}

/** 计算下一口价：0 元起拍时首笔可为 0 */
export function computeNextBidAmount(snapshot: {
  startPrice: number;
  minIncrement: number;
  currentPrice: number;
  leaderId?: string | null;
  leaderboard?: unknown[] | null;
}): number {
  const startPrice = Number(snapshot.startPrice) || 0;
  const minIncrement = Number(snapshot.minIncrement) || 1;
  const currentPrice = Number(snapshot.currentPrice) || 0;
  const hasBids =
    (snapshot.leaderboard?.length ?? 0) > 0 ||
    !!snapshot.leaderId ||
    currentPrice > startPrice;

  if (!hasBids) {
    return startPrice;
  }
  return currentPrice + minIncrement;
}

export function useThrottledBid(auctionId: string) {
  const lastBidRef = useRef(0);
  const { snapshot, bidPending, setBidPending } = useAuctionRoomStore();

  const placeBid = useCallback(
    async (amount: number) => {
      const now = Date.now();
      if (now - lastBidRef.current < THROTTLE_MS) return;
      if (bidPending) return;
      if (!snapshot || snapshot.status !== 'LIVE') {
        showError('竞拍未进行中');
        return;
      }

      lastBidRef.current = now;
      setBidPending(true);

      try {
        const result = await auctionsApi.placeBid(
          auctionId,
          amount,
          snapshot.version,
          uuidv4(),
        );
        if (result.success && result.snapshot) {
          useAuctionRoomStore.getState().setSnapshot(result.snapshot);
        } else {
          showError(result.errorCode ?? '出价失败');
          if (result.snapshot) {
            useAuctionRoomStore.getState().setSnapshot(result.snapshot);
          }
        }
      } catch (e) {
        showError(e instanceof Error ? e.message : '出价失败');
        try {
          const fresh = await auctionsApi.snapshot(auctionId);
          useAuctionRoomStore.getState().setSnapshot(fresh);
        } catch {
          /* ignore */
        }
      } finally {
        setBidPending(false);
      }
    },
    [auctionId, snapshot, bidPending, setBidPending],
  );

  const bidNextIncrement = useCallback(() => {
    if (!snapshot) return;
    const next = computeNextBidAmount(snapshot);
    if (!Number.isFinite(next) || next < 0) {
      showError('无法计算出价金额，请刷新后重试');
      return;
    }
    void placeBid(next);
  }, [snapshot, placeBid]);

  return { placeBid, bidNextIncrement, bidPending };
}
