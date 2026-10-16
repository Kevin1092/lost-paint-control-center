import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api/client';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setupNeeded: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  setupAdmin: (data: any) => Promise<void>;
  acceptInvite: (data: any) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const { success, error } = useToast();

  const refreshUser = async () => {
    try {
      const setupRes = await api.checkSetupNeeded();
      setSetupNeeded(setupRes.setupNeeded);

      if (!setupRes.setupNeeded) {
        const meRes = await api.getMe();
        setUser(meRes.user);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: any) => {
    try {
      const res = await api.login(credentials);
      if (res.token) {
        localStorage.setItem('lost_paint_token', res.token);
      }
      setUser(res.user);
      success(`Welcome back, ${res.user.display_name}!`);
    } catch (err: any) {
      error(err.message || 'Login failed.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      // Ignore network failure on logout
    } finally {
      localStorage.removeItem('lost_paint_token');
      setUser(null);
      success('Logged out successfully.');
    }
  };

  const setupAdmin = async (data: any) => {
    try {
      const res = await api.setupAdmin(data);
      if (res.token) {
        localStorage.setItem('lost_paint_token', res.token);
      }
      setUser(res.user);
      setSetupNeeded(false);
      success('Studio founder account created and activated!');
    } catch (err: any) {
      error(err.message || 'Failed to setup admin account.');
      throw err;
    }
  };

  const acceptInvite = async (data: any) => {
    try {
      const res = await api.acceptInvite(data);
      if (res.token) {
        localStorage.setItem('lost_paint_token', res.token);
      }
      setUser(res.user);
      success('Invitation accepted and account activated!');
    } catch (err: any) {
      error(err.message || 'Failed to accept invitation.');
      throw err;
    }
  };

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setupNeeded,
        isAdmin,
        canEdit,
        login,
        logout,
        setupAdmin,
        acceptInvite,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
