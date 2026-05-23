import { Popup } from 'antd-mobile';
import type { LiveRoomShowcase, ShowcaseItem } from '@live-auction/shared';
import ShowcaseItemCard from './ShowcaseItemCard';

interface Props {
  visible: boolean;
  onClose: () => void;
  showcase: LiveRoomShowcase | null;
  onItemAction: (item: ShowcaseItem) => void;
}

export default function ShowcasePanel({
  visible,
  onClose,
  showcase,
  onItemAction,
}: Props) {
  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      onClose={onClose}
      bodyStyle={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: '55vh',
        maxHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 16 }}>进主播橱窗</span>
        <span style={{ fontSize: 12, color: '#999' }}>
          {showcase?.participantCount ?? 0} 人在线
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        {(showcase?.items ?? []).map((item) => (
          <ShowcaseItemCard key={item.auctionId} item={item} onAction={onItemAction} />
        ))}
      </div>
    </Popup>
  );
}
