import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag } from 'antd';
import { ordersApi } from '../../lib/api';

export default function AdminOrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'host'],
    queryFn: () => ordersApi.list(),
  });

  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id', ellipsis: true, width: 120 },
    {
      title: '场次',
      key: 'auction',
      render: (_: unknown, r: Record<string, unknown>) =>
        (r.auction as Record<string, unknown>)?.title as string,
    },
    {
      title: '买家',
      key: 'buyer',
      render: (_: unknown, r: Record<string, unknown>) =>
        (r.buyer as Record<string, unknown>)?.displayName as string,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (a: string) => `¥${a}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={s === 'PAID' ? 'green' : 'orange'}>{s}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
  ];

  return (
    <Card title="订单管理">
      <Table
        loading={isLoading}
        dataSource={(data as Record<string, unknown>[]) ?? []}
        columns={columns}
        rowKey="id"
      />
    </Card>
  );
}
