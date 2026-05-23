import { Button, Card, Form, Input, Tabs, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      const res = await authApi.login(values.email, values.password);
      setAuth(res.accessToken, res.user);
      message.success('登录成功');
      navigate('/');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败');
    }
  };

  const onRegister = async (values: {
    email: string;
    password: string;
    displayName: string;
    role?: string;
  }) => {
    try {
      const res = await authApi.register(values);
      setAuth(res.accessToken, res.user);
      message.success('注册成功');
      navigate('/');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '注册失败');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '80px auto' }}>
      <Card title="直播竞拍系统">
        <Tabs
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
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
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form onFinish={onRegister} layout="vertical" initialValues={{ role: 'BUYER' }}>
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
                    注册
                  </Button>
                </Form>
              ),
            },
          ]}
        />
        <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
          演示账号：host@example.com / buyer@example.com，密码 password123
        </p>
      </Card>
    </div>
  );
}
