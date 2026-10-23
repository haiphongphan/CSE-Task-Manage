import { AppShell } from '@/components/AppShell';

// Mọi trang trong /admin chỉ dành cho vai trò ADMIN
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={['ADMIN']}>{children}</AppShell>;
}
