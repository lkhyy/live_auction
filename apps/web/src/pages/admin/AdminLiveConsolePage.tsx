import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LiveRoomShowcase, ShowcaseItem } from '@live-auction/shared';
import { DEFAULT_ANOMALY_DETECTION } from '@live-auction/shared';
import { userAppUrl } from '../../lib/appConfig';
import { auctionsApi, liveRoomsApi, lotsApi } from '../../lib/api';
import { useAdminApiReady } from '../../hooks/useAdminApiReady';
import { useAdminLiveRoomSocket } from '../../hooks/useAdminLiveRoomSocket';
import AdminLoadError from '../../components/AdminLoadError';
import LiveProductCard from '../../components/admin/LiveProductCard';
import AddLiveProductModal from '../../components/admin/AddLiveProductModal';
import BidHistoryModal from '../../components/admin/BidHistoryModal';
import AuctionRulesFields from '../../components/admin/AuctionRulesFields';
import ImageUrlField from '../../components/admin/ImageUrlField';

const LIVE_STATUSES = new Set(['BIDDING', 'CLOSING', 'SOLD', 'FAILED', 'CANCELLED']);
const ROOM_STATUS_COLOR: Record<string, string> = {
  PREPARE: 'default',
  LIVE: 'red',
  ENDED: 'default',
};

type RoomRow = {
  id: string;
  title: string;
  status: string;
  _count?: { auctions?: number };
};

function filterItems(items: ShowcaseItem[], tab: 'live' | 'pending', query: string) {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    const tabMatch =
      tab === 'live'
        ? LIVE_STATUSES.has(item.displayStatus)
        : item.displayStatus === 'UPCOMING';
    if (!tabMatch) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.auctionId.toLowerCase().includes(q)
    );
  });
}

