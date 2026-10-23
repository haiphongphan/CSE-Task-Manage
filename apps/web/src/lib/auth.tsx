'use client';
// Context đăng nhập: giữ user hiện tại cho toàn app, cung cấp login/logout.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokenStore } from './api';
import type { Role, User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Trang chủ của từng vai trò */
export const homeOf = (role: Role) =>
  role === 'ADMIN' ? '/admin/accounts' : role === 'BCH' ? '/bch/events' : '/btt/events';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      return;
    }
    try {
      const res = await api<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (loginId: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { login: loginId, password },
    });
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await api<{ token: string; user: User }>('/auth/register', { method: 'POST', body: data });
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}

/**
 * Bảo vệ trang: chưa đăng nhập -> /login; sai vai trò -> về trang chủ của vai trò đó.
 * Trả về user khi đã hợp lệ, null khi đang chờ.
 */
export function useRequireRole(...roles: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && (roles.length === 0 || roles.includes(user.role));

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.mustChangePassword) router.replace('/change-password');
    else if (!allowed) router.replace(homeOf(user.role));
  }, [loading, user, allowed, router]);

  return allowed && !user?.mustChangePassword ? user : null;
}
