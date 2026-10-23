import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'CSE Task Manage',
  description: 'Quản lý công việc cho từng sự kiện — BCH tạo sự kiện, BTT nhận task và nhắc hạn chót.',
  // iPhone: mở từ màn hình chính sẽ chạy toàn màn hình như app (không có thanh Safari)
  appleWebApp: { capable: true, title: 'CSE Task', statusBarStyle: 'black-translucent' },
  other: { 'apple-mobile-web-app-capable': 'yes' }, // thẻ cũ cho iOS, thêm cho chắc
};

export const viewport: Viewport = {
  themeColor: '#03045e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // dùng cả vùng "tai thỏ"; header tự chừa khoảng an toàn (safe-area)
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
