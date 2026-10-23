// =====================================================================
// Bản tin hằng ngày 09:00 — GỘP mọi task còn lại của mỗi BTT thành
// MỘT thông báo trên điện thoại + MỘT email (thay vì mỗi task một tin).
// ---------------------------------------------------------------------
// Task được đưa vào bản tin ("task cần chú ý"):
//  * Ấn phẩm media chưa hoàn thành (banner, backdrop...).
//  * Phân công chụp ảnh: chỉ từ 3 ngày trước ngày sự kiện trở đi.
//  * Recap sự kiện: chỉ từ ngày hôm sau ngày sự kiện trở đi.
// Mỗi BTT nhận task của MỌI sự kiện mình phụ trách (task giao cho cả nhóm).
// Chạy lại nhiều lần trong ngày vẫn an toàn: DB chặn trùng theo
// (người nhận, DAILY_DIGEST, ngày).
// =====================================================================
import { config } from '../config';
import { prisma } from '../prisma';
import { addDays, vnDateOnly, vnDayDiff, vnHour } from '../lib/time';
import { TASK_STATUS_LABEL } from '../lib/labels';
import { digestEmail, type DigestEvent, type DigestTask } from '../email/templates';
import { notify } from './notify';

type Flag = DigestTask['flag'];

/** Task này có cần nhắc ở thời điểm `now` không? Trả về cờ (hoặc undefined nếu bỏ qua) */
export function reminderFlag(
  task: { type: string; deadline: Date },
  event: { startsAt: Date; endsAt: Date },
  now: Date,
): Flag | undefined {
  if (task.type === 'PHOTOGRAPHER') {
    return vnDayDiff(now, event.startsAt) <= config.photoReminderDaysBefore ? 'PHOTO' : undefined;
  }
  if (task.type === 'RECAP') {
    return vnDayDiff(event.endsAt, now) >= 1 ? 'RECAP' : undefined;
  }
  if (task.deadline < now) return 'OVERDUE';
  if (task.deadline <= addDays(now, 2)) return 'SOON';
  return null; // ấn phẩm còn hạn xa: vẫn liệt kê, không gắn cờ
}

/** Gom các task cần chú ý của một BTT, nhóm theo sự kiện */
export async function collectForUser(userId: number, now = new Date()): Promise<DigestEvent[]> {
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED', members: { some: { userId } } },
    include: { tasks: { where: { status: { not: 'COMPLETED' } }, orderBy: { deadline: 'asc' } } },
    orderBy: { startsAt: 'asc' },
  });

  const result: DigestEvent[] = [];
  for (const e of events) {
    const tasks: DigestTask[] = [];
    for (const t of e.tasks) {
      const flag = reminderFlag(t, e, now);
      if (flag === undefined) continue;
      tasks.push({ title: t.title, dimensions: t.dimensions, deadline: t.deadline, statusLabel: TASK_STATUS_LABEL[t.status], flag });
    }
    if (tasks.length) result.push({ id: e.id, name: e.name, startsAt: e.startsAt, location: e.location, tasks });
  }
  return result;
}

/** Câu tóm tắt ngắn cho push: "2 quá hạn · 1 trong 48 giờ · chụp ảnh: Ngày hội..." */
function summarize(events: DigestEvent[]) {
  const all = events.flatMap((e) => e.tasks.map((t) => ({ ...t, event: e.name })));
  const parts: string[] = [];
  const overdue = all.filter((t) => t.flag === 'OVERDUE').length;
  const soon = all.filter((t) => t.flag === 'SOON').length;
  if (overdue) parts.push(`${overdue} quá hạn`);
  if (soon) parts.push(`${soon} hạn trong 48 giờ`);
  const photo = all.filter((t) => t.flag === 'PHOTO').map((t) => t.event);
  const recap = all.filter((t) => t.flag === 'RECAP').map((t) => t.event);
  if (photo.length) parts.push(`xác nhận chụp ảnh: ${photo.join(', ')}`);
  if (recap.length) parts.push(`đăng recap: ${recap.join(', ')}`);
  if (!parts.length) parts.push(`${all.length} task đang thực hiện`);
  return parts.join(' · ');
}

export interface DigestRunResult {
  recipients: number; // số BTT có task cần chú ý
  sent: number; // số bản tin MỚI tạo (đã gửi hôm nay thì không tính lại)
}

export async function runDailyDigest(now = new Date()): Promise<DigestRunResult> {
  const today = vnDateOnly(now);
  const btts = await prisma.user.findMany({
    where: { role: 'BTT', eventMemberships: { some: { event: { status: 'PUBLISHED' } } } },
    select: { id: true, fullName: true },
  });

  let recipients = 0;
  let sent = 0;
  for (const u of btts) {
    const events = await collectForUser(u.id, now);
    const total = events.reduce((s, e) => s + e.tasks.length, 0);
    if (!total) continue;
    recipients++;

    const summary = summarize(events);
    sent += await notify({
      recipientIds: [u.id],
      type: 'DAILY_DIGEST',
      title: `Bạn còn ${total} việc cần làm hôm nay`,
      body: summary,
      reminderDate: today,
      pushData: { screen: 'reminders' },
      email: digestEmail(u.fullName, events, summary),
    });
  }

  console.log(`[digest] ${new Date().toISOString()} — ${recipients} BTT có việc, ${sent} bản tin mới`);
  return { recipients, sent };
}

/**
 * Khi API khởi động sau giờ gửi (VD Render free vừa "thức dậy" lúc 10:00),
 * gửi bù bản tin hôm nay. Trước 09:00 thì không gửi sớm.
 */
export async function catchUpDigest(now = new Date()) {
  if (vnHour(now) >= config.digestHour) await runDailyDigest(now);
}
