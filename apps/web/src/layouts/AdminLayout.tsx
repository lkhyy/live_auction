import { Layout as AntLayout, Menu } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { userAppUrl } from '../lib/appConfig';
import { useAuthStore } from '../stores/authStore';

const { Header, Content, Sider } = AntLayout;

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const items = [
    { key: '/', label: <Link to="/">直播控制台</Link> },
    { key: '/dashboard', label: <Link to="/dashboard">竞拍看板</Link> },
    { key: '/orders', label: <Link to="/orders">订单管理</Link> },
    { key: '/settings', label: <Link to="/settings">主播信息</Link> },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', color: '#fff', gap: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 18 }}>直播竞拍 · 管理后台</span>
        <a href={userAppUrl()} target="_blank" rel="noreferrer" style={{ color: '#91d5ff', marginLeft: 'auto' }}>
          用户端 H5
        </a>
        <Link to="/settings" style={{ color: '#ccc' }}>
          {user?.displayName}
        </Link>
        <a
          style={{ color: '#91d5ff' }}
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          退出
        </a>
      </Header>
      <AntLayout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[
              location.pathname === '/'
                ? '/'
                : location.pathname.startsWith('/orders')
                  ? '/orders'
                  : location.pathname.startsWith('/dashboard')
                    ? '/dashboard'
                    : location.pathname.startsWith('/settings')
                      ? '/settings'
                      : location.pathname,
            ]}
            items={items}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
