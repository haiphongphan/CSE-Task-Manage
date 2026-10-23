// Thanh đầu trang (Figma Mobile: logo + chuông + avatar, hàng tab bên dưới).
//  * <TabHeader>  : header của màn /home kèm hàng tab -> bấm tab chỉ đổi tab
//                   đã nạp sẵn, KHÔNG tải lại trang (hết bị khựng).
//  * <StackHeader>: cho màn chi tiết (có nút quay lại).
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { colors } from '@/lib/theme';
import { setTab, TABS, useCurrentTab } from '@/lib/workspace';
import { Avatar, Icon, T } from './ui';

function TopRow({ back }: { back?: boolean }) {
  const { user, logout, pushMode } = useAuth();
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const { data } = useApi<{ unreadCount: number }>(user ? '/notifications?limit=1' : null, { pollMs: 30_000 });
  if (!user) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {back ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Quay lại"
        >
          <Icon name="arrow-left" size={18} color={colors.white} />
        </Pressable>
      ) : (
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="layers" size={18} color={colors.white} />
        </View>
      )}
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

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,4,94,0.3)' }} onPress={() => setMenu(false)}>
          <View style={{ position: 'absolute', right: 16, top: insets.top + 56, width: 270, backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.divider }}>
              <T weight="medium">{user.fullName}</T>
              <T size={11} color={colors.muted}>
                @{user.username} · {user.role}
              </T>
              <T size={10} color={colors.primary} style={{ marginTop: 6 }}>
                Thông báo: {pushMode === 'push' ? 'Push thật (Expo)' : pushMode === 'polling' ? 'Chế độ demo (khi app mở)' : 'Đang tắt'}
              </T>
            </View>
            <MenuItem icon="key" label="Đổi mật khẩu" onPress={() => (setMenu(false), router.push('/change-password'))} />
            <MenuItem icon="log-out" label="Đăng xuất" onPress={() => (setMenu(false), void logout())} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const MenuItem = ({ icon, label, onPress }: { icon: 'key' | 'log-out'; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, padding: 16, backgroundColor: pressed ? colors.soft : colors.white })}>
    <Icon name={icon} />
    <T>{label}</T>
  </Pressable>
);

/** tabBar tuỳ biến: header navy + hàng tab của vai trò hiện tại */
export function TabHeader() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const current = useCurrentTab(user?.role ?? 'BTT');
  if (!user) return null;

  return (
    <View style={{ backgroundColor: colors.navy, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
      <TopRow />
      <View style={{ flexDirection: 'row', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 }}>
        {TABS[user.role].map((tab) => {
          const active = current === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => !active && setTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{ flex: 1, minHeight: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : 'transparent' }}
            >
              <T size={12} weight={active ? 'medium' : 'regular'} color={colors.white}>
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Header cho màn chi tiết (đẩy lên trên các tab) */
export function StackHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.navy, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
      <TopRow back />
    </View>
  );
}
