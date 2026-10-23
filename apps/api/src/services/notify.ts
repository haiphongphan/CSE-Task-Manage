// =====================================================================
// Dịch vụ thông báo — MỌI thông báo trong hệ thống đều đi qua đây.
//   1. Ghi vào bảng notifications (hộp thư trong app: chuông trên web,
//      màn "Thông báo" trên mobile).
//   2. Đẩy push tới các thiết bị đã đăng ký của người nhận.
// =====================================================================
import type { NotificationType } from '../generated/prisma/client';
import { prisma } from '../prisma';
import { getPushProvider } from '../push';

export interface NotifyInput {
  recipientIds: number[];
  type: NotificationType;
  title: string;
  body: string;
  eventId?: number | null;
  taskId?: number | null;
  sentById?: number | null;
  /** Đặt khi là nhắc nhở tự động hằng ngày: DB chặn trùng (task, người nhận, loại, ngày) */
  reminderDate?: Date | null;
}

/** Tạo thông báo + đẩy push. Trả về số thông báo MỚI thực sự được tạo. */
export async function notify(input: NotifyInput): Promise<number> {
  const recipientIds = [...new Set(input.recipientIds)];
  if (recipientIds.length === 0) return 0;

  // skipDuplicates => "ON CONFLICT DO NOTHING": chạy job nhắc nhở nhiều lần
  // trong một ngày cũng không sinh thông báo trùng (nhờ unique index trong DB).
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

  await pushToDevices(created.map((n) => n.id));
  return created.length;
}

/** Đẩy push cho các thông báo vừa tạo; dọn token hỏng; đánh dấu push_sent_at. */
async function pushToDevices(notificationIds: number[]) {
  const notifications = await prisma.notification.findMany({
    where: { id: { in: notificationIds } },
    include: { recipient: { select: { pushTokens: { select: { token: true } } } } },
  });

  const provider = getPushProvider();
  for (const n of notifications) {
    const tokens = n.recipient.pushTokens.map((t) => t.token);
    if (tokens.length === 0) continue; // người nhận chưa cài app -> chỉ có thông báo trong app

    const result = await provider.send({
      to: tokens,
      title: n.title,
      body: n.body,
      data: { notificationId: n.id, eventId: n.eventId, taskId: n.taskId, type: n.type },
    });

    if (result.invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: result.invalidTokens } } });
    }
    if (result.sent > 0) {
      await prisma.notification.update({ where: { id: n.id }, data: { pushSentAt: new Date() } });
    }
  }
}
