// =====================================================================
// Dịch vụ thông báo — MỌI thông báo trong hệ thống đều đi qua đây.
//   1. Ghi vào bảng notifications (hộp thư trong app: chuông trên web,
//      màn "Thông báo" trên mobile).
//   2. Đẩy push tới các thiết bị đã đăng ký của người nhận:
//      - Web Push: web app trên iPhone / trình duyệt (bảng web_push_subscriptions)
//      - Expo Push: app Android (.apk) (bảng push_tokens)
//   3. (Tuỳ chọn) gửi email — hiện dùng cho bản tin 09:00 hằng ngày.
// =====================================================================
import type { NotificationType } from '../generated/prisma/client';
import { prisma } from '../prisma';
import { getPushProvider } from '../push';
import { getEmailProvider } from '../email';
import { sendWebPush } from '../push/webpush';

export interface NotifyInput {
  recipientIds: number[];
  type: NotificationType;
  title: string;
  body: string;
  eventId?: number | null;
  taskId?: number | null;
  sentById?: number | null;
  /** Đặt khi là bản tin hằng ngày: DB chặn trùng (người nhận, loại, ngày) */
  reminderDate?: Date | null;
  /** Dữ liệu kèm theo push để app mobile mở đúng màn hình */
  pushData?: Record<string, unknown>;
  /** Có thì gửi thêm email cho người nhận */
  email?: { subject: string; html: string; text: string };
}

/** Tạo thông báo + đẩy push (+ email). Trả về số thông báo MỚI thực sự được tạo. */
export async function notify(input: NotifyInput): Promise<number> {
  const recipientIds = [...new Set(input.recipientIds)];
  if (recipientIds.length === 0) return 0;

  // skipDuplicates => "ON CONFLICT DO NOTHING": chạy job nhiều lần trong
  // một ngày cũng không sinh thông báo trùng (nhờ unique index trong DB).
  const created = await prisma.notification.createManyAndReturn({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      eventId: input.eventId ?? null,
      taskId: input.taskId ?? null,
      sentById: input.sentById ?? null,
      reminderDate: input.reminderDate ?? null,
    })),
    skipDuplicates: true,
  });
  if (created.length === 0) return 0;

  await deliver(
    created.map((n) => n.id),
    input,
  );
  return created.length;
}

/**
 * Bản tin hằng ngày đã tạo hôm nay nhưng CHƯA đẩy được tới thiết bị nào
 * (lúc tạo người nhận chưa bật thông báo, hoặc Apple/Google báo lỗi).
 * Lần chạy sau sẽ cập nhật nội dung mới nhất rồi đẩy lại. Trả về số đã đẩy được.
 */
export async function redeliverDigest(input: NotifyInput): Promise<number> {
  if (!input.reminderDate) return 0;
  const pending = await prisma.notification.findMany({
    where: { recipientId: { in: input.recipientIds }, type: input.type, reminderDate: input.reminderDate, pushSentAt: null },
    select: { id: true, emailSentAt: true },
  });
  if (pending.length === 0) return 0;
  const ids = pending.map((n) => n.id);
  await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { title: input.title, body: input.body } });
  // Email đã gửi rồi thì không gửi lại
  await deliver(ids, { ...input, email: pending.every((n) => n.emailSentAt) ? undefined : input.email });
  return prisma.notification.count({ where: { id: { in: ids }, pushSentAt: { not: null } } });
}

/** Đẩy push / gửi email cho các thông báo vừa tạo, ghi lại thời điểm đã gửi */
async function deliver(notificationIds: number[], input: NotifyInput) {
  const notifications = await prisma.notification.findMany({
    where: { id: { in: notificationIds } },
    include: {
      recipient: {
        select: {
          email: true,
          pushTokens: { select: { token: true } },
          webPushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } },
        },
      },
    },
  });

  const push = getPushProvider();
  const mailer = getEmailProvider();

  for (const n of notifications) {
    let pushed = false;

    // 1) Web Push (iPhone/trình duyệt) — bấm vào sẽ mở đúng trang
    const subs = n.recipient.webPushSubscriptions;
    if (subs.length > 0) {
      const url =
        n.type === 'DAILY_DIGEST' ? '/btt/reminders' : n.eventId ? `/events/${n.eventId}` : '/notifications';
      const r = await sendWebPush(subs, {
        title: n.title,
        body: n.body,
        url,
        tag: n.type === 'DAILY_DIGEST' ? 'daily-digest' : `n-${n.id}`,
      });
      if (r.expired.length) await prisma.webPushSubscription.deleteMany({ where: { endpoint: { in: r.expired } } });
      pushed ||= r.sent > 0;
    }

    // 2) Expo Push (app Android)
    const tokens = n.recipient.pushTokens.map((t) => t.token);
    if (tokens.length > 0) {
      const result = await push.send({
        to: tokens,
        title: n.title,
        body: n.body,
        data: { notificationId: n.id, eventId: n.eventId, taskId: n.taskId, type: n.type, ...input.pushData },
      });
      if (result.invalidTokens.length > 0) {
        await prisma.pushToken.deleteMany({ where: { token: { in: result.invalidTokens } } });
      }
      pushed ||= result.sent > 0;
    }
    if (pushed) await prisma.notification.update({ where: { id: n.id }, data: { pushSentAt: new Date() } });

    if (input.email && !n.emailSentAt && (await mailer.send({ to: n.recipient.email, ...input.email }))) {
      await prisma.notification.update({ where: { id: n.id }, data: { emailSentAt: new Date() } });
    }
  }
}
