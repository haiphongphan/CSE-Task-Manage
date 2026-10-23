// Web App Manifest — cho phép "Thêm vào màn hình chính" trên iPhone/Android
// và mở web toàn màn hình như một app (display: standalone).
// Next.js tự phục vụ file này tại /manifest.webmanifest và gắn thẻ <link> vào <head>.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CSE Task Manage',
    short_name: 'CSE Task',
    description: 'Quản lý công việc cho từng sự kiện, nhắc hạn chót mỗi sáng.',
    lang: 'vi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#caf0f8',
    theme_color: '#03045e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
