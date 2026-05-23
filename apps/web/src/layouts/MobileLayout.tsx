import { TabBar } from 'antd-mobile';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  AppOutline,
  UnorderedListOutline,
  UserOutline,
} from 'antd-mobile-icons';
import './MobileLayout.css';

export default function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const tabs = [
    { key: '/m', title: '大厅', icon: <AppOutline /> },
    { key: '/m/orders', title: '订单', icon: <UnorderedListOutline /> },
    { key: '/m/history', title: '记录', icon: <UserOutline /> },
  ];

  const activeKey = path.startsWith('/m/orders')
    ? '/m/orders'
    : path.startsWith('/m/history')
      ? '/m/history'
      : '/m';

  if (path.includes('/m/live/') || path.includes('/m/auctions/')) {
    return (
      <div className="mobile-root mobile-fullscreen">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="mobile-root">
      <div className="mobile-content">
        <Outlet />
      </div>
      <TabBar activeKey={activeKey} onChange={(key) => navigate(key)}>
        {tabs.map((t) => (
          <TabBar.Item key={t.key} icon={t.icon} title={t.title} />
        ))}
      </TabBar>
    </div>
  );
}
