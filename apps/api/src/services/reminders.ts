// =====================================================================
// Nhắc nhở tự động hằng ngày (chạy bởi node-cron trong index.ts)
// ---------------------------------------------------------------------
// Quy tắc (theo yêu cầu):
//  * Task PHOTOGRAPHER (Phân công chụp ảnh): nhắc mỗi ngày, bắt đầu từ
//    3 ngày trước ngày sự kiện, cho tới khi task được đánh dấu hoàn thành.
//  * Task RECAP (Recap sự kiện): nhắc mỗi ngày, bắt đầu từ NGÀY SAU ngày
//    sự kiện, cho tới khi hoàn thành.
//  * Thêm: task khác sắp tới hạn trong 48 giờ -> DEADLINE_ALERT (1 lần/ngày).
// Người nhận: người được giao task; nếu chưa giao ai thì mọi BTT của sự kiện.
// An toàn khi chạy lại nhiều lần trong ngày nhờ cột reminder_date + unique index.
// =====================================================================
import { prisma } from '../prisma';
import { config } from '../config';
import { addDays, formatVn, vnDateOnly, vnDayDiff } from '../lib/time';
import { notify } from './notify';

export interface ReminderRunResult {
  photo: number;
  recap: number;
  deadline: number;
}

export async function runDailyReminders(now = new Date()): Promise<ReminderRunResult> {
  const today = vnDateOnly(now);
  const result: ReminderRunResult = { photo: 0, recap: 0, deadline: 0 };

  // Chỉ xét task chưa xong của sự kiện đã phát hành (bản nháp chưa gửi cho BTT)
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'COMPLETED' },
      event: { status: 'PUBLISHED' },
      OR: [
        { type: { in: ['PHOTOGRAPHER', 'RECAP'] } },
        { deadline: { gte: now, lte: addDays(now, 2) } },
      ],
    },
    include: { event: { include: { members: { select: { userId: true } } } } },
  });

  for (const task of tasks) {
    const { event } = task;
    const recipients = task.assigneeId ? [task.assigneeId] : event.members.map((m) => m.userId);
    const base = { eventId: event.id, taskId: task.id, reminderDate: today, recipientIds: recipients };

    if (task.type === 'PHOTOGRAPHER') {
      const daysUntilEvent = vnDayDiff(now, event.startsAt);
      if (daysUntilEvent <= config.photoReminderDaysBefore) {
        const when =
          daysUntilEvent > 0 ? `còn ${daysUntilEvent} ngày nữa` : daysUntilEvent === 0 ? 'diễn ra hôm nay' : 'đã diễn ra';
        result.photo += await notify({
          ...base,
          type: 'PHOTO_REMINDER',
          title: `Phân công chụp ảnh · ${event.name}`,
          body: `Sự kiện ${when} (${formatVn(event.startsAt)}). Hãy xác nhận ${event.photographerQuantity} người chụp ảnh và đánh dấu hoàn thành.`,
        });
      }
      continue;
    }

    if (task.type === 'RECAP') {
      // "Ngay sau ngày sự kiện": từ ngày lịch kế tiếp sau ngày kết thúc
      if (vnDayDiff(event.endsAt, now) >= 1) {
        const overdue = task.deadline < now;
        result.recap += await notify({
          ...base,
          type: 'RECAP_REMINDER',
          title: `Recap sự kiện · ${event.name}`,
          body: overdue
            ? `Recap đã quá hạn (${formatVn(task.deadline)}). Hãy đăng recap và đánh dấu hoàn thành.`
            : `Sự kiện đã kết thúc. Hạn nộp recap: ${formatVn(task.deadline)}.`,
        });
      }
      continue;
    }

    // Các ấn phẩm khác: sắp tới hạn trong 48h
    result.deadline += await notify({
      ...base,
      type: 'DEADLINE_ALERT',
      title: `Sắp tới hạn: ${task.title}`,
      body: `"${task.title}" của ${event.name} cần xong trước ${formatVn(task.deadline)}.`,
    });
  }

  console.log(
    `[reminders] ${new Date().toISOString()} — chụp ảnh: ${result.photo}, recap: ${result.recap}, sắp hạn: ${result.deadline}`,
  );
  return result;
}
