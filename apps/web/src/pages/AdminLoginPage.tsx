import { Button, Card, Form, Input, message } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { userAppUrl } from '../lib/appConfig';
import { AuthLoading } from '../components/RequireAuth';
import { useAuthHydrated } from '../hooks/useAuthHydrated';
import { useAuthStore } from '../stores/authStore';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (!hydrated || !token || !user) return;
    if (user.role === 'HOST' || user.role === 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [hydrated, token, user, navigate]);

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      const res = await authApi.login(values.email, values.password);
      if (res.user.role !== 'HOST' && res.user.role !== 'ADMIN') {
        message.warning('买家账号请使用用户端登录');
        return;
      }
      setAuth(res.accessToken, res.user);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败');
    }
  };

  if (!hydrated) return <AuthLoading />;

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 16 }}>
      <Card title="直播竞拍 · 管理后台">
        <Form onFinish={onLogin} layout="vertical">
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="host@example.com" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password placeholder="password123" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
        <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
          演示主播：host@example.com / password123
          <br />
          用户端 H5：
          <a href={userAppUrl()} target="_blank" rel="noreferrer">
            {userAppUrl()}
          </a>
        </p>
      </Card>
    </div>
  );
}
