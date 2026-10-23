// =====================================================================
// Lớp gửi thông báo đẩy (push) — "Strategy pattern"
// ---------------------------------------------------------------------
// Phần còn lại của app chỉ gọi getPushProvider().send(...), không cần biết
// bên dưới là in console hay gửi thật. Muốn đổi sang Firebase/OneSignal sau
// này chỉ cần viết thêm một provider mới, không sửa code nghiệp vụ.
//
//   PUSH_PROVIDER=log   -> in ra console (demo, mặc định)
//   PUSH_PROVIDER=expo  -> gửi qua Expo Push Service tới token trong bảng push_tokens
// =====================================================================
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { config } from '../config';

export interface PushMessage {
  to: string[];                    // danh sách push token
  title: string;
  body: string;
  data?: Record<string, unknown>;  // dữ liệu kèm theo, app mobile dùng để mở đúng màn hình
}

export interface PushResult {
  sent: number;
  invalidTokens: string[];         // token hỏng (app bị gỡ...) — nên xoá khỏi DB
}

export interface PushProvider {
  name: string;
  send(message: PushMessage): Promise<PushResult>;
}

/** Provider demo: chỉ log ra màn hình */
class LogPushProvider implements PushProvider {
  name = 'log';
  async send(message: PushMessage): Promise<PushResult> {
    console.log(`[push:log] → ${message.to.length} thiết bị | ${message.title} — ${message.body}`);
    return { sent: message.to.length, invalidTokens: [] };
  }
}

/** Provider thật: Expo Push Service (miễn phí, dùng được cho cả iOS và Android) */
class ExpoPushProvider implements PushProvider {
  name = 'expo';
  private expo = new Expo({ accessToken: config.expoAccessToken });

  async send(message: PushMessage): Promise<PushResult> {
    const invalidTokens: string[] = [];
    const messages: ExpoPushMessage[] = [];

    for (const token of message.to) {
      if (!Expo.isExpoPushToken(token)) {
        invalidTokens.push(token);
        continue;
      }
      messages.push({ to: token, title: message.title, body: message.body, data: message.data, sound: 'default' });
    }

    let sent = 0;
    // Expo giới hạn 100 tin/lần gọi -> chia nhỏ
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket.status === 'ok') sent++;
          else if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(String(chunk[i].to));
          } else {
            console.warn('[push:expo] lỗi:', ticket.message);
          }
        });
      } catch (err) {
        console.error('[push:expo] không gửi được:', err);
      }
    }
    return { sent, invalidTokens };
  }
}

let provider: PushProvider | null = null;

export function getPushProvider(): PushProvider {
  if (!provider) {
    provider = config.pushProvider === 'expo' ? new ExpoPushProvider() : new LogPushProvider();
  }
  return provider;
}
