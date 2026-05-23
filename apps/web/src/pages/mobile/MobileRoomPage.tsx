import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NavBar, Toast } from 'antd-mobile';
import type { LiveRoomShowcase, ShowcaseItem } from '@live-auction/shared';
import LiveVideoLayer from '../../components/LiveVideoLayer';
import HostScriptTicker from '../../components/HostScriptTicker';
import ShowcasePanel from '../../components/showcase/ShowcasePanel';
import { liveRoomsApi } from '../../lib/api';
import { useLiveRoomSocket } from '../../hooks/useLiveRoomSocket';
export default function MobileRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [showcase, setShowcase] = useState<LiveRoomShowcase | null>(null);
  const [showcaseOpen, setShowcaseOpen] = useState(true);

  const { data: initial } = useQuery({
    queryKey: ['showcase', roomId],
    queryFn: () => liveRoomsApi.showcase(roomId!),
    enabled: !!roomId,
    refetchInterval: 3000,
  });

  const displayShowcase = showcase ?? initial ?? null;

  const onShowcase = useCallback((data: LiveRoomShowcase) => {
    setShowcase(data);
  }, []);

  useLiveRoomSocket(roomId, onShowcase);

  const handleItemAction = (item: ShowcaseItem) => {
    if (item.buttonAction === 'BID') {
      navigate(`/m/live/${item.auctionId}?roomId=${roomId}`);
      return;
    }
    if (item.buttonAction === 'VIEW') {
      navigate(`/m/auctions/${item.auctionId}`);
      return;
    }
    if (item.buttonAction === 'CLOSING') {
      Toast.show({ content: '正在截拍，请稍候…' });
      return;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <NavBar
        onBack={() => navigate('/m')}
        style={{ color: '#fff', '--border-bottom': 'none' }}
      >
        {displayShowcase?.title ?? '直播间'}
      </NavBar>

      <LiveVideoLayer />
      <HostScriptTicker running={displayShowcase?.roomStatus === 'LIVE'} />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: '0 auto',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setShowcaseOpen(true)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.95)',
            border: 'none',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            fontSize: 15,
            fontWeight: 600,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
          }}
        >
          进主播橱窗 ({displayShowcase?.items.length ?? 0})
        </button>
      </div>

      <ShowcasePanel
        visible={showcaseOpen}
        onClose={() => setShowcaseOpen(false)}
        showcase={displayShowcase}
        onItemAction={handleItemAction}
      />
    </div>
  );
}
