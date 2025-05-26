import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import ProductList from './components/inventory/ProductList';
import ProductDetails from './components/inventory/ProductDetails';
import ProductCreate from './components/inventory/ProductCreate';
import OrderList from './components/orders/OrderList';
import OrderCreate from './components/orders/OrderCreate';
import OrderDetails from './components/orders/OrderDetails';
import PackingSlip from './components/orders/PackingSlip';
import GlobalPackingSlip from './components/orders/GlobalPackingSlip';
import GlobalPackingSlipV2 from './components/orders/GlobalPackingSlipV2';
import ActivityList from './components/activity/ActivityList';
import SettingsTabs from './components/settings/SettingsTabs';
import LocationSettings from './components/settings/LocationSettings';
import CategorySettings from './components/settings/CategorySettings';
import ProductTypeSettings from './components/settings/ProductTypeSettings';
import ProviderSettings from './components/settings/ProviderSettings';
import WooCommerceSettings from './components/settings/WooCommerceSettings';
import LowStockAlertList from './components/alerts/LowStockAlertList';

// User Management Components
import UserList from './components/users/UserList';
import UserCreate from './components/users/UserCreate';
import UserEdit from './components/users/UserEdit';
import UserProfile from './components/users/UserProfile';

// CRM Components
import CRMHome from './components/crm/CRMHome';
import ClientList from './components/crm/ClientList';
import ClientCreate from './components/crm/ClientCreate';
import ClientDetails from './components/crm/ClientDetails';
import ClientEdit from './components/crm/ClientEdit';

// Reporting Components
import ReportingLayout from './components/reporting/ReportingLayout';
import ReportingHome from './components/reporting/ReportingHome';
import SAGAExport from './components/reporting/SAGAExport';
import InventoryReports from './components/reporting/InventoryReports';
import SalesReports from './components/reporting/SalesReports';
import CustomReports from './components/reporting/CustomReports';
import ExportCenter from './components/reporting/ExportCenter';
import ReportsDashboard from './components/reporting/ReportsDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route 
            path="/login" 
            element={
              <ProtectedRoute requireAuth={false}>
                <Login />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <ProtectedRoute requireAuth={false}>
                <Register />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              <ProtectedRoute requireAuth={false}>
                <ForgotPassword />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard\" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Products Routes */}
            <Route path="products" element={<ProductList />} />
            <Route path="products/new" element={<ProductCreate />} />
            <Route path="products/:id" element={<ProductDetails />} />
            
            {/* Activity Routes */}
            <Route path="activities" element={<ActivityList />} />
            
            {/* Orders Routes */}
            <Route path="orders" element={<OrderList />} />
            <Route path="orders/new" element={<OrderCreate />} />
            <Route path="orders/:id" element={<OrderDetails />} />
            <Route path="orders/:id/packingslip" element={<PackingSlip />} />
            <Route path="orders/packingslip" element={<GlobalPackingSlip />} />
            <Route path="orders/consolidated-packingslip" element={<GlobalPackingSlipV2 />} />
            
            {/* Low Stock Alerts Route */}
            <Route path="alerts" element={<LowStockAlertList />} />
            
            {/* CRM Routes */}
            <Route path="crm" element={<CRMHome />} />
            <Route path="crm/clients" element={<ClientList />} />
            <Route path="crm/clients/new" element={<ClientCreate />} />
            <Route path="crm/clients/:id" element={<ClientDetails />} />
            <Route path="crm/clients/:id/edit" element={<ClientEdit />} />
            
            {/* Reporting Routes */}
            <Route 
              path="reporting" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <ReportingLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ReportingHome />} />
              <Route path="saga-export" element={<SAGAExport />} />
              <Route path="inventory" element={<InventoryReports />} />
              <Route path="sales" element={<SalesReports />} />
              <Route path="custom" element={<CustomReports />} />
              <Route path="export" element={<ExportCenter />} />
              <Route path="dashboard" element={<ReportsDashboard />} />
            </Route>
            
            {/* User Management Routes - Admin Only */}
            <Route 
              path="users" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <UserList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="users/new" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <UserCreate />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="users/:id" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <UserEdit />
                </ProtectedRoute>
              } 
            />
            
            {/* User Profile - Available to all logged in users */}
            <Route path="profile" element={<UserProfile />} />
            
            {/* Settings Routes with Tabs - Manager & Admin Only */}
            <Route 
              path="settings" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <SettingsTabs />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/settings/locations\" replace />} />
              <Route path="locations" element={<LocationSettings />} />
              <Route path="categories" element={<CategorySettings />} />
              <Route path="product-types" element={<ProductTypeSettings />} />
              <Route path="providers" element={<ProviderSettings />} />
              <Route path="woocommerce" element={<WooCommerceSettings />} />
            </Route>
          </Route>
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/\" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;