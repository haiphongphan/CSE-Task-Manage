// /api/notifications, /api/reminders, /api/push-tokens
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { currentUser, requireAuth, requireRole } from '../middleware/auth';
import { parseId } from '../lib/http';
import { vnDayDiff } from '../lib/time';
import { presentTask } from '../services/presenters';
import { reminderFlag, runDailyDigest } from '../services/digest';
import { config } from '../config';
import { sendWebPush, webPushEnabled } from '../push/webpush';

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

  // Mọi task chưa xong của các sự kiện mình phụ trách (task giao cho cả nhóm)
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'COMPLETED' },
      eventId,
      event: { status: 'PUBLISHED', members: { some: { userId: user.id } } },
    },
    include: {
      event: { select: { id: true, name: true, startsAt: true, endsAt: true, location: true, photographerQuantity: true } },
    },
    orderBy: { deadline: 'asc' },
  });

  // Dùng chung quy tắc với bản tin 09:00 (services/digest.ts) để 2 nơi luôn khớp nhau
  const flagged = tasks.map((t) => ({ t, flag: reminderFlag(t, t.event, now) }));

  const photo = flagged
    .filter((x) => x.flag === 'PHOTO')
    .map(({ t }) => ({ kind: 'PHOTO' as const, task: presentTask(t, now), event: t.event, daysUntilEvent: vnDayDiff(now, t.event.startsAt) }));

  const recap = flagged
    .filter((x) => x.flag === 'RECAP')
    .map(({ t }) => ({ kind: 'RECAP' as const, task: presentTask(t, now), event: t.event, daysSinceEvent: vnDayDiff(t.event.endsAt, now) }));

  const deadline = flagged.filter((x) => x.flag === 'OVERDUE' || x.flag === 'SOON').map(({ t }) => presentTask(t, now));

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
// Web Push (web app trên iPhone / trình duyệt)
// ---------------------------------------------------------------------
/** GET /api/push/web/public-key — khoá công khai VAPID để trình duyệt đăng ký */
notificationsRouter.get('/push/web/public-key', (_req, res) => {
  res.json({ enabled: webPushEnabled(), publicKey: config.vapidPublicKey ?? null });
});

const webSubSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(4).max(200) }),
});

/** POST /api/push/web/subscriptions — lưu đăng ký của thiết bị này */
notificationsRouter.post('/push/web/subscriptions', async (req, res) => {
  const user = currentUser(req);
  const { endpoint, keys } = webSubSchema.parse(req.body);
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300) || null;
  // Cùng một máy đăng nhập tài khoản khác -> chuyển đăng ký sang người mới
  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent, userId: user.id },
    update: { p256dh: keys.p256dh, auth: keys.auth, userAgent, userId: user.id },
  });
  res.status(204).end();
});

/** DELETE /api/push/web/subscriptions — tắt thông báo trên thiết bị này (hoặc khi đăng xuất) */
notificationsRouter.delete('/push/web/subscriptions', async (req, res) => {
  const user = currentUser(req);
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await prisma.webPushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  res.status(204).end();
});

/** POST /api/push/web/test — gửi thử 1 thông báo tới mọi thiết bị của chính mình */
notificationsRouter.post('/push/web/test', async (req, res) => {
  const user = currentUser(req);
  const subs = await prisma.webPushSubscription.findMany({ where: { userId: user.id } });
  const r = await sendWebPush(subs, {
    title: 'CSE Task Manage',
    body: `Xin chào ${user.fullName}! Thông báo trên thiết bị này đã hoạt động 🎉`,
    url: '/notifications',
    tag: 'test',
  });
  if (r.expired.length) await prisma.webPushSubscription.deleteMany({ where: { endpoint: { in: r.expired } } });
  res.json({
    devices: subs.length,
    sent: r.sent,
    expired: r.expired.length, // thiết bị đã gỡ icon / tắt thông báo -> đã xoá
    errors: r.errors.map((e) => `${e.status ?? ''} ${e.message}`.trim()),
  });
});

// ---------------------------------------------------------------------
// POST /api/admin/run-digest — Admin gửi bản tin hằng ngày ngay (để demo).
// Đã gửi hôm nay thì không gửi lại (DB chặn trùng).
// ---------------------------------------------------------------------
notificationsRouter.post('/admin/run-digest', requireRole('ADMIN'), async (_req, res) => {
  res.json(await runDailyDigest());
});
