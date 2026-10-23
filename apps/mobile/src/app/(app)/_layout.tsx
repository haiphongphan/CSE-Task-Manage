// Nhóm màn hình cần đăng nhập. "(app)" là route group: không xuất hiện trong URL.
import { Redirect, Stack } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password" />;
  return <Stack screenOptions={{ header: () => <AppHeader />, animation: 'slide_from_right' }} />;
}
