import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag, Button, Space } from 'antd';
import { Link } from 'react-router-dom';
import { userAppUrl } from '../../lib/appConfig';
import { auctionsApi } from '../../lib/api';
import AdminLoadError from '../../components/AdminLoadError';
import { useAdminApiReady } from '../../hooks/useAdminApiReady';

const STATUS_LABEL: Record<string, string> = {
  LIVE: '竞拍中',
  DRAFT: '草稿',
  SCHEDULED: '待开拍',
  SETTLED: '已结束',
  CANCELLED: '已取消',
  CLOSING: '截拍中',
  FAILED: '流拍',
};

export default function AdminDashboardPage() {
  const apiReady = useAdminApiReady();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => auctionsApi.dashboard(),
    enabled: apiReady,
    refetchInterval: apiReady ? 5000 : false,
    retry: 1,
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
          SCHEDULED: 'blue',
          SETTLED: 'green',
          CANCELLED: 'orange',
          FAILED: 'default',
        };
        return <Tag color={color[s]}>{STATUS_LABEL[s] ?? s}</Tag>;
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
        if (!o) return '-';
        return (
          <Link to={`/orders?id=${o.id as string}`}>
            <Tag>{o.status as string}</Tag>
          </Link>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: Record<string, unknown>) => (
        <Space>
          {r.roomId != null && (
            <Link to="/">
              <Button size="small">控制台</Button>
            </Link>
          )}
          {r.status === 'LIVE' && (
            <a href={`${userAppUrl()}/m/room/${r.roomId as string}`} target="_blank" rel="noreferrer">
              <Button size="small" type="primary">
                用户端预览
              </Button>
            </a>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title="竞拍看板">
      <AdminLoadError error={isError ? (error as Error) : null} title="竞拍看板加载失败" />
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
