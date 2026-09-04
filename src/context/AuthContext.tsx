import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../lib/api';
import { getAccessToken, setAccessToken, clearAccessToken, setRefreshToken, clearRefreshToken } from '../lib/tokenStore';
import { onSessionExpired } from '../lib/authEvents';
import { unregisterToken } from '../lib/push/registration';
import type { User } from '../types/user';

const STORAGE_KEY = 'nottepe_auth_user';

interface LoginResult {
  success: boolean;
  error?: string;
  email?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { username: string; password: string }) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(async () => {
    await clearAccessToken();
    await clearRefreshToken();
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  // İlk açılışta: SecureStore'da token varsa oturumu geri yükle.
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (token && raw) {
          setUser(JSON.parse(raw));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => onSessionExpired(() => clearSession()), [clearSession]);

  const login = async (credentials: { username: string; password: string }): Promise<LoginResult> => {
    try {
      const response = await authAPI.login(credentials);
      const { user: userData, accessToken, refreshToken } = response.data;
      if (accessToken) {
        await setAccessToken(accessToken);
      }
      if (refreshToken) {
        await setRefreshToken(refreshToken);
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Giriş yapılırken bir hata oluştu',
        email: error.response?.data?.email || null,
      };
    }
  };

  const logout = async () => {
    // `unregisterToken` ÖNCE: POST'un canlı Bearer'a ihtiyacı var, `clearSession`
    // SecureStore'u siliyor. `clearSession`'a KONULMADI — orası aynı zamanda
    // `onSessionExpired` yolu, o durumda token zaten ölü ve POST 401 alıp refresh
    // interceptor'ında döner; kalan temizlik backend'in receipt taraması.
    await unregisterToken();
    try {
      await authAPI.logout();
    } catch {
      /* ignore */
    } finally {
      await clearSession();
    }
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
