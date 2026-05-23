import { useParams, useNavigate } from 'react-router-dom';
import { Button, List, NavBar } from 'antd-mobile';
import { useQuery } from '@tanstack/react-query';
import LiveVideoLayer from '../../components/LiveVideoLayer';
import HostScriptTicker from '../../components/HostScriptTicker';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';
import { useCountdown } from '../../hooks/useCountdown';
import { useThrottledBid } from '../../hooks/useThrottledBid';
import { useAuctionRoomStore } from '../../stores/auctionRoomStore';
import { useAuthStore } from '../../stores/authStore';
import { auctionsApi } from '../../lib/api';

export default function MobileLiveRoomPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  useAuctionSocket(auctionId, user?.id);

  const { data: auction } = useQuery({
    queryKey: ['auction', auctionId],
    queryFn: () => auctionsApi.get(auctionId!),
    enabled: !!auctionId,
  });

  const snapshot = useAuctionRoomStore((s) => s.snapshot);
  const connectionStatus = useAuctionRoomStore((s) => s.connectionStatus);
  const { formatted, remaining } = useCountdown();
  const { bidNextIncrement, bidPending } = useThrottledBid(auctionId!);

  const isLive = snapshot?.status === 'LIVE';

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff' }}>
      <NavBar onBack={() => navigate('/m')} style={{ color: '#fff', '--border-bottom': 'none' }}>
        {(auction as Record<string, unknown>)?.title as string ?? '直播间'}
      </NavBar>
      <LiveVideoLayer />
      <HostScriptTicker running={isLive} />
      <div style={{ padding: 12, background: 'linear-gradient(transparent, #1a1a1a)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {connectionStatus} · {snapshot?.participantCount ?? 0} 人在线
          </span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 28,
              color: remaining < 10000 ? '#ff4d4f' : '#69b1ff',
            }}
          >
            {formatted}
          </span>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#ff4d4f', margin: '8px 0' }}>
          ¥{snapshot?.currentPrice ?? 0}
        </div>
        <div style={{ fontSize: 14, marginBottom: 12 }}>
          领先：{snapshot?.leaderDisplayName ?? '—'}
          {snapshot?.startPrice != null && (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              起拍 ¥{snapshot.startPrice}
            </span>
          )}
        </div>
        <Button
          block
          color="danger"
          size="large"
          loading={bidPending}
          disabled={!isLive}
          onClick={bidNextIncrement}
        >
          出价 +¥{snapshot?.minIncrement ?? '—'}
        </Button>
        {snapshot?.status === 'SETTLED' && (
          <Button
            block
            color="primary"
            style={{ marginTop: 12 }}
            onClick={() => navigate('/m/orders')}
          >
            查看我的订单
          </Button>
        )}
        <List header="排名" style={{ marginTop: 16, color: '#fff' }}>
          {(snapshot?.leaderboard ?? []).slice(0, 10).map((item) => (
            <List.Item
              key={item.userId}
              extra={<strong>¥{item.amount}</strong>}
            >
              #{item.rank} {item.displayName}
            </List.Item>
          ))}
        </List>
      </div>
    </div>
  );
}
