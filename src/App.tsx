import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
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
import ActivityList from './components/activity/ActivityList';
import SettingsTabs from './components/settings/SettingsTabs';
import LocationSettings from './components/settings/LocationSettings';
import CategorySettings from './components/settings/CategorySettings';
import ProductTypeSettings from './components/settings/ProductTypeSettings';
import ProviderSettings from './components/settings/ProviderSettings';
import WooCommerceSettings from './components/settings/WooCommerceSettings';

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
          
          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
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
            
            {/* Settings Routes with Tabs */}
            <Route path="settings" element={<SettingsTabs />}>
              <Route index element={<Navigate to="/settings/locations" replace />} />
              <Route path="locations" element={<LocationSettings />} />
              <Route path="categories" element={<CategorySettings />} />
              <Route path="product-types" element={<ProductTypeSettings />} />
              <Route path="providers" element={<ProviderSettings />} />
              <Route path="woocommerce" element={<WooCommerceSettings />} />
            </Route>
          </Route>
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;