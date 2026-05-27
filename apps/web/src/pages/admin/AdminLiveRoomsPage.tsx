import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { useState } from 'react';
import { userAppUrl } from '../../lib/appConfig';
import type { LiveRoomShowcase, ShowcaseItem } from '@live-auction/shared';
import { auctionsApi, liveRoomsApi } from '../../lib/api';

const STATUS_COLOR: Record<string, string> = {
  PREPARE: 'default',
  LIVE: 'red',
  ENDED: 'default',
};

export default function AdminLiveRoomsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['live-rooms', 'admin'],
    queryFn: () => liveRoomsApi.list(),
  });

  const { data: showcase } = useQuery({
    queryKey: ['showcase', selectedId],
    queryFn: () => liveRoomsApi.showcase(selectedId!),
    enabled: !!selectedId,
    refetchInterval: selectedId ? 5000 : false,
  });

  const { data: auctions } = useQuery({
    queryKey: ['auctions', 'admin'],
    queryFn: () => auctionsApi.list(),
  });

  const roomList = (rooms as Array<Record<string, unknown>>) ?? [];
  const selectedRoom = roomList.find((r) => r.id === selectedId);
  const sc = showcase as LiveRoomShowcase | undefined;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['live-rooms'] });
    void qc.invalidateQueries({ queryKey: ['showcase', selectedId] });
    void qc.invalidateQueries({ queryKey: ['auctions'] });
  };

  const createMutation = useMutation({
    mutationFn: (title: string) => liveRoomsApi.create(title),
    onSuccess: (room) => {
      message.success('直播场次已创建');
      setCreateOpen(false);
      form.resetFields();
      setSelectedId(room.id as string);
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const goLiveMutation = useMutation({
    mutationFn: (roomId: string) => liveRoomsApi.goLive(roomId),
    onSuccess: () => {
      message.success('房间已开播，已切换到第一件拍品');
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const switchMutation = useMutation({
    mutationFn: ({ roomId, auctionId }: { roomId: string; auctionId: string }) =>
      liveRoomsApi.switchAuction(roomId, auctionId),
    onSuccess: () => {
      message.success('已切换讲解拍品');
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: ({
      roomId,
      auctionId,
      sortOrder,
    }: {
      roomId: string;
      auctionId: string;
      sortOrder?: number;
    }) => liveRoomsApi.addAuction(roomId, auctionId, sortOrder),
    onSuccess: () => {
      message.success('拍品已加入橱窗');
      setAddOpen(false);
      addForm.resetFields();
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const unassignedAuctions =
    ((auctions as Array<Record<string, unknown>>) ?? []).filter(
      (a) => !a.roomId && (a.status === 'DRAFT' || a.status === 'SCHEDULED'),
    );

  const showcaseColumns = [
    { title: '#', dataIndex: 'sortOrder', width: 48 },
    { title: '商品', dataIndex: 'title', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      render: (_: string, row: ShowcaseItem) => (
        <Tag color={row.displayStatus === 'BIDDING' ? 'red' : undefined}>{row.statusLabel}</Tag>
      ),
    },
    {
      title: '价格',
      render: (_: unknown, row: ShowcaseItem) => (
        <span>
          {row.priceLabel} ¥{row.price}
        </span>
      ),
    },
    {
      title: '操作',
      render: (_: unknown, row: ShowcaseItem) => {
        if (!selectedId) return null;
        if (row.isExplaining) return <Tag color="red">讲解中</Tag>;
        const canSwitch = row.displayStatus === 'UPCOMING';
        if (!canSwitch) return null;
        return (
          <Button
            size="small"
            type="link"
            loading={switchMutation.isPending}
            onClick={() =>
              switchMutation.mutate({ roomId: selectedId, auctionId: row.auctionId })
            }
          >
            切换讲解
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <Card
        title="直播场次"
        style={{ width: 360, flexShrink: 0 }}
        extra={
          <Button type="primary" size="small" onClick={() => setCreateOpen(true)}>
            新建
          </Button>
        }
      >
        <List
          loading={isLoading}
          dataSource={roomList}
          locale={{ emptyText: '暂无场次，点击新建' }}
          renderItem={(room) => (
            <List.Item
              style={{
                cursor: 'pointer',
                background: selectedId === room.id ? '#e6f4ff' : undefined,
                padding: '8px 12px',
                borderRadius: 8,
              }}
              onClick={() => setSelectedId(room.id as string)}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {(room.title as string) ?? '未命名'}
                    <Tag color={STATUS_COLOR[room.status as string]}>
                      {room.status as string}
                    </Tag>
                  </Space>
                }
                description={`${(room._count as { auctions?: number })?.auctions ?? 0} 件拍品`}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card
        title={selectedRoom ? (selectedRoom.title as string) : '选择左侧场次'}
        style={{ flex: 1 }}
        extra={
          selectedId && (
            <Space>
              {(selectedRoom?.status as string) === 'PREPARE' && (
                <Button
                  type="primary"
                  loading={goLiveMutation.isPending}
                  onClick={() => goLiveMutation.mutate(selectedId)}
                >
                  房间开播
                </Button>
              )}
              <Button onClick={() => setAddOpen(true)}>添加拍品</Button>
              <a href={`${userAppUrl()}/m/room/${selectedId}`} target="_blank" rel="noreferrer">
                <Button>打开用户端橱窗</Button>
              </a>
            </Space>
          )
        }
      >
        {!selectedId && <p style={{ color: '#999' }}>请从左侧选择或新建直播场次</p>}
        {selectedId && sc && (
          <>
            <p style={{ marginBottom: 12, color: '#666' }}>
              主播：{sc.hostDisplayName} · 在线 {sc.participantCount} · 讲解中拍品：
              {sc.activeAuctionId ? sc.items.find((i) => i.isExplaining)?.title ?? '—' : '无'}
            </p>
            <Table
              rowKey="auctionId"
              size="small"
              pagination={false}
              dataSource={sc.items}
              columns={showcaseColumns}
            />
          </>
        )}
        {selectedId && !sc && <p>加载橱窗…</p>}
      </Card>

      <Modal
        title="新建直播场次"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v.title)}>
          <Form.Item name="title" label="场次名称" rules={[{ required: true }]}>
            <Input placeholder="例：珠宝专场" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加拍品到橱窗"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => addForm.submit()}
        confirmLoading={addMutation.isPending}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={(v) =>
            addMutation.mutate({
              roomId: selectedId!,
              auctionId: v.auctionId,
              sortOrder: v.sortOrder,
            })
          }
        >
          <Form.Item name="auctionId" label="场次" rules={[{ required: true }]}>
            <Select
              placeholder="选择未入场的 DRAFT 场次"
              options={unassignedAuctions.map((a) => ({
                value: a.id as string,
                label: `${a.title as string} (${a.status as string})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序（可选）">
            <Input type="number" placeholder="留空则追加到末尾" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
