// /api/tasks — Admin quản lý mọi task; BTT cập nhật trạng thái; BCH nhắc việc
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma';
import { currentUser, requireAuth, requireRole } from '../middleware/auth';
import { badRequest, forbidden, parseId } from '../lib/http';
import { addDays, formatVn } from '../lib/time';
import { TASK_STATUS_LABEL, TASK_TYPE_LABEL } from '../lib/labels';
import { presentEventSummary, presentTask } from '../services/presenters';
import { assertCanManage, syncEventCompletion } from '../services/eventAccess';
import { notify } from '../services/notify';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const miniUser = { select: { id: true, fullName: true, role: true } } as const;
const statusEnum = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED']);

// =====================================================================
// GET /api/tasks — ADMIN: bảng "Tất cả task" + thống kê + tổng quan sự kiện
// ?search= &status=TODO|...|OVERDUE &team=BCH|BTT &sort=deadline_asc|deadline_desc &page=
// =====================================================================
const listQuery = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'OVERDUE']).optional(),
  team: z.enum(['BCH', 'BTT']).optional(),
  eventId: z.coerce.number().int().positive().optional(),
  sort: z.enum(['deadline_asc', 'deadline_desc']).default('deadline_asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function buildTaskWhere(q: z.infer<typeof listQuery>, now: Date): Prisma.TaskWhereInput {
  return {
    event: { status: { not: 'DRAFT' } },
    ...(q.eventId && { eventId: q.eventId }),
    ...(q.team && { assignee: { role: q.team } }),
    ...(q.status === 'OVERDUE'
      ? { status: { not: 'COMPLETED' }, deadline: { lt: now } }
      : q.status && { status: q.status }),
    ...(q.search && {
      OR: [
        { title: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
        { event: { name: { contains: q.search, mode: 'insensitive' } } },
      ],
    }),
  };
}

tasksRouter.get('/', requireRole('ADMIN'), async (req, res) => {
  const clean = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== ''));
  const q = listQuery.parse(clean);
  const now = new Date();
  const where = buildTaskWhere(q, now);

  const [items, total, allActive, events] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignee: miniUser, event: { select: { id: true, name: true } } },
      // Task chưa xong (completedAt = NULL) lên trước, sau đó theo hạn chót
      orderBy: [
        { completedAt: { sort: 'desc', nulls: 'first' } },
        { deadline: q.sort === 'deadline_asc' ? 'asc' : 'desc' },
        { id: 'asc' },
      ],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.task.count({ where }),
    prisma.task.findMany({
      where: { event: { status: { not: 'DRAFT' } } },
      select: { status: true, deadline: true, eventId: true },
    }),
    prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      include: { tasks: true, members: { include: { user: miniUser } } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  const open = allActive.filter((t) => t.status !== 'COMPLETED');
  const due48h = open.filter((t) => t.deadline >= now && t.deadline <= addDays(now, 2));
  const overdue = open.filter((t) => t.deadline < now);
  const completed = allActive.length - open.length;

  res.json({
    items: items.map((t) => presentTask(t, now)),
    total,
    page: q.page,
    pageSize: q.pageSize,
    stats: {
      activeTasks: open.length,
      activeEvents: new Set(open.map((t) => t.eventId)).size,
      due48h: due48h.length,
      overdue: overdue.length,
      completionPercent: allActive.length ? Math.round((completed / allActive.length) * 100) : 0,
      completed,
      total: allActive.length,
    },
    events: events.map((e) => presentEventSummary(e, now)),
  });
});

