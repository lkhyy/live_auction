import { useQuery } from '@tanstack/react-query';
import { Button, Card, Image, List, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import type { MyParticipation } from '@live-auction/shared';
import { QueryErrorCard } from '../../components/QueryErrorCard';
import { isUnauthorizedError, meApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

const AUCTION_STATUS: Record<string, { label: string; color: 'danger' | 'success' | 'default' }> = {
  LIVE: { label: '竞拍中', color: 'danger' },
  ENDED: { label: '已结束', color: 'default' },
  CANCELLED: { label: '已取消', color: 'default' },
};

function resolveTarget(p: MyParticipation): string {
  if (p.roomId && p.roomStatus === 'LIVE') {
    return `/m/room/${p.roomId}`;
  }
  if (p.status === 'LIVE') {
    return p.roomId
      ? `/m/live/${p.auctionId}?roomId=${p.roomId}`
      : `/m/live/${p.auctionId}`;
  }
  return p.roomId
    ? `/m/auctions/${p.auctionId}?roomId=${p.roomId}`
    : `/m/auctions/${p.auctionId}`;
}

export default function MobileParticipationsPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-participations'],
    queryFn: () => meApi.participations(),
    enabled: !!token,
    refetchInterval: (query) => (isUnauthorizedError(query.state.error) ? false : 5000),
    retry: (count, err) => !isUnauthorizedError(err) && count < 2,
  });

  const items = (data as MyParticipation[]) ?? [];

  return (
    <div>
      <h2 style={{ margin: '0 0 12px' }}>我参与的</h2>
      {isError && <QueryErrorCard error={error} onRetry={() => void refetch()} />}
      {isLoading && !isError && <Card>加载中...</Card>}
      <List>
        {items.map((p) => {
          const statusMeta = AUCTION_STATUS[p.status] ?? { label: p.status, color: 'default' as const };
          return (
            <List.Item
              key={p.auctionId}
              prefix={
                p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    width={56}
                    height={56}
                    fit="cover"
                    style={{ borderRadius: 6 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 6,
                      background: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#bbb',
                      fontSize: 12,
                    }}
                  >
                    无图
                  </div>
                )
              }
              description={
                <div style={{ marginTop: 4 }}>
                  <Tag color={statusMeta.color} style={{ marginRight: 6 }}>
                    {statusMeta.label}
                  </Tag>
                  {p.status === 'LIVE' && (
                    <Tag color={p.isLeading ? 'success' : 'warning'}>
                      {p.isLeading ? '领先中' : '被超越'}
                    </Tag>
                  )}
                  <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
                    我的出价 ¥{p.myMaxBid} · 当前 ¥{p.currentPrice}
                  </div>
                  {p.roomTitle && (
                    <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                      {p.roomTitle}
                    </div>
                  )}
                </div>
              }
              extra={
                p.orderStatus === 'PENDING_PAYMENT' ? (
                  <Button
                    size="small"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/m/orders');
                    }}
                  >
                    去支付
                  </Button>
                ) : null
              }
              onClick={() => navigate(resolveTarget(p))}
            >
              {p.title}
            </List.Item>
          );
        })}
      </List>
      {!isLoading && !isError && items.length === 0 && (
        <Card style={{ textAlign: 'center', color: '#999' }}>暂无参与记录，去直播大厅看看吧</Card>
      )}
    </div>
  );
}
