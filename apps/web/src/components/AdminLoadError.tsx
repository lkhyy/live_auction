import { Alert, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

interface Props {
  error: Error | null;
  title?: string;
}

export default function AdminLoadError({ error, title = '加载失败' }: Props) {
  const navigate = useNavigate();
  if (!error) return null;

  const isAuth =
    error.message.includes('401') ||
    error.message.toLowerCase().includes('unauthorized') ||
    error.message.includes('Forbidden');

  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message={title}
      description={
        <>
          <div>{error.message}</div>
          {isAuth && (
            <Button type="link" style={{ padding: 0, marginTop: 8 }} onClick={() => navigate('/login')}>
              重新登录
            </Button>
          )}
          {!isAuth && error.message.includes('fetch') && (
            <div style={{ marginTop: 8, color: '#666' }}>
              请确认已执行 <code>npm run dev:api</code>，且 http://localhost:3000 可访问。
            </div>
          )}
        </>
      }
    />
  );
}
