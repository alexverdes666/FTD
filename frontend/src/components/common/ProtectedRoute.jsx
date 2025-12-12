import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice';

const ProtectedRoute = ({ children, allowedRoles = null, requiredPermission = null }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If no role restrictions, allow access
  if (!allowedRoles && !requiredPermission) {
    return children;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Special case for refunds: check if affiliate manager has refunds permission
    if (allowedRoles.includes("refunds_manager") && 
        user?.role === "affiliate_manager" && 
        user?.permissions?.canManageRefunds) {
      return children;
    }
    // Special case for inventory: check if user has SIM card management permission
    if (allowedRoles.includes("inventory_manager") && 
        user?.permissions?.canManageSimCards) {
      return children;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Check permission-based access
  if (requiredPermission && !user?.permissions?.[requiredPermission]) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
export default ProtectedRoute;