import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, List, Tag } from 'antd-mobile';
import { auctionsApi } from '../../lib/api';

export default function MobileAuctionDetailPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['auction', auctionId],
    queryFn: () => auctionsApi.get(auctionId!),
    enabled: !!auctionId,
  });

  if (isLoading || !data) return <Card>加载中...</Card>;

  const auction = data as Record<string, unknown>;
  const rules = auction.rules as Record<string, unknown> | undefined;
  const lot = auction.lot as Record<string, unknown> | undefined;

  return (
    <div>
      <Card title={auction.title as string}>
        {typeof lot?.imageUrl === 'string' && lot.imageUrl && (
          <img
            src={lot.imageUrl}
            alt=""
            style={{ width: '100%', borderRadius: 8, marginBottom: 12 }}
          />
        )}
        <p>{(lot?.description as string) ?? '暂无介绍'}</p>
        <List header="规则">
          <List.Item extra={`¥${rules?.startPrice ?? 0}`}>起拍价</List.Item>
          <List.Item extra={`¥${rules?.minIncrement}`}>加价幅度</List.Item>
          <List.Item extra={rules?.capPrice ? `¥${rules.capPrice}` : '无'}>封顶价</List.Item>
          <List.Item extra={`${rules?.durationSeconds ?? '-'}秒`}>时长</List.Item>
        </List>
        <p>
          <Tag color="primary">{auction.status as string}</Tag>
          <span style={{ marginLeft: 8 }}>{auction.participantCount as number} 人在线</span>
        </p>
        <p style={{ fontSize: 24, color: '#cf1322', fontWeight: 700 }}>
          当前价 ¥{String(auction.currentPrice)}
        </p>
      </Card>
      {auction.status === 'LIVE' && (
        <Button
          block
          color="primary"
          size="large"
          style={{ marginTop: 16 }}
          onClick={() => navigate(`/m/live/${auctionId}`)}
        >
          进入直播间
        </Button>
      )}
    </div>
  );
}
