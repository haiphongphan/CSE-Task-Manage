// Nhóm màn hình cần đăng nhập. "(app)" là route group: không xuất hiện trong URL.
//  * home         : màn chính của từng vai trò, gồm nhiều tab (đổi tab không tải lại)
//  * còn lại      : màn chi tiết đẩy chồng lên (events/[id], notifications, bch/edit/[id])
import { Redirect, Stack } from 'expo-router';
import { StackHeader } from '@/components/AppHeader';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password" />;
  return (
    <Stack screenOptions={{ header: () => <StackHeader />, animation: 'slide_from_right' }}>
      <Stack.Screen name="home" options={{ headerShown: false }} />
    </Stack>
  );
}
