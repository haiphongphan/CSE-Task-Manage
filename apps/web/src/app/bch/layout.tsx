import { AppShell } from '@/components/AppShell';

// Mọi trang trong /bch chỉ dành cho vai trò BCH
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={['BCH']}>{children}</AppShell>;
}
