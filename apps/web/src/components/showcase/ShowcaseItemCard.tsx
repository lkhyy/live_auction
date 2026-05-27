import type { ShowcaseItem } from '@live-auction/shared';
import { useShowcaseCountdownLabel } from '../../hooks/useShowcaseCountdownLabel';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  BIDDING: { bg: '#fff1f0', color: '#cf1322' },
  UPCOMING: { bg: '#fff7e6', color: '#d46b08' },
  FAILED: { bg: '#f5f5f5', color: '#8c8c8c' },
  SOLD: { bg: '#f5f5f5', color: '#8c8c8c' },
  CLOSING: { bg: '#f5f5f5', color: '#8c8c8c' },
};

interface Props {
  item: ShowcaseItem;
  onAction: (item: ShowcaseItem) => void;
}

export default function ShowcaseItemCard({ item, onAction }: Props) {
  const statusLabel = useShowcaseCountdownLabel(item);
  const tag = STATUS_COLORS[item.displayStatus] ?? STATUS_COLORS.FAILED;
  const btnStyle: React.CSSProperties =
    item.buttonAction === 'BID'
      ? {
          background: 'linear-gradient(90deg,#ff6b9d,#ff4d4f)',
          color: '#fff',
          border: 'none',
        }
      : item.buttonAction === 'VIEW'
        ? {
            background: 'linear-gradient(90deg,#ff6b9d,#ff4d4f)',
            color: '#fff',
            border: 'none',
          }
        : item.buttonAction === 'CLOSING'
          ? {
              background: 'linear-gradient(90deg,#ff6b9d,#ff4d4f)',
              color: '#fff',
              border: 'none',
            }
          : {
              background: '#f5f5f5',
              color: '#bfbfbf',
              border: 'none',
            };

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0',
        alignItems: 'stretch',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: '0 0 4px 0',
          }}
        >
          {item.sortOrder}
        </span>
        <img
          src={
            item.imageUrl ??
            'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200'
          }
          alt=""
          style={{
            width: 88,
            height: 88,
            objectFit: 'cover',
            borderRadius: 8,
            display: 'block',
          }}
        />
        {item.isExplaining && (
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              right: 4,
              background: 'rgba(255,77,79,0.9)',
              color: '#fff',
              fontSize: 10,
              textAlign: 'center',
              borderRadius: 4,
              padding: '2px 0',
            }}
          >
            讲解中
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </div>
        <div style={{ marginTop: 6 }}>
          <span
            style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 4,
              background: tag.bg,
              color: tag.color,
            }}
          >
            {statusLabel}
          </span>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{item.priceLabel} </span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#cf1322' }}>
            ¥{item.price}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
        <button
          type="button"
          disabled={!item.buttonEnabled}
          onClick={() => onAction(item)}
          style={{
            ...btnStyle,
            borderRadius: 20,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: item.buttonEnabled ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          {item.buttonText}
        </button>
      </div>
    </div>
  );
}
