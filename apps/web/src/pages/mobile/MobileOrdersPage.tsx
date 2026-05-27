import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, List, Tag, Toast } from 'antd-mobile';
import { QueryErrorCard } from '../../components/QueryErrorCard';
import { isUnauthorizedError, meApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

export default function MobileOrdersPage() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => meApi.orders(),
    enabled: !!token,
    retry: (count, err) => !isUnauthorizedError(err) && count < 2,
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => meApi.payMock(id),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: '支付成功（模拟）' });
      void qc.invalidateQueries({ queryKey: ['my-orders'] });
    },
    onError: () => Toast.show({ icon: 'fail', content: '支付失败' }),
  });

  const orders = (data as Array<Record<string, unknown>>) ?? [];

  return (
    <div>
      <h2 style={{ margin: '0 0 12px' }}>我的订单</h2>
      {isError && <QueryErrorCard error={error} onRetry={() => void refetch()} />}
      {isLoading && !isError && <Card>加载中...</Card>}
      <List>
        {orders.map((o) => {
          const auction = o.auction as Record<string, unknown>;
          const lot = auction?.lot as Record<string, unknown> | undefined;
          return (
            <List.Item
              key={o.id as string}
              description={
                <>
                  <Tag color={o.status === 'PAID' ? 'success' : 'warning'}>
                    {o.status as string}
                  </Tag>
                  <span style={{ marginLeft: 8 }}>¥{String(o.amount)}</span>
                </>
              }
              extra={
                o.status === 'PENDING_PAYMENT' ? (
                  <Button
                    size="small"
                    color="primary"
                    loading={payMutation.isPending}
                    onClick={() => payMutation.mutate(o.id as string)}
                  >
                    模拟支付
                  </Button>
                ) : null
              }
            >
              {(lot?.title as string) ?? (auction?.title as string) ?? '竞拍订单'}
            </List.Item>
          );
        })}
      </List>
      {!isLoading && !isError && orders.length === 0 && (
        <Card style={{ textAlign: 'center', color: '#999' }}>暂无订单</Card>
      )}
    </div>
  );
}
