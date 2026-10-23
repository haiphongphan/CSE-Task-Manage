// =====================================================================
// Service worker — chạy NỀN, kể cả khi đã đóng web app.
// Nhiệm vụ: nhận Web Push từ API (apps/api/src/push/webpush.ts) và hiện
// thông báo; bấm vào thông báo thì mở đúng trang.
// File nằm trong public/ nên được phục vụ tại /sw.js (phạm vi: toàn site).
// =====================================================================

self.addEventListener('install', () => self.skipWaiting()); // bản mới có hiệu lực ngay
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// API gửi JSON: { title, body, url, tag }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'CSE Task Manage', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'CSE Task Manage';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag, // cùng tag thì thông báo mới thay thông báo cũ (VD bản tin mỗi sáng)
      data: { url: data.url || '/' },
    }),
  );
});

// Bấm vào thông báo: nếu web app đang mở thì chuyển tới trang đó, chưa mở thì mở mới
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
