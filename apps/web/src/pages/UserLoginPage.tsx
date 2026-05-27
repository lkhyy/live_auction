import { Button, Card, Form, Input, Tabs, message } from 'antd';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { adminAppUrl } from '../lib/appConfig';
import { AuthLoading } from '../components/RequireAuth';
import { useAuthHydrated } from '../hooks/useAuthHydrated';
import { useAuthStore } from '../stores/authStore';

export default function UserLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const staffBlocked = (location.state as { staffBlocked?: boolean })?.staffBlocked;

  useEffect(() => {
    if (!hydrated || !token || !user) return;
    if (user.role === 'BUYER') {
      const from = (location.state as { from?: string })?.from;
      navigate(from && from.startsWith('/m') ? from : '/m', { replace: true });
    }
  }, [hydrated, token, user, navigate, location.state]);

  useEffect(() => {
    if (staffBlocked) {
      message.warning('主播/管理员请使用管理后台登录');
    }
  }, [staffBlocked]);

  useEffect(() => {
    const onExpired = () => {
      message.warning('登录已过期，请重新登录');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const afterAuth = (role: string) => {
    if (role === 'HOST' || role === 'ADMIN') {
      message.info(`请前往管理后台：${adminAppUrl()}`);
      useAuthStore.getState().logout();
      return;
    }
    const from = (location.state as { from?: string })?.from;
    navigate(from && from.startsWith('/m') ? from : '/m', { replace: true });
  };

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      const res = await authApi.login(values.email, values.password);
      if (res.user.role === 'HOST' || res.user.role === 'ADMIN') {
        message.warning('该账号为管理端账号，请使用管理后台登录');
        return;
      }
      setAuth(res.accessToken, res.user);
      message.success('登录成功');
      afterAuth(res.user.role);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败');
    }
  };

  const onRegister = async (values: {
    email: string;
    password: string;
    displayName: string;
  }) => {
    try {
      const res = await authApi.register({ ...values, role: 'BUYER' });
      setAuth(res.accessToken, res.user);
      message.success('注册成功');
      afterAuth(res.user.role);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '注册失败');
    }
  };

  if (!hydrated) return <AuthLoading />;

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 16 }}>
      <Card title="直播竞拍 · 买家端">
        <Tabs
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form onFinish={onLogin} layout="vertical">
                  <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="buyer@example.com" />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                    <Input.Password placeholder="password123" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block>
                    登录
                  </Button>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form onFinish={onRegister} layout="vertical">
                  <Form.Item name="displayName" label="昵称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block>
                    注册买家账号
                  </Button>
                </Form>
              ),
            },
          ]}
        />
        <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
          演示买家：buyer@example.com / password123
        </p>
      </Card>
    </div>
  );
}
