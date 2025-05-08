import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminRole, isValidRole, getAvailableRoles} from '../utils/roleValidation';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  allowedGroups?: string[];
}

export default function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  allowedGroups = []
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [rolesLoaded, setRolesLoaded] = useState(false);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        await getAvailableRoles();
        setRolesLoaded(true);
      } catch (error) {
        console.error('Failed to load roles:', error);
      }
    };
    loadRoles();
  }, []);

  if (loading || !rolesLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Check if user has a valid role
  if (!isValidRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">You need a valid role to access this page.</p>
          <p className="text-gray-600">Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  // Check if admin access is required
  if (requireAdmin && !isAdminRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">This page requires administrator privileges.</p>
        </div>
      </div>
    );
  }

  // Check if user has access to specific groups
  if (allowedGroups.length > 0) {
    const userRoleName = typeof user.role === 'string' ? user.role : user.role.name;
    if (!allowedGroups.includes(userRoleName)) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
} 