import { Spin } from 'antd';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthHydrated } from '../hooks/useAuthHydrated';
import { useAuthStore } from '../stores/authStore';

export function AuthLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!hydrated) return <AuthLoading />;

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);

  if (!hydrated) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'HOST' && user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function RequireBuyer({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!hydrated) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role === 'HOST' || user.role === 'ADMIN') {
    return <Navigate to="/login" replace state={{ staffBlocked: true }} />;
  }
  return <>{children}</>;
}
