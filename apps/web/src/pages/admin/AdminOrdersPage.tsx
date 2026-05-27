import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Descriptions,
  Drawer,
  Table,
  Tag,
} from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordersApi } from '../../lib/api';

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '待付款',
  PAID: '已付款',
  CANCELLED: '已取消',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: 'orange',
  PAID: 'green',
  CANCELLED: 'default',
};

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setSelectedId(id);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'host'],
    queryFn: () => ordersApi.list(),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['orders', selectedId],
    queryFn: () => ordersApi.get(selectedId!),
    enabled: !!selectedId,
  });

  const d = detail as Record<string, unknown> | undefined;
  const auction = d?.auction as Record<string, unknown> | undefined;
  const lot = auction?.lot as Record<string, unknown> | undefined;
  const buyer = d?.buyer as Record<string, unknown> | undefined;

  const columns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 120,
      render: (id: string) => id.slice(-8).toUpperCase(),
    },
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
        <Tag color={STATUS_COLOR[s] ?? 'default'}>{STATUS_LABEL[s] ?? s}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: Record<string, unknown>) => (
        <a onClick={() => setSelectedId(r.id as string)}>查看详情</a>
      ),
    },
  ];

  return (
    <>
      <Card title="订单管理">
        <Table
          loading={isLoading}
          dataSource={(data as Record<string, unknown>[]) ?? []}
          columns={columns}
          rowKey="id"
          onRow={(r) => ({
            onClick: () => setSelectedId(r.id as string),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Drawer
        title="成交详情"
        open={!!selectedId}
        onClose={() => {
          setSelectedId(null);
          if (searchParams.get('id')) setSearchParams({});
        }}
        width={480}
        loading={detailLoading}
      >
        {d && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="订单号">{d.id as string}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR[d.status as string] ?? 'default'}>
                  {STATUS_LABEL[d.status as string] ?? (d.status as string)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="成交金额">¥{d.amount as string}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(d.createdAt as string).toLocaleString()}
              </Descriptions.Item>
              {d.paidAt != null && (
                <Descriptions.Item label="付款时间">
                  {new Date(d.paidAt as string).toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Descriptions title="买家信息" column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="昵称">{buyer?.displayName as string}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{buyer?.email as string}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="拍品信息" column={1} bordered size="small">
              <Descriptions.Item label="场次">{auction?.title as string}</Descriptions.Item>
              <Descriptions.Item label="商品">{lot?.title as string}</Descriptions.Item>
              {lot?.description != null && (
                <Descriptions.Item label="介绍">{lot.description as string}</Descriptions.Item>
              )}
              {lot?.imageUrl != null && (
                <Descriptions.Item label="图片">
                  <img
                    src={lot.imageUrl as string}
                    alt=""
                    style={{ maxWidth: 120, borderRadius: 4 }}
                  />
                </Descriptions.Item>
              )}
              <Descriptions.Item label="竞拍状态">{auction?.status as string}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </>
  );
}
