import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { convertToUserGroup } from '../utils/roleValidation';
import { User } from '../types/user';
import { getApiUrl, getAuthUrl } from '../config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      console.log('Checking user authentication...');
      const response = await fetch(getApiUrl('/auth/me'), {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('Auth check response:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        if (typeof userData.role === 'string') {
          userData.role = convertToUserGroup(userData.role);
        }
        setUser(userData);
      } else {
        console.log('Auth check failed');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = getAuthUrl('/auth/google');
  };

  const logout = async () => {
    try {
      await fetch(getApiUrl('/auth/logout'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Failed to logout');
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 