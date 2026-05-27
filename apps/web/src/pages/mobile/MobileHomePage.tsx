import { useQuery } from '@tanstack/react-query';
import { Card, List, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { liveRoomsApi } from '../../lib/api';

const ROOM_STATUS: Record<string, { label: string; color: 'danger' | 'warning' | 'default' }> = {
  LIVE: { label: '直播中', color: 'danger' },
  PREPARE: { label: '筹备中', color: 'warning' },
  ENDED: { label: '已结束', color: 'default' },
};

const STATUS_ORDER: Record<string, number> = { LIVE: 0, PREPARE: 1, ENDED: 2 };

export default function MobileHomePage() {
  const navigate = useNavigate();

  const {
    data: rooms,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['live-rooms', 'all'],
    queryFn: () => liveRoomsApi.list(),
    refetchInterval: 10000,
  });

  const allRooms = ((rooms as Array<Record<string, unknown>>) ?? []).slice().sort((a, b) => {
    const sa = STATUS_ORDER[a.status as string] ?? 99;
    const sb = STATUS_ORDER[b.status as string] ?? 99;
    return sa - sb;
  });

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>直播大厅</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#999' }}>
        进入直播间，在橱窗里参与竞拍
      </p>

      {isError && (
        <Card style={{ marginBottom: 12, color: '#cf1322' }}>
          无法连接 API，请确认已启动后端（npm run dev:api）且地址为{' '}
          {import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}
        </Card>
      )}

      {isLoading && <Card>加载中...</Card>}
      <List>
        {allRooms.map((room) => {
          const status = (room.status as string) ?? 'PREPARE';
          const meta = ROOM_STATUS[status] ?? ROOM_STATUS.PREPARE;
          const host = room.host as Record<string, unknown> | undefined;
          return (
            <List.Item
              key={room.id as string}
              description={
                <>
                  <Tag color={meta.color} style={{ marginRight: 8 }}>
                    {meta.label}
                  </Tag>
                  {host?.displayName && (
                    <span style={{ color: '#999' }}>{String(host.displayName)}</span>
                  )}
                </>
              }
              onClick={() => navigate(`/m/room/${room.id as string}`)}
            >
              {(room.title as string) ?? '直播场次'}
            </List.Item>
          );
        })}
      </List>

      {allRooms.length === 0 && !isLoading && (
        <Card style={{ marginTop: 12, textAlign: 'center', color: '#999' }}>
          暂无直播间，请等待主播创建或运行 seed 后刷新
        </Card>
      )}
    </div>
  );
}