/** GET /api/tasks/export.csv — ADMIN tải toàn bộ task (mở được bằng Excel) */
tasksRouter.get('/export.csv', requireRole('ADMIN'), async (_req, res) => {
  const tasks = await prisma.task.findMany({
    where: { event: { status: { not: 'DRAFT' } } },
    include: { assignee: miniUser, event: { select: { name: true } } },
    orderBy: [{ eventId: 'asc' }, { deadline: 'asc' }],
  });
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Mã', 'Sự kiện', 'Task', 'Loại', 'Kích thước', 'Người nhận', 'Hạn chót', 'Trạng thái', 'Tiến độ (%)'];
  const rows = tasks.map((t) =>
    [
      t.code,
      t.event.name,
      t.title,
      TASK_TYPE_LABEL[t.type],
      t.dimensions,
      t.assignee?.fullName,
      formatVn(t.deadline),
      TASK_STATUS_LABEL[t.status],
      t.progress,
    ]
      .map(esc)
      .join(','),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tong-quan-task.csv"');
  // ﻿ (BOM) giúp Excel hiển thị đúng tiếng Việt
  res.send('﻿' + [header.map(esc).join(','), ...rows].join('\n'));
});

// =====================================================================
// PATCH /api/tasks/:id
//   ADMIN : sửa mọi trường
//   BTT   : thành viên sự kiện -> chỉ đổi status / progress
// =====================================================================
const patchSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  dimensions: z.string().trim().max(100).nullable().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  deadline: z.coerce.date().optional(),
  status: statusEnum.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

tasksRouter.patch('/:id', requireRole('ADMIN', 'BTT'), async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const data = patchSchema.parse(req.body);

  const task = await prisma.task.findUniqueOrThrow({
    where: { id },
    include: { event: { include: { members: true } } },
  });

  if (user.role === 'BTT') {
    if (!task.event.members.some((m) => m.userId === user.id) || task.event.status === 'DRAFT') {
      throw forbidden('Bạn không phụ trách sự kiện này');
    }
    const allowed = ['status', 'progress'];
    const extra = Object.keys(data).filter((k) => !allowed.includes(k));
    if (extra.length) throw forbidden('BTT chỉ được cập nhật trạng thái và tiến độ');
  }

  if (data.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId } });
    if (!assignee) throw badRequest('Người nhận không tồn tại');
    // Nếu giao cho BTT chưa thuộc sự kiện thì tự thêm vào nhóm phụ trách
    if (assignee.role === 'BTT' && !task.event.members.some((m) => m.userId === assignee.id)) {
      await prisma.eventMember.create({ data: { eventId: task.eventId, userId: assignee.id } });
    }
  }

  // Quy tắc nhất quán: hoàn thành <=> progress 100 + completedAt
  const nextStatus = data.status ?? task.status;
  const update: Prisma.TaskUncheckedUpdateInput = { ...data };
  if (nextStatus === 'COMPLETED') {
    update.progress = 100;
    update.completedAt = task.completedAt ?? new Date();
  } else {
    update.completedAt = null;
    if (task.status === 'COMPLETED' && data.progress === undefined) update.progress = 90;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.task.update({
      where: { id },
      data: update,
      include: { assignee: miniUser, event: { select: { id: true, name: true } } },
    });
    await syncEventCompletion(tx, task.eventId);

    let message: string | null = null;
    if (data.status && data.status !== task.status) {
      message =
        data.status === 'COMPLETED'
          ? `${user.fullName} đã hoàn thành ${t.title}.`
          : `${user.fullName} đã chuyển ${t.title} sang "${TASK_STATUS_LABEL[data.status]}".`;
    } else if (user.role === 'ADMIN') {
      message = `${user.fullName} (Admin) đã chỉnh sửa ${t.title}.`;
    }
    if (message) await tx.activityLog.create({ data: { eventId: task.eventId, actorId: user.id, message } });
    return t;
  });

  // Thông báo
  if (user.role === 'ADMIN' && updated.assigneeId) {
    await notify({
      recipientIds: [updated.assigneeId],
      type: 'TASK_UPDATED',
      title: `Task được cập nhật: ${updated.title}`,
      body: `Admin đã cập nhật "${updated.title}" (${task.event.name}). Hạn chót: ${formatVn(updated.deadline)}.`,
      eventId: task.eventId,
      taskId: id,
      sentById: user.id,
    });
  }
  if (data.status === 'COMPLETED' && task.status !== 'COMPLETED' && user.id !== task.event.createdById) {
    await notify({
      recipientIds: [task.event.createdById],
      type: 'TASK_UPDATED',
      title: `Đã hoàn thành: ${updated.title}`,
      body: `${user.fullName} đã hoàn thành "${updated.title}" của ${task.event.name}.`,
      eventId: task.eventId,
      taskId: id,
      sentById: user.id,
    });
  }

  res.json({ task: presentTask(updated) });
});

// =====================================================================
// POST /api/tasks/:id/remind — BCH (người tạo) / Admin gửi nhắc việc
// =====================================================================
const remindSchema = z.object({ message: z.string().trim().max(500).optional() });

tasksRouter.post('/:id/remind', requireRole('BCH', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const { message } = remindSchema.parse(req.body ?? {});
  const task = await prisma.task.findUniqueOrThrow({
    where: { id },
    include: { event: { include: { members: true } } },
  });
  assertCanManage(task.event, user);
  if (task.event.status === 'DRAFT') throw badRequest('Hãy gửi sự kiện cho BTT trước khi nhắc việc');
  if (task.status === 'COMPLETED') throw badRequest('Task này đã hoàn thành');

  const recipients = task.assigneeId ? [task.assigneeId] : task.event.members.map((m) => m.userId);
  if (recipients.length === 0) throw badRequest('Task chưa có người nhận');

  const sent = await notify({
    recipientIds: recipients,
    type: 'MANUAL_REMIND',
    title: `Nhắc việc: ${task.title}`,
    body:
      message ||
      `${user.fullName} nhắc bạn hoàn thành "${task.title}" của ${task.event.name} trước ${formatVn(task.deadline)}.`,
    eventId: task.eventId,
    taskId: task.id,
    sentById: user.id,
  });
  await prisma.activityLog.create({
    data: { eventId: task.eventId, actorId: user.id, message: `${user.fullName} đã gửi nhắc việc cho ${task.title}.` },
  });
  res.json({ sent });
});
