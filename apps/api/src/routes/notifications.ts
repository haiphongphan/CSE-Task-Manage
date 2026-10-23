// /api/notifications, /api/reminders, /api/push-tokens
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { currentUser, requireAuth, requireRole } from '../middleware/auth';
import { parseId } from '../lib/http';
import { addDays, vnDayDiff } from '../lib/time';
import { config } from '../config';
import { presentTask } from '../services/presenters';
import { runDailyReminders } from '../services/reminders';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// ---------------------------------------------------------------------
// Hộp thư thông báo
// ---------------------------------------------------------------------
/** GET /api/notifications?limit=30&after=<id> — "after" để app mobile chỉ lấy thông báo mới */
notificationsRouter.get('/notifications', async (req, res) => {
  const user = currentUser(req);
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const after = Number(req.query.after) || 0;

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id, ...(after && { id: { gt: after } }) },
      orderBy: { id: 'desc' },
      take: limit,
      include: { sentBy: { select: { id: true, fullName: true } } },
    }),
    prisma.notification.count({ where: { recipientId: user.id, readAt: null } }),
  ]);
  res.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      eventId: n.eventId,
      taskId: n.taskId,
      sentBy: n.sentBy,
      isRead: !!n.readAt,
      createdAt: n.createdAt,
    })),
    unreadCount,
  });
});

notificationsRouter.post('/notifications/read-all', async (req, res) => {
  const user = currentUser(req);
  await prisma.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});

notificationsRouter.post('/notifications/:id/read', async (req, res) => {
  const user = currentUser(req);
  await prisma.notification.updateMany({
    where: { id: parseId(req.params.id), recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});

// ---------------------------------------------------------------------
// GET /api/reminders?eventId= — thẻ "Nhắc nhở thông minh" của BTT
// Tính trực tiếp từ task (luôn đúng thời điểm hiện tại), khác với hộp thư
// là lịch sử những gì đã gửi.
// ---------------------------------------------------------------------
notificationsRouter.get('/reminders', requireRole('BTT'), async (req, res) => {
  const user = currentUser(req);
  const eventId = Number(req.query.eventId) || undefined;
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'COMPLETED' },
      eventId,
      event: { status: 'PUBLISHED', members: { some: { userId: user.id } } },
      OR: [{ assigneeId: user.id }, { assigneeId: null }],
    },
    include: {
      assignee: { select: { id: true, fullName: true, role: true } },
      event: { select: { id: true, name: true, startsAt: true, endsAt: true, location: true, photographerQuantity: true } },
    },
    orderBy: { deadline: 'asc' },
  });

  const photo = tasks
    .filter((t) => t.type === 'PHOTOGRAPHER' && vnDayDiff(now, t.event.startsAt) <= config.photoReminderDaysBefore)
    .map((t) => ({
      kind: 'PHOTO' as const,
      task: presentTask(t, now),
      event: t.event,
      daysUntilEvent: vnDayDiff(now, t.event.startsAt),
    }));

  const recap = tasks
    .filter((t) => t.type === 'RECAP' && vnDayDiff(t.event.endsAt, now) >= 1)
    .map((t) => ({
      kind: 'RECAP' as const,
      task: presentTask(t, now),
      event: t.event,
      daysSinceEvent: vnDayDiff(t.event.endsAt, now),
    }));

  const deadline = tasks
    .filter((t) => !['PHOTOGRAPHER', 'RECAP'].includes(t.type) && t.deadline <= addDays(now, 2))
    .map((t) => presentTask(t, now));

  res.json({
    photo,
    recap,
    deadline,
    total: photo.length + recap.length + (deadline.length ? 1 : 0),
  });
});

// ---------------------------------------------------------------------
// Push token của thiết bị (app mobile gọi sau khi đăng nhập)
// ---------------------------------------------------------------------
const tokenSchema = z.object({
  token: z.string().min(10).max(255),
  platform: z.enum(['ios', 'android', 'web']),
});

notificationsRouter.post('/push-tokens', async (req, res) => {
  const user = currentUser(req);
  const { token, platform } = tokenSchema.parse(req.body);
  // upsert: cùng một điện thoại đăng nhập tài khoản khác -> chuyển token sang user mới
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, platform, userId: user.id },
    update: { platform, userId: user.id },
  });
  res.status(204).end();
});

notificationsRouter.delete('/push-tokens', async (req, res) => {
  const user = currentUser(req);
  const { token } = z.object({ token: z.string() }).parse(req.body);
  await prisma.pushToken.deleteMany({ where: { token, userId: user.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------------
// POST /api/admin/run-reminders — Admin chạy job nhắc nhở ngay (để demo)
// ---------------------------------------------------------------------
notificationsRouter.post('/admin/run-reminders', requireRole('ADMIN'), async (_req, res) => {
  res.json(await runDailyReminders());
});
