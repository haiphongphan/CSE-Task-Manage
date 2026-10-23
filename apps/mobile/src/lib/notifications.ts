// =====================================================================
// Thông báo trên điện thoại — thiết kế để chạy được NGAY (demo) và
// chuyển sang push thật sau này mà không phải viết lại.
//
// Chế độ 1 · PUSH THẬT (khi có development build + EAS projectId):
//   app lấy Expo Push Token -> gửi lên API (POST /push-tokens)
//   -> API (PUSH_PROVIDER=expo) đẩy thông báo qua Expo Push Service,
//   điện thoại nhận được cả khi app đã tắt.
//
// Chế độ 2 · DEMO (Expo Go / máy ảo / chưa cấu hình):
//   app hỏi API mỗi 30 giây có thông báo mới không (GET /notifications?after=<id>)
//   và tự hiện "local notification" trên máy. Chỉ chạy khi app đang mở.
// =====================================================================
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { storage } from './storage';
import type { AppNotification } from './types';

// Hiện banner kể cả khi app đang mở
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type PushMode = 'push' | 'polling' | 'off';

/** Xin quyền + đăng ký push. Trả về chế độ đang dùng. */
export async function setupNotifications(): Promise<{ mode: PushMode; token?: string; reason?: string }> {
  if (Platform.OS === 'web') return { mode: 'off', reason: 'Bản web dùng chuông thông báo' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Nhắc nhở',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0077B6',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { mode: 'off', reason: 'Bạn chưa cho phép thông báo' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!Device.isDevice || !projectId) {
    return {
      mode: 'polling',
      reason: !Device.isDevice ? 'Máy ảo không nhận được push thật' : 'Chưa cấu hình EAS projectId (xem README)',
    };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/push-tokens', { method: 'POST', body: { token, platform: Platform.OS } });
    await storage.set('cse_push_token', token);
    return { mode: 'push', token };
  } catch (e) {
    // VD: Expo Go trên Android không hỗ trợ push từ xa -> quay về chế độ demo
    return { mode: 'polling', reason: (e as Error).message };
  }
}

/** Gỡ token khi đăng xuất để máy này không nhận thông báo của tài khoản cũ */
export async function unregisterPush() {
  const token = await storage.get('cse_push_token');
  if (!token) return;
  await api('/push-tokens', { method: 'DELETE', body: { token } }).catch(() => {});
  await storage.remove('cse_push_token');
}

/** Chế độ demo: lấy thông báo mới hơn lastId và hiện local notification */
export async function pollAndNotify(lastId: number): Promise<number> {
  const res = await api<{ items: AppNotification[] }>(`/notifications?limit=20&after=${lastId}`);
  const fresh = res.items.filter((n) => n.id > lastId && !n.isRead);
  if (lastId > 0) {
    // lastId = 0 là lần đầu mở app: chỉ ghi nhớ mốc, không bắn lại thông báo cũ
    for (const n of fresh.reverse()) {
      await Notifications.scheduleNotificationAsync({
        content: { title: n.title, body: n.body, data: { eventId: n.eventId, type: n.type } },
        trigger: null, // hiện ngay
      });
    }
  }
  return Math.max(lastId, ...res.items.map((n) => n.id));
}
