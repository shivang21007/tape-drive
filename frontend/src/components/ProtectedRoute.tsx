import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminRole, isValidRole, getAvailableRoles } from '../utils/roleValidation';

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

  // Get user role name
  const userRoleName = typeof user.role === 'string' ? user.role : user.role.name;

  // Check if admin access is required
  if (requireAdmin && userRoleName !== 'admin') {
    return <Navigate to="/" />;
  }

  // Check if user has access to specific groups
  if (allowedGroups.length > 0 && !allowedGroups.includes(userRoleName)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
} 