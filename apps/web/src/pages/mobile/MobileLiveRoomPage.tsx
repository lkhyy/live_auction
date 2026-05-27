import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, NavBar } from 'antd-mobile';
import { useQuery } from '@tanstack/react-query';
import LiveVideoLayer from '../../components/LiveVideoLayer';
import HostScriptTicker from '../../components/HostScriptTicker';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';
import { useCountdown } from '../../hooks/useCountdown';
import { useThrottledBid, computeNextBidAmount } from '../../hooks/useThrottledBid';
import { useAuctionRoomStore } from '../../stores/auctionRoomStore';
import { useAuthStore } from '../../stores/authStore';
import { auctionsApi } from '../../lib/api';

export default function MobileLiveRoomPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');
  const navigate = useNavigate();

  const goBack = () => {
    if (roomId) {
      navigate(`/m/room/${roomId}`);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/m');
  };
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isBuyer = !!user && user.role === 'BUYER';
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

  const nextBid = snapshot ? computeNextBidAmount(snapshot) : null;

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff' }}>
      <NavBar onBack={goBack} style={{ color: '#fff', '--border-bottom': 'none' }}>
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
          onClick={() => {
            if (!token || !isBuyer) {
              navigate('/login', {
                state: {
                  from: roomId
                    ? `/m/live/${auctionId}?roomId=${roomId}`
                    : `/m/live/${auctionId}`,
                },
              });
              return;
            }
            bidNextIncrement();
          }}
        >
          {!token || !isBuyer
            ? '登录后出价'
            : nextBid != null
              ? `出价 ¥${nextBid}`
              : `加价 ¥${snapshot?.minIncrement ?? '—'}`}
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
        <section style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#fff' }}>
            排名
          </div>
          {(snapshot?.leaderboard ?? []).slice(0, 10).map((item) => (
            <div
              key={item.userId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 14,
              }}
            >
              <span>
                #{item.rank}{' '}
                {item.displayName?.trim() || '买家'}
              </span>
              <strong style={{ color: '#ff7875' }}>¥{item.amount}</strong>
            </div>
          ))}
          {(snapshot?.leaderboard ?? []).length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, padding: '8px 0' }}>
              暂无出价
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
