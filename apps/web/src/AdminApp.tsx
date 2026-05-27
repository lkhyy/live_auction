import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireStaff } from './components/RequireAuth';
import AdminLayout from './layouts/AdminLayout';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminHostSettingsPage from './pages/admin/AdminHostSettingsPage';
import AdminLiveConsolePage from './pages/admin/AdminLiveConsolePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';

function adminRouterBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (!base || base === '/') return undefined;
  return base.replace(/\/$/, '');
}

export default function AdminApp() {
  return (
    <BrowserRouter basename={adminRouterBasename()}>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <RequireStaff>
                <AdminLayout />
              </RequireStaff>
            </RequireAuth>
          }
        >
          <Route index element={<AdminLiveConsolePage />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="settings" element={<AdminHostSettingsPage />} />
          <Route path="lots" element={<Navigate to="/" replace />} />
          <Route path="auctions" element={<Navigate to="/dashboard" replace />} />
          <Route path="live-rooms" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
