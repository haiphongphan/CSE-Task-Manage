// Màn chính sau khi đăng nhập: header navy + hàng tab của vai trò + nội dung các tab.
// Tab chỉ được tạo (mount) ở lần mở đầu tiên, sau đó GIỮ LẠI và chỉ ẩn/hiện
// bằng display: 'none' -> đổi tab tức thì, giữ nguyên vị trí cuộn và dữ liệu đã nhập.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { TabHeader } from '@/components/AppHeader';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { TABS, TabActiveContext, useCurrentTab, type TabKey } from '@/lib/workspace';
import AdminAccounts from '@/screens/AdminAccounts';
import AdminTasks from '@/screens/AdminTasks';
import BchEvents from '@/screens/BchEvents';
import BchNewEvent from '@/screens/BchNewEvent';
import BttEvents from '@/screens/BttEvents';
import BttReminders from '@/screens/BttReminders';

const SCREENS: Record<TabKey, ComponentType> = {
  'admin/accounts': AdminAccounts,
  'admin/tasks': AdminTasks,
  'bch/new': BchNewEvent,
  'bch/events': BchEvents,
  'btt/events': BttEvents,
  'btt/reminders': BttReminders,
};

export default function Home() {
  const { user } = useAuth();
  const role = user?.role ?? 'BTT';
  const tab = useCurrentTab(role);
  const [mounted, setMounted] = useState<TabKey[]>([]);
  const [focusTick, setFocusTick] = useState(0);

  if (!mounted.includes(tab)) setMounted([...mounted, tab]); // nạp tab ở lần mở đầu

  // Quay lại từ màn chi tiết (VD sửa sự kiện xong) -> báo các tab tải lại dữ liệu
  useFocusEffect(useCallback(() => setFocusTick((t) => t + 1), []));

  if (!user) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.ice }}>
      <TabHeader />
      {TABS[role]
        .filter((t) => mounted.includes(t.key))
        .map((t) => {
          const Screen = SCREENS[t.key];
          const active = t.key === tab;
          return (
            <View key={t.key} style={{ flex: 1, display: active ? 'flex' : 'none' }}>
              <TabActiveContext.Provider value={{ active, focusTick }}>
                <Screen />
              </TabActiveContext.Provider>
            </View>
          );
        })}
    </View>
  );
}
