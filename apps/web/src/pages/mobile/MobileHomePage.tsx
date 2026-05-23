import { useQuery } from '@tanstack/react-query';
import { Card, List, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { liveRoomsApi, auctionsApi } from '../../lib/api';

export default function MobileHomePage() {
  const navigate = useNavigate();

  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['live-rooms'],
    queryFn: () => liveRoomsApi.listLive(),
    refetchInterval: 10000,
  });

  const { data: auctions, isLoading: auctionsLoading } = useQuery({
    queryKey: ['auctions', 'mobile'],
    queryFn: () => auctionsApi.list('LIVE'),
    refetchInterval: 5000,
  });

  const liveRooms = (rooms as Array<Record<string, unknown>>) ?? [];
  const liveAuctions = (auctions as Array<Record<string, unknown>>) ?? [];

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>竞拍大厅</h2>

      <h3 style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>直播中</h3>
      {roomsLoading && <Card>加载中...</Card>}
      <List>
        {liveRooms.map((room) => (
          <List.Item
            key={room.id as string}
            description={
              <Tag color="danger" style={{ marginRight: 8 }}>
                LIVE
              </Tag>
            }
            onClick={() => navigate(`/m/room/${room.id as string}`)}
          >
            {(room.title as string) ?? '直播场次'}
          </List.Item>
        ))}
      </List>

      {liveRooms.length === 0 && !roomsLoading && (
        <Card
          style={{ marginBottom: 16, color: '#666' }}
          onClick={() => navigate('/m/room/00000000-0000-4000-8000-00000000ROOM')}
        >
          暂无直播房间。点击尝试演示橱窗（需先 seed）
        </Card>
      )}

      <h3 style={{ fontSize: 14, color: '#666', margin: '16px 0 8px' }}>单场竞拍</h3>
      {auctionsLoading && <Card>加载中...</Card>}
      <List>
        {liveAuctions.map((item) => (
          <List.Item
            key={item.id as string}
            description={`¥${String(item.currentPrice)}`}
            onClick={() => navigate(`/m/live/${item.id as string}`)}
          >
            <Tag color="danger">LIVE</Tag> {item.title as string}
          </List.Item>
        ))}
      </List>
    </div>
  );
}
