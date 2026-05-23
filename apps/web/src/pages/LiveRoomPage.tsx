import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Col,
  List,
  Row,
  Statistic,
  Typography,
  message,
} from 'antd';
import { auctionsApi } from '../lib/api';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import { useCountdown } from '../hooks/useCountdown';
import { useThrottledBid } from '../hooks/useThrottledBid';
import { useAuctionRoomStore } from '../stores/auctionRoomStore';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

export default function LiveRoomPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
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

  const statusBadge = {
    connected: 'success' as const,
    connecting: 'processing' as const,
    reconnecting: 'warning' as const,
    disconnected: 'error' as const,
  };

  const handleCancel = async () => {
    try {
      await auctionsApi.cancel(auctionId!, '主播取消异常竞拍');
      message.success('已取消竞拍');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '取消失败');
    }
  };

  const isHost =
    user?.role === 'HOST' || user?.role === 'ADMIN';

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={3} style={{ margin: 0 }}>
                  {(auction?.title as string) ?? '直播间'}
                </Title>
                <Badge
                  status={statusBadge[connectionStatus]}
                  text={`连接: ${connectionStatus}`}
                />
              </Col>
              <Col>
                <Statistic
                  title="倒计时"
                  value={formatted}
                  valueStyle={{
                    fontSize: 36,
                    fontFamily: 'monospace',
                    color: remaining < 10000 ? '#cf1322' : '#1890ff',
                  }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="当前出价">
            <Statistic
              prefix="¥"
              value={snapshot?.currentPrice ?? 0}
              precision={2}
              valueStyle={{ fontSize: 48, color: '#cf1322' }}
            />
            <Text type="secondary">
              领先: {snapshot?.leaderDisplayName ?? '—'}
            </Text>
            <div style={{ marginTop: 24 }}>
              <Button
                type="primary"
                size="large"
                block
                loading={bidPending}
                disabled={snapshot?.status !== 'LIVE'}
                onClick={bidNextIncrement}
              >
                出价 +¥{snapshot?.minIncrement ?? '—'}
              </Button>
              {snapshot?.capPrice && (
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  封顶价 ¥{snapshot.capPrice}
                </Text>
              )}
            </div>
            {isHost && snapshot?.status === 'LIVE' && (
              <Button danger block style={{ marginTop: 12 }} onClick={handleCancel}>
                取消竞拍
              </Button>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="实时排名 Top 20">
            <List
              size="small"
              dataSource={snapshot?.leaderboard ?? []}
              renderItem={(item) => (
                <List.Item>
                  <span>#{item.rank}</span>
                  <span style={{ flex: 1, marginLeft: 12 }}>{item.displayName}</span>
                  <strong>¥{item.amount}</strong>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {snapshot?.status === 'SETTLED' && (
          <Col span={24}>
            <Card type="inner" style={{ background: '#f6ffed' }}>
              竞拍已结束 — 成交价 ¥{snapshot.currentPrice}，买家{' '}
              {snapshot.leaderDisplayName ?? '流拍'}
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
