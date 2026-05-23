import { useEffect, useState } from 'react';
import { getRemainingMs, useAuctionRoomStore } from '../stores/auctionRoomStore';

export function useCountdown() {
  const snapshot = useAuctionRoomStore((s) => s.snapshot);
  const clockOffset = useAuctionRoomStore((s) => s.clockOffset);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      setRemaining(getRemainingMs({ snapshot, clockOffset }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [snapshot, clockOffset]);

  const ms = remaining % 1000;
  const totalSec = Math.floor(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  return {
    remaining,
    formatted: `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0').slice(0, 3)}`,
  };
}
