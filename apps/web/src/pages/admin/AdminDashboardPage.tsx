import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag, Button, Space } from 'antd';
import { Link } from 'react-router-dom';
import { auctionsApi } from '../../lib/api';

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => auctionsApi.dashboard(),
    refetchInterval: 5000,
  });

  const columns = [
    { title: '场次', dataIndex: 'title', key: 'title' },
    {
      title: '商品',
      key: 'lot',
      render: (_: unknown, r: Record<string, unknown>) =>
        (r.lot as Record<string, unknown>)?.title as string,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const color: Record<string, string> = {
          LIVE: 'red',
          DRAFT: 'default',
          SETTLED: 'green',
          CANCELLED: 'orange',
        };
        return <Tag color={color[s]}>{s}</Tag>;
      },
    },
    {
      title: '当前价',
      dataIndex: 'currentPrice',
      key: 'price',
      render: (p: string) => `¥${p}`,
    },
    { title: '出价次数', key: 'bids', render: (_: unknown, r: Record<string, unknown>) => (r._count as { bids: number })?.bids ?? 0 },
    {
      title: '在线人数',
      key: 'pc',
      render: (_: unknown, r: Record<string, unknown>) =>
        r.status === 'LIVE' ? (r.participantCount as number) : '-',
    },
    {
      title: '订单',
      key: 'order',
      render: (_: unknown, r: Record<string, unknown>) => {
        const o = r.order as Record<string, unknown> | null;
        return o ? <Tag>{o.status as string}</Tag> : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: Record<string, unknown>) => (
        <Space>
          {r.status === 'LIVE' && (
            <Link to={`/m/live/${r.id as string}`}>
              <Button size="small" type="primary">
                直播间
              </Button>
            </Link>
          )}
          {r.status === 'DRAFT' && (
            <Link to="/admin/auctions">
              <Button size="small">管理</Button>
            </Link>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title="竞拍看板">
      <Table
        loading={isLoading}
        dataSource={(data as Record<string, unknown>[]) ?? []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}
