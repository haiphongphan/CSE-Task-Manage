// =====================================================================
// Web Push — thông báo cho web app (PWA): iPhone đã "Thêm vào MH chính"
// (iOS 16.4+), Chrome/Edge/Firefox trên Android và máy tính.
// ---------------------------------------------------------------------
// Cách hoạt động:
//  1. Trình duyệt đăng ký với dịch vụ push của hãng (Apple, Google, Mozilla)
//     và trả về một "subscription": endpoint + 2 khoá (p256dh, auth).
//  2. Web gửi subscription lên API -> lưu bảng web_push_subscriptions.
//  3. Khi cần báo, API mã hoá nội dung bằng 2 khoá đó, ký bằng khoá VAPID
//     của mình rồi POST tới endpoint. Hãng chuyển tới đúng máy, service
//     worker (apps/web/public/sw.js) nhận và hiện thông báo.
// Chưa đặt VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY -> chỉ in ra console.
// =====================================================================
import webpush from 'web-push';
import { config } from '../config';

export interface WebPushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  /** Đường dẫn mở khi bấm vào thông báo, VD /events/3 */
  url: string;
  /** Thông báo cùng tag sẽ thay thế nhau (VD bản tin hôm nay thay bản tin hôm qua) */
  tag?: string;
}

export const webPushEnabled = () => !!(config.vapidPublicKey && config.vapidPrivateKey);

let configured = false;
function setup() {
  if (configured || !webPushEnabled()) return;
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey!, config.vapidPrivateKey!);
  configured = true;
}

/** Gửi tới nhiều thiết bị. Trả về số gửi thành công + endpoint đã hết hạn (nên xoá) */
export async function sendWebPush(targets: WebPushTarget[], payload: WebPushPayload) {
  const expired: string[] = [];
  const errors: { status?: number; message: string }[] = []; // để "Gửi thử" báo rõ lý do
  let sent = 0;
  if (targets.length === 0) return { sent, expired, errors };

  if (!webPushEnabled()) {
    console.log(`[webpush:log] → ${targets.length} thiết bị | ${payload.title} — ${payload.body} (${payload.url})`);
    return { sent: targets.length, expired, errors };
  }
  setup();

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: 'high' }, // giữ tối đa 12 giờ nếu máy đang tắt mạng
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: người dùng đã tắt thông báo / gỡ web app -> xoá subscription
        const body = (err as { body?: string }).body;
        const message = body ? `${(err as Error).message} — ${body}` : (err as Error).message;
        errors.push({ status, message });
        if (status === 404 || status === 410) expired.push(t.endpoint);
        else console.error(`[webpush] lỗi ${status ?? ''}:`, message);
      }
    }),
  );
  if (sent) console.log(`[webpush] đã gửi ${sent}/${targets.length} thiết bị | ${payload.title}`);
  return { sent, expired, errors };
}
