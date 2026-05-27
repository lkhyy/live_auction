import { TabBar, Toast } from 'antd-mobile';
import { useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  AppOutline,
  SetOutline,
  UnorderedListOutline,
  UserOutline,
} from 'antd-mobile-icons';
import { useAuthStore } from '../stores/authStore';
import './MobileLayout.css';

export default function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const path = location.pathname;

  useEffect(() => {
    const onExpired = () => {
      Toast.show({ content: '登录已过期，请重新登录' });
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [navigate]);

  const tabs = [
    { key: '/m', title: '大厅', icon: <AppOutline />, needAuth: false },
    { key: '/m/orders', title: '订单', icon: <UnorderedListOutline />, needAuth: true },
    { key: '/m/participations', title: '我参与的', icon: <UserOutline />, needAuth: true },
    { key: '/m/settings', title: '我的', icon: <SetOutline />, needAuth: true },
  ];

  const activeKey = path.startsWith('/m/orders')
    ? '/m/orders'
    : path.startsWith('/m/participations') || path.startsWith('/m/history')
      ? '/m/participations'
      : path.startsWith('/m/settings')
        ? '/m/settings'
        : '/m';

  const onTabChange = (key: string) => {
    const tab = tabs.find((t) => t.key === key);
    if (tab?.needAuth && (!token || !user)) {
      Toast.show({ content: '请先登录买家账号' });
      navigate('/login', { state: { from: key } });
      return;
    }
    if (tab?.needAuth && user && (user.role === 'HOST' || user.role === 'ADMIN')) {
      Toast.show({ content: '请使用买家账号登录' });
      navigate('/login', { state: { from: key, staffBlocked: true } });
      return;
    }
    navigate(key);
  };

  if (
    path.includes('/m/live/') ||
    path.includes('/m/auctions/') ||
    path.includes('/m/room/')
  ) {
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
      <TabBar activeKey={activeKey} onChange={onTabChange}>
        {tabs.map((t) => (
          <TabBar.Item key={t.key} icon={t.icon} title={t.title} />
        ))}
      </TabBar>
    </div>
  );
}
