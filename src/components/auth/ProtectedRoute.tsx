import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requiredRoles?: Array<'admin' | 'manager' | 'staff'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true,
  requiredRoles = ['admin', 'manager', 'staff']
}) => {
  const { currentUser } = useAuth();
  const location = useLocation();

  // User is not logged in but route requires authentication
  if (!currentUser && requireAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is logged in but doesn't have the required role
  if (currentUser && requireAuth && requiredRoles.length > 0) {
    if (!requiredRoles.includes(currentUser.role)) {
      // Redirect to dashboard with unauthorized access
      return <Navigate to="/dashboard" state={{ unauthorized: true }} replace />;
    }
  }

  // User is logged in but trying to access login/register pages
  if (currentUser && !requireAuth) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;