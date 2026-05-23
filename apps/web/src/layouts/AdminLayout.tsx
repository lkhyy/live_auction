import { Layout as AntLayout, Menu } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Header, Content, Sider } = AntLayout;

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const items = [
    { key: '/admin/dashboard', label: <Link to="/admin/dashboard">竞拍看板</Link> },
    { key: '/admin/lots', label: <Link to="/admin/lots">商品管理</Link> },
    { key: '/admin/auctions', label: <Link to="/admin/auctions">场次管理</Link> },
    { key: '/admin/orders', label: <Link to="/admin/orders">订单管理</Link> },
    { key: '/m', label: <Link to="/m">前往 H5 大厅</Link> },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', color: '#fff', gap: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 18 }}>直播竞拍 · 管理后台</span>
        <span style={{ marginLeft: 'auto', color: '#ccc' }}>{user?.displayName}</span>
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
          <Menu mode="inline" selectedKeys={[location.pathname]} items={items} />
        </Sider>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
