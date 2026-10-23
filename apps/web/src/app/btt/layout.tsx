import { AppShell } from '@/components/AppShell';

// Mọi trang trong /btt chỉ dành cho vai trò BTT
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={['BTT']}>{children}</AppShell>;
}
