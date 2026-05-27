import { Modal, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { auctionsApi } from '../../lib/api';

interface BidHistoryModalProps {
  open: boolean;
  auctionId: string | null;
  title?: string;
  onClose: () => void;
}

type BidRow = {
  id: string;
  amount: string;
  createdAt: string;
  user: { displayName: string };
};

export default function BidHistoryModal({
  open,
  auctionId,
  title,
  onClose,
}: BidHistoryModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['auction-bids', auctionId],
    queryFn: () => auctionsApi.listBids(auctionId!),
    enabled: open && !!auctionId,
  });

  const columns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: unknown, __: BidRow, index: number) => index + 1,
    },
    {
      title: '出价人',
      key: 'user',
      render: (_: unknown, r: BidRow) => r.user.displayName,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (a: string) => `¥${a}`,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
  ];

  return (
    <Modal
      title={title ? `出价记录 · ${title}` : '出价记录'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      <Table
        loading={isLoading}
        dataSource={(data as BidRow[]) ?? []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 8 }}
        size="small"
      />
    </Modal>
  );
}
