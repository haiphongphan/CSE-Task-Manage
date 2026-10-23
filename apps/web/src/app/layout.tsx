import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'CSE Task Manage',
  description: 'Quản lý công việc cho từng sự kiện — BCH tạo sự kiện, BTT nhận task và nhắc hạn chót.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi">
      <body className="min-h-screen font-sans antialiased">
        {/* AuthProvider là Client Component: giữ thông tin đăng nhập cho mọi trang */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
