import { Button, Card } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { isUnauthorizedError } from '../lib/api';

export function QueryErrorCard({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const navigate = useNavigate();
  const expired = isUnauthorizedError(error);

  return (
    <Card style={{ marginBottom: 12, color: '#cf1322' }}>
      <div>{expired ? '登录已过期，请重新登录' : error instanceof Error ? error.message : '加载失败'}</div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {expired ? (
          <Button size="small" color="primary" onClick={() => navigate('/login', { replace: true })}>
            重新登录
          </Button>
        ) : (
          onRetry && (
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          )
        )}
      </div>
    </Card>
  );
}
