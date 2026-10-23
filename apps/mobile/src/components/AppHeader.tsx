// Thanh đầu trang (Figma Mobile: logo + chuông + avatar, hàng tab bên dưới)
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { colors } from '@/lib/theme';
import type { Role } from '@/lib/types';
import { Avatar, Icon, T } from './ui';

export const NAV: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: '/admin/accounts', label: 'Tài khoản' },
    { href: '/admin/tasks', label: 'Quản lý task' },
  ],
  BCH: [
    { href: '/bch/event-form', label: 'Tạo sự kiện' },
    { href: '/bch/events', label: 'Sự kiện của tôi' },
  ],
  BTT: [
    { href: '/btt/events', label: 'Không gian làm việc' },
    { href: '/btt/reminders', label: 'Nhắc nhở thông minh' },
  ],
};

export function AppHeader() {
  const { user, logout, pushMode } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const { data } = useApi<{ unreadCount: number }>(user ? '/notifications?limit=1' : null, { pollMs: 30_000 });
  if (!user) return null;

  return (
    <View style={{ backgroundColor: colors.navy, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="layers" size={18} color={colors.white} />
        </View>
        <T size={16} weight="bold" color={colors.white} style={{ flex: 1 }}>
          CSE Task Manage
        </T>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityLabel="Thông báo">
          <Icon name="bell" size={20} color={colors.white} />
          {!!data?.unreadCount && (
            <View style={{ position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <T size={10} weight="bold">
                {data.unreadCount > 9 ? '9+' : data.unreadCount}
              </T>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => setMenu(true)} style={{ marginLeft: 8 }} accessibilityLabel="Tài khoản">
          <Avatar name={user.fullName} size={32} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {NAV[user.role].map((n) => {
          const active = pathname === n.href;
          return (
            <Pressable
              key={n.href}
              onPress={() => router.replace(n.href as never)}
              style={{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : 'transparent' }}
            >
              <T size={12} color={colors.white}>
                {n.label}
              </T>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,4,94,0.3)' }} onPress={() => setMenu(false)}>
          <View style={{ position: 'absolute', right: 16, top: insets.top + 56, width: 260, backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.divider }}>
              <T weight="medium">{user.fullName}</T>
              <T size={11} color={colors.muted}>
                @{user.username} · {user.role}
              </T>
              <T size={10} color={colors.primary} style={{ marginTop: 6 }}>
                Thông báo: {pushMode === 'push' ? 'Push thật (Expo)' : pushMode === 'polling' ? 'Chế độ demo (khi app mở)' : 'Đang tắt'}
              </T>
            </View>
            <Pressable
              style={{ flexDirection: 'row', gap: 10, padding: 16 }}
              onPress={() => {
                setMenu(false);
                router.push('/change-password');
              }}
            >
              <Icon name="key" />
              <T>Đổi mật khẩu</T>
            </Pressable>
            <Pressable
              style={{ flexDirection: 'row', gap: 10, padding: 16 }}
              onPress={() => {
                setMenu(false);
                void logout();
              }}
            >
              <Icon name="log-out" />
              <T>Đăng xuất</T>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
