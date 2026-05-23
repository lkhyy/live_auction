import { useQuery } from '@tanstack/react-query';
import { Button, Card, List, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { auctionsApi } from '../lib/api';

export default function AuctionListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => auctionsApi.list(),
    refetchInterval: 5000,
  });

  const statusColor: Record<string, string> = {
    LIVE: 'red',
    DRAFT: 'default',
    SETTLED: 'green',
    CANCELLED: 'orange',
  };

  return (
    <Card title="竞拍大厅">
      <List
        loading={isLoading}
        dataSource={(data as Array<Record<string, unknown>>) ?? []}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Link key="join" to={`/live/${item.id as string}`}>
                <Button type={item.status === 'LIVE' ? 'primary' : 'default'}>
                  {item.status === 'LIVE' ? '进入直播间' : '查看'}
                </Button>
              </Link>,
            ]}
          >
            <List.Item.Meta
              title={item.title as string}
              description={
                <>
                  <Tag color={statusColor[item.status as string]}>{item.status as string}</Tag>
                  当前价 ¥{String(item.currentPrice)}
                </>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
