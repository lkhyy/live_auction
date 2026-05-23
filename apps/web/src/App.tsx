import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AdminLayout from './layouts/AdminLayout';
import MobileLayout from './layouts/MobileLayout';
import LoginPage from './pages/LoginPage';
import LiveRoomPage from './pages/LiveRoomPage';
import AdminLotsPage from './pages/admin/AdminLotsPage';
import AdminAuctionsPage from './pages/admin/AdminAuctionsPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AuctionListPage from './pages/AuctionListPage';
import MobileHomePage from './pages/mobile/MobileHomePage';
import MobileAuctionDetailPage from './pages/mobile/MobileAuctionDetailPage';
import MobileLiveRoomPage from './pages/mobile/MobileLiveRoomPage';
import MobileOrdersPage from './pages/mobile/MobileOrdersPage';
import MobileHistoryPage from './pages/mobile/MobileHistoryPage';
import MobileRoomPage from './pages/mobile/MobileRoomPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'HOST' || user?.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/m" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomeRedirect />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="lots" element={<AdminLotsPage />} />
          <Route path="auctions" element={<AdminAuctionsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
        </Route>
        <Route
          path="/m"
          element={
            <PrivateRoute>
              <MobileLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<MobileHomePage />} />
          <Route path="room/:roomId" element={<MobileRoomPage />} />
          <Route path="auctions/:auctionId" element={<MobileAuctionDetailPage />} />
          <Route path="live/:auctionId" element={<MobileLiveRoomPage />} />
          <Route path="orders" element={<MobileOrdersPage />} />
          <Route path="history" element={<MobileHistoryPage />} />
        </Route>
        <Route
          path="/live/:auctionId"
          element={
            <PrivateRoute>
              <LiveRoomPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/auctions"
          element={
            <PrivateRoute>
              <AuctionListPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
