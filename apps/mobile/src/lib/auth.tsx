// Context đăng nhập cho app mobile + khởi động thông báo sau khi đăng nhập
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { api, tokenStore } from './api';
import { clearApiCache } from './useApi';
import { pollAndNotify, setupNotifications, unregisterPush, type PushMode } from './notifications';
import type { Role, User } from './types';
import { openTab } from './workspace';

interface AuthState {
  user: User | null;
  loading: boolean;
  pushMode: PushMode;
  pushReason?: string;
  login: (login: string, password: string) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Mọi vai trò đều vào màn /home; tab mở sẵn tuỳ vai trò (xem lib/workspace.ts) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const homeOf = (_role: Role) => '/home';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [push, setPush] = useState<{ mode: PushMode; reason?: string }>({ mode: 'off' });
  const lastId = useRef(0);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return setUser(null);
    try {
      const res = await api<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch {
      await tokenStore.clear();
      setUser(null);
    }
  }, []);

  // Mở app: đọc token đã lưu
  useEffect(() => {
    tokenStore.onUnauthorized(() => {
      void tokenStore.clear();
      setUser(null);
    });
    tokenStore
      .load()
      .then(refresh)
      .finally(() => setLoading(false));
  }, [refresh]);

  // Đã đăng nhập: bật thông báo
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    setupNotifications().then((r) => {
      if (cancelled) return;
      setPush({ mode: r.mode, reason: r.reason });
      if (r.mode !== 'polling') return;
      // Chế độ demo: hỏi API mỗi 30 giây khi app đang mở
      const tick = () => {
        if (AppState.currentState !== 'active') return;
        pollAndNotify(lastId.current)
          .then((id) => (lastId.current = id))
          .catch(() => {});
      };
      tick();
      timer = setInterval(tick, 30_000);
    });

    // Bấm vào thông báo -> mở chi tiết sự kiện
    const sub =
      Platform.OS !== 'web'
        ? Notifications.addNotificationResponseReceivedListener((resp) => {
            const data = resp.notification.request.content.data ?? {};
            // Bản tin 09:00 -> mở tab Nhắc nhở thông minh; thông báo khác -> mở sự kiện
            if (data.screen === 'reminders' || data.type === 'DAILY_DIGEST') openTab('btt/reminders');
            else if (data.eventId) router.push(`/events/${data.eventId}`);
          })
        : null;

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      sub?.remove();
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (loginId: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { login: loginId, password } });
    await tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await api<{ token: string; user: User }>('/auth/register', { method: 'POST', body: data });
    await tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await unregisterPush();
    await tokenStore.clear();
    clearApiCache();
    lastId.current = 0;
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, pushMode: push.mode, pushReason: push.reason, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}

/** Chặn màn hình theo vai trò: sai vai trò -> về trang chủ của vai trò đó */
export function useRoleAllowed(...roles: Role[]) {
  const { user } = useAuth();
  const ok = !!user && roles.includes(user.role);
  useEffect(() => {
    if (user && !ok) router.replace(homeOf(user.role) as never);
  }, [user, ok]);
  return ok;
}
