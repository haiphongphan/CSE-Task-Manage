'use client';
// =====================================================================
// Bật / tắt thông báo đẩy (Web Push) trên thiết bị đang dùng.
//
// Trên iPhone (iOS 16.4+), Web Push CHỈ hoạt động khi web đã được
// "Thêm vào màn hình chính" và mở từ icon đó. Mở trong Safari thường thì
// trình duyệt không có PushManager -> phải hướng dẫn cài trước.
// Việc xin quyền phải xảy ra ngay sau một cú bấm của người dùng (Apple yêu cầu).
// =====================================================================
import { api } from './api';

export type PushState =
  | 'unsupported' // trình duyệt không hỗ trợ
  | 'ios-install' // iPhone/iPad nhưng chưa "Thêm vào MH chính"
  | 'server-off' // API chưa cấu hình khoá VAPID
  | 'denied' // người dùng đã chặn thông báo -> phải mở Cài đặt để bật lại
  | 'off' // chưa bật
  | 'on'; // đã bật trên thiết bị này

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad mới báo là "Macintosh" nhưng có màn hình cảm ứng
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Đăng ký service worker (gọi một lần khi mở app) */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  } catch (e) {
    console.warn('[sw] không đăng ký được service worker', e);
    return null;
  }
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

let serverKey: { enabled: boolean; publicKey: string | null } | null = null;
async function getServerKey() {
  serverKey ??= await api<{ enabled: boolean; publicKey: string | null }>('/push/web/public-key');
  return serverKey;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const key = await getServerKey().catch(() => null);
  if (!key?.enabled) return 'server-off';
  const sub = await currentSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Khoá VAPID dạng base64url -> mảng byte cho pushManager.subscribe */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Bật thông báo: xin quyền -> đăng ký với dịch vụ push -> gửi đăng ký lên API */
export async function enablePush(): Promise<PushState> {
  const key = await getServerKey();
  if (!key.enabled || !key.publicKey) return 'server-off';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await registerServiceWorker());
  if (!reg) throw new Error('Không đăng ký được service worker');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  try {
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true, // bắt buộc: mọi push đều phải hiện thông báo
      applicationServerKey: urlBase64ToUint8Array(key.publicKey),
    });
  } catch (e) {
    throw new Error(
      `Không đăng ký được với dịch vụ thông báo của trình duyệt. Kiểm tra kết nối mạng rồi thử lại. (${(e as Error).message})`,
    );
  }
  await api('/push/web/subscriptions', { method: 'POST', body: sub.toJSON() });
  return 'on';
}

/** Tắt thông báo trên thiết bị này (cũng gọi khi đăng xuất) */
export async function disablePush() {
  if (!pushSupported()) return;
  const sub = await currentSubscription();
  if (!sub) return;
  await api('/push/web/subscriptions', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Gửi thử một thông báo tới mọi thiết bị đã bật của mình */
export const sendTestPush = () => api<{ devices: number; sent: number; expired: number; errors: string[] }>('/push/web/test', { method: 'POST' });
