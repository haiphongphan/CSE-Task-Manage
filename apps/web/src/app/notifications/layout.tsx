import { AppShell } from '@/components/AppShell';

// Trang dùng chung cho mọi vai trò (nội dung tự điều chỉnh theo vai trò)
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={['ADMIN', 'BCH', 'BTT']}>{children}</AppShell>;
}