export default function AdminLiveConsolePage() {
  const apiReady = useAdminApiReady();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'pending'>('live');
  const [search, setSearch] = useState('');
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAuctionId, setEditingAuctionId] = useState<string | null>(null);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [bidHistoryOpen, setBidHistoryOpen] = useState(false);
  const [bidHistoryAuctionId, setBidHistoryAuctionId] = useState<string | null>(null);
  const [bidHistoryTitle, setBidHistoryTitle] = useState('');
  const [roomForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [cancelAbnormalOpen, setCancelAbnormalOpen] = useState(false);
  const [cancelAbnormalItem, setCancelAbnormalItem] = useState<ShowcaseItem | null>(null);
  const [cancelReason, setCancelReason] = useState('异常价格，主播取消');
  const [actionAuctionId, setActionAuctionId] = useState<string | null>(null);

  const {
    data: rooms,
    isLoading: roomsLoading,
    isError: roomsError,
    error: roomsQueryError,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ['live-rooms', 'mine'],
    queryFn: () => liveRoomsApi.listMine(),
    enabled: apiReady,
    retry: 1,
  });

  const roomList = (rooms as RoomRow[]) ?? [];

  useEffect(() => {
    if (selectedRoomId && roomList.some((r) => r.id === selectedRoomId)) return;
    const liveRoom = roomList.find((r) => r.status === 'LIVE');
    setSelectedRoomId(liveRoom?.id ?? roomList[0]?.id ?? null);
  }, [roomList, selectedRoomId]);

  const { data: showcase, isLoading: showcaseLoading } = useQuery({
    queryKey: ['showcase', selectedRoomId],
    queryFn: () => liveRoomsApi.showcase(selectedRoomId!),
    enabled: apiReady && !!selectedRoomId,
    refetchInterval: selectedRoomId ? 5000 : false,
  });

  const sc = showcase as LiveRoomShowcase | undefined;
  const selectedRoom = roomList.find((r) => r.id === selectedRoomId);

  const filteredItems = useMemo(
    () => filterItems(sc?.items ?? [], activeTab, search),
    [sc?.items, activeTab, search],
  );

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['live-rooms'] });
    void qc.invalidateQueries({ queryKey: ['showcase', selectedRoomId] });
  }, [qc, selectedRoomId]);

  useAdminLiveRoomSocket(selectedRoomId, invalidate);

  const createRoomMutation = useMutation({
    mutationFn: (title: string) => liveRoomsApi.create(title),
    onSuccess: (room) => {
      message.success('直播专场已创建');
      setCreateRoomOpen(false);
      roomForm.resetFields();
      setSelectedRoomId((room as RoomRow).id);
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const goLiveMutation = useMutation({
    mutationFn: (roomId: string) => liveRoomsApi.goLive(roomId),
    onSuccess: () => {
      message.success('房间已开播');
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const switchMutation = useMutation({
    mutationFn: ({ roomId, auctionId }: { roomId: string; auctionId: string }) =>
      liveRoomsApi.switchAuction(roomId, auctionId),
    onSuccess: () => {
      message.success('已切换讲解拍品');
      setActionAuctionId(null);
      invalidate();
    },
    onError: (e: Error) => {
      setActionAuctionId(null);
      message.error(e.message);
    },
  });

  const detachMutation = useMutation({
    mutationFn: ({ roomId, auctionId }: { roomId: string; auctionId: string }) =>
      liveRoomsApi.detachAuction(roomId, auctionId),
    onSuccess: () => {
      message.success('已从橱窗下架');
      setActionAuctionId(null);
      invalidate();
    },
    onError: (e: Error) => {
      setActionAuctionId(null);
      message.error(e.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ auctionId, reason }: { auctionId: string; reason: string }) =>
      auctionsApi.cancel(auctionId, reason),
    onSuccess: () => {
      message.success('竞拍已取消');
      setActionAuctionId(null);
      invalidate();
    },
    onError: (e: Error) => {
      setActionAuctionId(null);
      message.error(e.message);
    },
  });

  const clearActiveMutation = useMutation({
    mutationFn: (roomId: string) => liveRoomsApi.clearActive(roomId),
    onSuccess: () => {
      message.success('已取消讲解');
      setActionAuctionId(null);
      invalidate();
    },
    onError: (e: Error) => {
      setActionAuctionId(null);
      message.error(e.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      auctionId,
      lotId,
      data,
    }: {
      auctionId: string;
      lotId: string | null;
      data: Record<string, unknown>;
    }) => {
      if (lotId) {
        await lotsApi.update(lotId, {
          title: data.title,
          description: data.description,
          imageUrl: data.imageUrl,
        });
      }
      return auctionsApi.update(auctionId, {
        title: data.title,
        rules: data.rules,
      });
    },
    onSuccess: () => {
      message.success('商品与规则已更新');
      setEditOpen(false);
      setEditingLotId(null);
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const handleRemove = (item: ShowcaseItem) => {
    if (!selectedRoomId) return;
    Modal.confirm({
      title: '确认下架',
      content:
        item.displayStatus === 'UPCOMING'
          ? `将「${item.title}」从待上架队列移除`
          : `将取消「${item.title}」的进行中竞拍`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setActionAuctionId(item.auctionId);
        if (item.displayStatus === 'UPCOMING') {
          return detachMutation.mutateAsync({
            roomId: selectedRoomId,
            auctionId: item.auctionId,
          });
        }
        if (item.displayStatus === 'BIDDING') {
          return cancelMutation.mutateAsync({
            auctionId: item.auctionId,
            reason: '主播下架',
          });
        }
        message.info('该状态不可下架');
      },
    });
  };

  const openCancelAbnormal = (item: ShowcaseItem) => {
    setCancelAbnormalItem(item);
    setCancelReason('异常价格，主播取消');
    setCancelAbnormalOpen(true);
  };

  const handleCancelAbnormalConfirm = () => {
    if (!cancelAbnormalItem) return;
    const reason = cancelReason.trim() || '异常价格，主播取消';
    setActionAuctionId(cancelAbnormalItem.auctionId);
    cancelMutation.mutate(
      { auctionId: cancelAbnormalItem.auctionId, reason },
      {
        onSuccess: () => {
          setCancelAbnormalOpen(false);
          setCancelAbnormalItem(null);
        },
      },
    );
  };

  const handleEditRules = async (auctionId: string) => {
    try {
      const auction = await auctionsApi.get(auctionId);
      const lot = auction.lot as Record<string, unknown> | undefined;
      const rules = (auction.rules ?? auction.ruleSnapshot) as Record<string, unknown>;
      setEditingAuctionId(auctionId);
      setEditingLotId((lot?.id as string) ?? null);
      editForm.setFieldsValue({
        title: auction.title,
        description: lot?.description,
        imageUrl: lot?.imageUrl,
        rules: {
          ...rules,
          softClose: (rules.softClose as Record<string, unknown>) ?? {
            enabled: true,
            extensionSeconds: 15,
            triggerWindowSeconds: 30,
            maxTotalExtensionSeconds: 600,
          },
          priceAlert: (rules.priceAlert as Record<string, unknown>) ?? undefined,
          anomalyDetection: {
            ...DEFAULT_ANOMALY_DETECTION,
            ...(rules.anomalyDetection as Record<string, unknown> | undefined),
          },
        },
      });
      setEditOpen(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    }
  };

  const openBidHistory = (item: ShowcaseItem) => {
    setBidHistoryAuctionId(item.auctionId);
    setBidHistoryTitle(item.title);
    setBidHistoryOpen(true);
  };

  const nextSortOrder = (sc?.items.length ?? 0) + 1;

  return (
    <>
      <AdminLoadError
        error={roomsError ? (roomsQueryError as Error) : null}
        title="直播专场列表加载失败"
      />

      <Card
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Select
              style={{ minWidth: 220 }}
              placeholder="选择直播专场"
              loading={roomsLoading}
              value={selectedRoomId ?? undefined}
              onChange={setSelectedRoomId}
              options={roomList.map((r) => ({
                value: r.id,
                label: `${r.title} (${r._count?.auctions ?? 0} 件)`,
              }))}
            />
            {selectedRoom && (
              <Tag color={ROOM_STATUS_COLOR[selectedRoom.status] ?? 'default'}>
                {selectedRoom.status}
              </Tag>
            )}
            {sc && <Tag>在线 {sc.participantCount}</Tag>}
          </Space>
          <Space wrap>
            {selectedRoomId && selectedRoom?.status === 'PREPARE' && (
              <Button
                type="primary"
                loading={goLiveMutation.isPending}
                onClick={() => goLiveMutation.mutate(selectedRoomId)}
              >
                房间开播
              </Button>
            )}
            <Button onClick={() => setCreateRoomOpen(true)}>创建直播专场</Button>
            {selectedRoomId && (
              <a
                href={`${userAppUrl()}/m/room/${selectedRoomId}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button>打开用户端橱窗</Button>
              </a>
            )}
          </Space>
        </Space>
      </Card>

      {!selectedRoomId && !roomsLoading && !roomsError && (
        <Card>
          <Empty
            description={
              roomList.length === 0
                ? '暂无属于当前账号的直播专场。演示数据请使用 host@example.com 登录；其他账号需自行创建专场。'
                : '请选择直播专场'
            }
          >
            <Space>
              <Button type="primary" onClick={() => setCreateRoomOpen(true)}>
                创建直播专场
              </Button>
              {roomList.length === 0 && (
                <Button onClick={() => void refetchRooms()}>重新加载</Button>
              )}
            </Space>
          </Empty>
        </Card>
      )}

      {selectedRoomId && (
        <Card styles={{ body: { paddingTop: 12 } }}>
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as 'live' | 'pending')}
            tabBarExtraContent={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={invalidate}>
                  刷新列表
                </Button>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="商品名称或 ID"
                  style={{ width: 200 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddProductOpen(true)}
                >
                  添加商品
                </Button>
              </Space>
            }
            items={[
              { key: 'live', label: '直播商品' },
              { key: 'pending', label: '待上架商品' },
            ]}
          />

          {showcaseLoading && <p style={{ color: '#999' }}>加载中…</p>}

          {!showcaseLoading && filteredItems.length === 0 && (
            <Empty
              description={
                activeTab === 'live' ? '暂无直播中的商品' : '暂无待上架商品'
              }
              style={{ margin: '32px 0' }}
            >
              {activeTab === 'pending' && (
                <Button type="primary" onClick={() => setAddProductOpen(true)}>
                  添加商品
                </Button>
              )}
            </Empty>
          )}

          {filteredItems.map((item) => (
            <LiveProductCard
              key={item.auctionId}
              item={item}
              loading={actionAuctionId === item.auctionId}
              onExplain={
                item.displayStatus === 'UPCOMING' && selectedRoomId
                  ? () => {
                      setActionAuctionId(item.auctionId);
                      switchMutation.mutate({
                        roomId: selectedRoomId,
                        auctionId: item.auctionId,
                      });
                    }
                  : undefined
              }
              onRemove={
                item.displayStatus === 'UPCOMING' || item.displayStatus === 'BIDDING'
                  ? () => handleRemove(item)
                  : undefined
              }
              onEditRules={
                item.displayStatus === 'UPCOMING'
                  ? () => handleEditRules(item.auctionId)
                  : undefined
              }
              onPreview={
                selectedRoomId
                  ? () =>
                      window.open(`${userAppUrl()}/m/room/${selectedRoomId}`, '_blank')
                  : undefined
              }
              onCancelExplain={
                item.isExplaining && item.displayStatus === 'BIDDING' && selectedRoomId
                  ? () => {
                      setActionAuctionId(item.auctionId);
                      clearActiveMutation.mutate(selectedRoomId);
                    }
                  : undefined
              }
              onBidHistory={
                item.bidCount > 0 ? () => openBidHistory(item) : undefined
              }
              onCancelAbnormal={
                item.displayStatus === 'BIDDING'
                  ? () => openCancelAbnormal(item)
                  : undefined
              }
              onViewOrder={
                item.orderId
                  ? () => navigate(`/orders?id=${item.orderId}`)
                  : undefined
              }
            />
          ))}
        </Card>
      )}

      <Modal
        title="创建直播专场"
        open={createRoomOpen}
        onCancel={() => setCreateRoomOpen(false)}
        onOk={() => roomForm.submit()}
        confirmLoading={createRoomMutation.isPending}
      >
        <Form
          form={roomForm}
          layout="vertical"
          onFinish={(v) => createRoomMutation.mutate(v.title)}
        >
          <Form.Item name="title" label="专场名称" rules={[{ required: true }]}>
            <Input placeholder="例：珠宝专场" />
          </Form.Item>
        </Form>
      </Modal>

      <AddLiveProductModal
        open={addProductOpen}
        roomId={selectedRoomId}
        nextSortOrder={nextSortOrder}
        onClose={() => setAddProductOpen(false)}
        onSuccess={() => {
          invalidate();
          setActiveTab('pending');
        }}
      />

      <Modal
        title="编辑商品与竞拍规则"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditingLotId(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        width={560}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) =>
            editingAuctionId &&
            updateMutation.mutate({
              auctionId: editingAuctionId,
              lotId: editingLotId,
              data: v,
            })
          }
        >
          <Form.Item name="title" label="商品名称">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="商品介绍">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="imageUrl" label="商品图片">
            <ImageUrlField />
          </Form.Item>
          <AuctionRulesFields />
        </Form>
      </Modal>

      <Modal
        title="取消异常竞拍"
        open={cancelAbnormalOpen}
        onCancel={() => {
          setCancelAbnormalOpen(false);
          setCancelAbnormalItem(null);
        }}
        onOk={handleCancelAbnormalConfirm}
        confirmLoading={cancelMutation.isPending}
        okText="确认取消"
        okButtonProps={{ danger: true }}
      >
        {cancelAbnormalItem && (
          <>
            <p>
              商品：<strong>{cancelAbnormalItem.title}</strong>
            </p>
            <p>
              当前价：<strong>¥{cancelAbnormalItem.price}</strong>
              {' · '}
              出价次数：<strong>{cancelAbnormalItem.bidCount}</strong>
            </p>
            <p style={{ color: '#666', marginBottom: 12 }}>
              取消后不会生成订单，用户将无法继续出价。
            </p>
            <Input.TextArea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="请填写取消原因"
            />
          </>
        )}
      </Modal>

      <BidHistoryModal
        open={bidHistoryOpen}
        auctionId={bidHistoryAuctionId}
        title={bidHistoryTitle}
        onClose={() => {
          setBidHistoryOpen(false);
          setBidHistoryAuctionId(null);
        }}
      />
    </>
  );
}
