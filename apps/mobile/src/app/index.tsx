// Mở app: chuyển tới trang chủ theo vai trò hoặc trang đăng nhập
import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { homeOf, useAuth } from '@/lib/auth';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password" />;
  return <Redirect href={homeOf(user.role) as never} />;
}
