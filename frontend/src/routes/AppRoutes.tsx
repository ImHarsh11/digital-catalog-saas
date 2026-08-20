import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { homeRouteForRole } from '@/utils/roleRouting';
import ProtectedRoute from '@/components/ProtectedRoute';
import Spinner from '@/components/Spinner';
import SuperAdminLayout from '@/layouts/SuperAdminLayout';
import LoginPage from '@/pages/LoginPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ShopOwnerHomePage from '@/pages/admin/ShopOwnerHomePage';
import DashboardPage from '@/pages/super-admin/DashboardPage';
import ShopDetailPage from '@/pages/super-admin/ShopDetailPage';
import ShopsPage from '@/pages/super-admin/ShopsPage';

function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={homeRouteForRole(user.role)} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
        <Route element={<SuperAdminLayout />}>
          <Route path="/super-admin" element={<DashboardPage />} />
          <Route path="/super-admin/shops" element={<ShopsPage />} />
          <Route path="/super-admin/shops/:id" element={<ShopDetailPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['SHOP_OWNER']} />}>
        <Route path="/admin" element={<ShopOwnerHomePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
