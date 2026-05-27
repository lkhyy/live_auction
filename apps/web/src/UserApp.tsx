import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireBuyer } from './components/RequireAuth';
import MobileLayout from './layouts/MobileLayout';
import UserLoginPage from './pages/UserLoginPage';
import MobileHomePage from './pages/mobile/MobileHomePage';
import MobileAuctionDetailPage from './pages/mobile/MobileAuctionDetailPage';
import MobileLiveRoomPage from './pages/mobile/MobileLiveRoomPage';
import MobileOrdersPage from './pages/mobile/MobileOrdersPage';
import MobileParticipationsPage from './pages/mobile/MobileParticipationsPage';
import MobileSettingsPage from './pages/mobile/MobileSettingsPage';
import MobileRoomPage from './pages/mobile/MobileRoomPage';

export default function UserApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<UserLoginPage />} />
        <Route path="/" element={<Navigate to="/m" replace />} />
        {/* 浏览无需登录；出价/订单需买家登录 */}
        <Route path="/m" element={<MobileLayout />}>
          <Route index element={<MobileHomePage />} />
          <Route path="room/:roomId" element={<MobileRoomPage />} />
          <Route path="auctions/:auctionId" element={<MobileAuctionDetailPage />} />
          <Route path="live/:auctionId" element={<MobileLiveRoomPage />} />
          <Route
            path="orders"
            element={
              <RequireAuth>
                <RequireBuyer>
                  <MobileOrdersPage />
                </RequireBuyer>
              </RequireAuth>
            }
          />
          <Route
            path="participations"
            element={
              <RequireAuth>
                <RequireBuyer>
                  <MobileParticipationsPage />
                </RequireBuyer>
              </RequireAuth>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAuth>
                <RequireBuyer>
                  <MobileSettingsPage />
                </RequireBuyer>
              </RequireAuth>
            }
          />
          <Route path="history" element={<Navigate to="/m/participations" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/m" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
