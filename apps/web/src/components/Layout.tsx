import { Layout as AntLayout, Menu } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Header, Content } = AntLayout;

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const items = [
    { key: '/', label: <Link to="/">竞拍大厅</Link> },
    ...(user?.role === 'HOST' || user?.role === 'ADMIN'
      ? [
          { key: '/admin/lots', label: <Link to="/admin/lots">商品管理</Link> },
          { key: '/admin/auctions', label: <Link to="/admin/auctions">场次管理</Link> },
        ]
      : []),
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>直播竞拍</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={items}
          style={{ flex: 1, minWidth: 0 }}
        />
        <span style={{ color: '#ccc' }}>{user?.displayName}</span>
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
      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </AntLayout>
  );
}
