import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { homeRouteForRole } from '@/utils/roleRouting';
import ProtectedRoute from '@/components/ProtectedRoute';
import Spinner from '@/components/Spinner';
import SuperAdminLayout from '@/layouts/SuperAdminLayout';
import ShopOwnerLayout from '@/layouts/ShopOwnerLayout';
import LoginPage from '@/pages/LoginPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ShopCatalogPage from '@/pages/catalog/ShopCatalogPage';
import ProductDetailPage from '@/pages/catalog/ProductDetailPage';
import MySelectionPage from '@/pages/catalog/MySelectionPage';
import ShopOwnerDashboardPage from '@/pages/admin/DashboardPage';
import ProductsPage from '@/pages/admin/ProductsPage';
import ProductFormPage from '@/pages/admin/ProductFormPage';
import CategoriesPage from '@/pages/admin/CategoriesPage';
import SettingsPage from '@/pages/admin/SettingsPage';
import AnalyticsPage from '@/pages/admin/AnalyticsPage';
import LeadsPage from '@/pages/admin/LeadsPage';
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

      {/* Customer catalog -- no login, no ProtectedRoute wrapper. */}
      <Route path="/shop/:shopSlug" element={<ShopCatalogPage />} />
      <Route path="/shop/:shopSlug/product/:productId" element={<ProductDetailPage />} />
      <Route path="/shop/:shopSlug/selection" element={<MySelectionPage />} />

      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
        <Route element={<SuperAdminLayout />}>
          <Route path="/super-admin" element={<DashboardPage />} />
          <Route path="/super-admin/shops" element={<ShopsPage />} />
          <Route path="/super-admin/shops/:id" element={<ShopDetailPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['SHOP_OWNER']} />}>
        <Route element={<ShopOwnerLayout />}>
          <Route path="/admin" element={<ShopOwnerDashboardPage />} />
          <Route path="/admin/products" element={<ProductsPage />} />
          <Route path="/admin/products/new" element={<ProductFormPage />} />
          <Route path="/admin/products/:id/edit" element={<ProductFormPage />} />
          <Route path="/admin/categories" element={<CategoriesPage />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/leads" element={<LeadsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
