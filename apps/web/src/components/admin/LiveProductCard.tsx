import { Button, Dropdown, Tag } from 'antd';
import type { MenuProps } from 'antd';
import { AudioOutlined, MoreOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { ShowcaseItem } from '@live-auction/shared';
import styles from './LiveProductCard.module.css';

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200';

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function shortId(id: string): string {
  return id.slice(-8).toUpperCase();
}

function statusTagColor(displayStatus: ShowcaseItem['displayStatus']): string | undefined {
  if (displayStatus === 'BIDDING') return 'red';
  if (displayStatus === 'SOLD') return 'green';
  if (displayStatus === 'UPCOMING') return 'blue';
  if (displayStatus === 'CANCELLED') return 'orange';
  return undefined;
}

export interface LiveProductCardProps {
  item: ShowcaseItem;
  onExplain?: () => void;
  onCancelExplain?: () => void;
  onRemove?: () => void;
  onEditRules?: () => void;
  onPreview?: () => void;
  onBidHistory?: () => void;
  onViewOrder?: () => void;
  onCancelAbnormal?: () => void;
  loading?: boolean;
}

export default function LiveProductCard({
  item,
  onExplain,
  onCancelExplain,
  onRemove,
  onEditRules,
  onPreview,
  onBidHistory,
  onViewOrder,
  onCancelAbnormal,
  loading,
}: LiveProductCardProps) {
  const [remainingMs, setRemainingMs] = useState(item.remainingMs);

  useEffect(() => {
    setRemainingMs(item.remainingMs);
  }, [item.remainingMs, item.auctionId]);

  useEffect(() => {
    if (item.displayStatus !== 'BIDDING' || remainingMs == null) return;
    const timer = setInterval(() => {
      setRemainingMs((prev) => (prev != null ? Math.max(0, prev - 1000) : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, [item.displayStatus, item.auctionId, remainingMs != null]);

  const showCurrentPrice =
    item.displayStatus === 'BIDDING' ||
    item.displayStatus === 'CLOSING' ||
    item.displayStatus === 'SOLD' ||
    item.displayStatus === 'CANCELLED';

  const priceValue = showCurrentPrice ? item.price : item.startPrice;
  const priceLabel =
    item.displayStatus === 'SOLD' || item.displayStatus === 'CLOSING'
      ? '成交金额'
      : item.displayStatus === 'BIDDING' && item.price > item.startPrice
        ? '当前出价'
        : '起拍价';

  const statusText =
    item.displayStatus === 'BIDDING' && remainingMs != null
      ? `竞价中 ${formatCountdown(remainingMs)}`
      : item.statusLabel;

  const canExplain = item.displayStatus === 'UPCOMING' && !item.isExplaining;
  const isExplainingLive = item.isExplaining && item.displayStatus === 'BIDDING';

  const menuItems: MenuProps['items'] = [
    onEditRules && item.displayStatus === 'UPCOMING'
      ? { key: 'edit', label: '编辑规则', onClick: onEditRules }
      : null,
    onViewOrder ? { key: 'order', label: '查看订单', onClick: onViewOrder } : null,
    onPreview ? { key: 'preview', label: '预览用户端', onClick: onPreview } : null,
  ].filter(Boolean) as MenuProps['items'];

  return (
    <div className={`${styles.card}${item.priceAlertActive ? ` ${styles.alertCard}` : ''}`}>
      <div className={styles.index}>{String(item.sortOrder).padStart(2, '0')}</div>

      <div className={styles.main}>
        <div className={styles.topRow}>
          <div className={styles.thumbWrap}>
            <img
              className={styles.thumb}
              src={item.imageUrl ?? PLACEHOLDER}
              alt={item.title}
            />
            {item.isExplaining && (
              <div className={styles.explainingBadge}>讲解中</div>
            )}
          </div>

          <div className={styles.info}>
            <div className={styles.title}>{item.title}</div>
            <div className={styles.meta}>ID: {shortId(item.auctionId)}</div>
            <Tag color="volcano">竞拍</Tag>
            {item.priceAlertActive && (
              <Tag color="orange" style={{ marginLeft: 4 }}>
                竞价异常预警
              </Tag>
            )}
          </div>
        </div>

        <div className={styles.metrics}>
          <div className={styles.metric}>
            <div className={styles.metricValue}>¥{item.startPrice}</div>
            <div className={styles.metricLabel}>起拍价</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricValue}>¥{item.minIncrement}</div>
            <div className={styles.metricLabel}>固定加价</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricValue}>
              {item.capPrice != null ? item.capPrice.toLocaleString() : '—'}
            </div>
            <div className={styles.metricLabel}>封顶价</div>
          </div>
          {item.reservePrice != null && (
            <div className={styles.metric}>
              <div className={styles.metricValue}>¥{item.reservePrice}</div>
              <div className={styles.metricLabel}>最低成交价</div>
            </div>
          )}
          <div className={styles.metric}>
            <div className={styles.metricValue}>¥{priceValue}</div>
            <div className={styles.metricLabel}>{priceLabel}</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricValue}>
              {item.bidCount}
              {onBidHistory ? (
                <span className={styles.bidLink} onClick={onBidHistory} role="button" tabIndex={0}>
                  {' '}
                  出价次数 &gt;
                </span>
              ) : (
                <span className={styles.bidMuted}> 出价次数</span>
              )}
            </div>
            <div className={styles.statusCol}>
              <Tag color={statusTagColor(item.displayStatus)}>{statusText}</Tag>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Tag>
          {item.displayStatus === 'BIDDING'
            ? '商品竞拍中'
            : item.displayStatus === 'SOLD'
              ? '商品竞拍结束'
              : item.displayStatus === 'UPCOMING'
                ? '待开拍'
                : item.statusLabel}
        </Tag>
        <div className={styles.actionRow}>
          {canExplain && (
            <Button icon={<AudioOutlined />} onClick={onExplain} loading={loading}>
              讲解
            </Button>
          )}
          {isExplainingLive && onCancelExplain && (
            <Button icon={<AudioOutlined />} onClick={onCancelExplain} loading={loading}>
              取消讲解
            </Button>
          )}
          {isExplainingLive && !onCancelExplain && (
            <Button type="primary" icon={<AudioOutlined />} disabled>
              取消讲解
            </Button>
          )}
          {onCancelAbnormal && (
            <Button danger type="primary" onClick={onCancelAbnormal} loading={loading}>
              取消异常竞拍
            </Button>
          )}
          {onRemove && (
            <Button danger onClick={onRemove} loading={loading}>
              下架
            </Button>
          )}
          {menuItems && menuItems.length > 0 && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          )}
        </div>
      </div>
    </div>
  );
}
