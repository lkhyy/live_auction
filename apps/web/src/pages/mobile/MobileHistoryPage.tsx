import { useQuery } from '@tanstack/react-query';
import { Card, List, Tag } from 'antd-mobile';
import { meApi } from '../../lib/api';

export default function MobileHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-bids'],
    queryFn: () => meApi.bids(),
  });

  const bids = (data as Array<Record<string, unknown>>) ?? [];

  return (
    <div>
      <h2 style={{ margin: '0 0 12px' }}>出价记录</h2>
      {isLoading && <Card>加载中...</Card>}
      <List>
        {bids.map((b) => {
          const auction = b.auction as Record<string, unknown>;
          return (
            <List.Item
              key={b.id as string}
              description={new Date(b.createdAt as string).toLocaleString()}
              extra={<strong>¥{String(b.amount)}</strong>}
            >
              <Tag>{auction?.status as string}</Tag>{' '}
              {auction?.title as string}
            </List.Item>
          );
        })}
      </List>
      {!isLoading && bids.length === 0 && (
        <Card style={{ textAlign: 'center', color: '#999' }}>暂无出价记录</Card>
      )}
    </div>
  );
}
