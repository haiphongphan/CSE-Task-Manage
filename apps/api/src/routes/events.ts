// /api/events — BCH tạo/sửa sự kiện + chia task; BTT/Admin xem
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, TaskType } from '../generated/prisma/client';
import { prisma } from '../prisma';
import { currentUser, requireAuth, requireRole, type AuthUser } from '../middleware/auth';
import { badRequest, forbidden, parseId } from '../lib/http';
import { addDays, vnDateString } from '../lib/time';
import { config } from '../config';
import { DELIVERABLE_TYPES, DIMENSIONS_REQUIRED, TASK_TYPE_LABEL } from '../lib/labels';
import {
  assertCanManage,
  eventDetailInclude,
  loadVisibleEvent,
  visibleEventsWhere,
} from '../services/eventAccess';
import { presentEventDetail, presentEventSummary } from '../services/presenters';
import { notify } from '../services/notify';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

// =====================================================================
// GET /api/events — danh sách theo vai trò
//   BCH : sự kiện mình tạo (lọc ?status=DRAFT|PUBLISHED|COMPLETED)
//   BTT : sự kiện đang hoạt động mình phụ trách (lọc ?phase=UPCOMING|POST_EVENT)
//   ADMIN: tất cả
// =====================================================================
const listQuery = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED']).optional(),
  phase: z.enum(['UPCOMING', 'ONGOING', 'POST_EVENT']).optional(),
});

eventsRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const q = listQuery.parse({
    search: req.query.search || undefined,
    status: req.query.status || undefined,
    phase: req.query.phase || undefined,
  });
  const now = new Date();

  const baseWhere: Prisma.EventWhereInput = {
    ...visibleEventsWhere(user),
    // BTT: chỉ sự kiện còn việc (sự kiện xong hết bị loại khỏi "Đang hoạt động")
    ...(user.role === 'BTT' && { status: 'PUBLISHED' }),
  };

  const events = await prisma.event.findMany({
    where: {
      ...baseWhere,
      ...(q.status && user.role !== 'BTT' && { status: q.status }),
      ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
    },
    include: eventDetailInclude,
    orderBy: user.role === 'BTT' ? { startsAt: 'asc' } : { updatedAt: 'desc' },
  });

  let items = events.map((e) => presentEventSummary(e, now));
  if (q.phase) items = items.filter((e) => e.phase === q.phase);

  if (user.role === 'BTT') {
    // "Ưu tiên khẩn cấp": recap quá hạn > deadline gần nhất
    const urgency = (e: (typeof items)[number]) =>
      e.progress.overdue > 0 ? 0 : (e.progress.nextDeadline?.deadline.getTime() ?? Infinity);
    items.sort((a, b) => urgency(a) - urgency(b));
  }

  // Thống kê cho các thẻ đầu trang (tính trên toàn bộ, không theo bộ lọc)
  const all = await prisma.event.findMany({ where: baseWhere, include: { tasks: true } });
  const allSummaries = all.map((e) => presentEventSummary(e, now));
  const stats =
    user.role === 'BTT'
      ? {
          active: allSummaries.length,
          upcoming: allSummaries.filter((e) => e.phase === 'UPCOMING').length,
          postEvent: allSummaries.filter((e) => e.phase === 'POST_EVENT').length,
          pendingDeliverables: allSummaries.reduce((s, e) => s + e.progress.pendingDeliverables, 0),
          photographerPending: allSummaries.filter((e) => e.progress.photographerPending).length,
          overdueRecaps: all.filter((e) =>
            e.tasks.some((t) => t.type === 'RECAP' && t.status !== 'COMPLETED' && t.deadline < now),
          ).length,
        }
      : {
          total: all.length,
          draft: all.filter((e) => e.status === 'DRAFT').length,
          published: all.filter((e) => e.status === 'PUBLISHED').length,
          completed: all.filter((e) => e.status === 'COMPLETED').length,
        };

  res.json({ items, stats });
});

// =====================================================================
// GET /api/events/:id — chi tiết + hoạt động gần đây
// =====================================================================
eventsRouter.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const event = await loadVisibleEvent(parseId(req.params.id), user);
  const activity = await prisma.activityLog.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { actor: { select: { id: true, fullName: true } } },
  });
  const canManage = user.role === 'ADMIN' || event.createdById === user.id;
  res.json({
    event: {
      ...presentEventDetail(event),
      permissions: {
        canEdit: canManage && (user.role === 'ADMIN' || new Date() < event.startsAt),
        canRemind: canManage && event.status !== 'DRAFT',
        canUpdateTasks: user.role === 'ADMIN' || (user.role === 'BTT' && event.members.some((m) => m.userId === user.id)),
        canDelete: canManage && (user.role === 'ADMIN' || event.status === 'DRAFT'),
      },
    },
    activity: activity.map((a) => ({ id: a.id, message: a.message, actor: a.actor, createdAt: a.createdAt })),
  });
});

// =====================================================================
// Tạo / sửa sự kiện
// =====================================================================
const deliverableSchema = z
  .object({
    id: z.number().int().positive().optional(), // có id = task đã tồn tại (khi sửa)
    type: z.enum(DELIVERABLE_TYPES),
    title: z.string().trim().max(150).optional(),
    dimensions: z.string().trim().max(100).optional().nullable(),
    deadline: z.coerce.date({ errorMap: () => ({ message: 'Hạn chót không hợp lệ' }) }),
  })
  .superRefine((d, ctx) => {
    const label = TASK_TYPE_LABEL[d.type];
    if (DIMENSIONS_REQUIRED.includes(d.type) && !d.dimensions) {
      ctx.addIssue({ code: 'custom', path: ['dimensions'], message: `${label}: cần nhập kích thước` });
    }
    if (d.type === 'OTHER' && !d.title) {
      ctx.addIssue({ code: 'custom', path: ['title'], message: 'Ấn phẩm "Khác": cần nhập loại ấn phẩm' });
    }
  });

/** Một khoảng giờ trong MỘT ngày: dùng cho ngày diễn ra và slot chụp ảnh */
const timeRange = z.object({
  startsAt: z.coerce.date({ errorMap: () => ({ message: 'Giờ bắt đầu không hợp lệ' }) }),
  endsAt: z.coerce.date({ errorMap: () => ({ message: 'Giờ kết thúc không hợp lệ' }) }),
});
const photoSlotSchema = timeRange.extend({
  quantity: z.number().int().min(1, 'Số người chụp tối thiểu là 1').max(20, 'Tối đa 20 người chụp/ngày'),
});

const eventSchema = z
  .object({
    name: z.string().trim().min(3, 'Tên sự kiện tối thiểu 3 ký tự').max(150),
    location: z.string().trim().min(1, 'Vui lòng nhập địa điểm').max(150),
    /**
     * Các ngày diễn ra (sự kiện kéo dài x ngày, không cần liên tiếp).
     * Client cũ chỉ gửi startsAt/endsAt -> coi là 1 ngày.
     */
    sessions: z.array(timeRange).max(14, 'Tối đa 14 ngày diễn ra').optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    notes: z.string().trim().max(5000).optional().nullable(),
    onlineContent: z.string().trim().max(5000).optional().nullable(),
    offlineContent: z.string().trim().max(5000).optional().nullable(),
    /** Lịch chụp ảnh theo ngày. Client cũ gửi photographerNeeded + photographerQuantity */
    photoSlots: z.array(photoSlotSchema).max(14).optional(),
    photographerNeeded: z.boolean().default(true),
    photographerQuantity: z.number().int().min(0).max(20).default(1),
    memberIds: z.array(z.number().int().positive()).default([]),
    deliverables: z.array(deliverableSchema).max(30, 'Tối đa 30 ấn phẩm').default([]),
    /** true = "Gửi & phân công", false = "Lưu nháp" */
    publish: z.boolean().default(false),
  })
  .transform((d, ctx) => {
    // ---- Ngày diễn ra ----
    const sessions = (d.sessions ?? (d.startsAt && d.endsAt ? [{ startsAt: d.startsAt, endsAt: d.endsAt }] : []))
      .slice()
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    if (sessions.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['sessions'], message: 'Cần ít nhất 1 ngày diễn ra' });
      return z.NEVER;
    }
    const seen = new Set<string>();
    sessions.forEach((s, i) => {
      const day = vnDateString(s.startsAt);
      if (s.endsAt <= s.startsAt) {
        ctx.addIssue({ code: 'custom', path: ['sessions', i, 'endsAt'], message: `Ngày ${dayLabel(day)}: giờ kết thúc phải sau giờ bắt đầu` });
      } else if (vnDateString(new Date(s.endsAt.getTime() - 1)) !== day) {
        ctx.addIssue({ code: 'custom', path: ['sessions', i, 'endsAt'], message: `Ngày ${dayLabel(day)}: giờ bắt đầu và kết thúc phải trong cùng một ngày` });
      }
      if (seen.has(day)) ctx.addIssue({ code: 'custom', path: ['sessions', i], message: `Ngày ${dayLabel(day)} bị chọn trùng` });
      seen.add(day);
    });

    // ---- Lịch chụp ảnh ----
    const photoSlots = (
      d.photoSlots ??
      (d.photographerNeeded ? sessions.map((s) => ({ ...s, quantity: Math.max(1, d.photographerQuantity) })) : [])
    )
      .slice()
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const photoDays = new Set<string>();
    photoSlots.forEach((p, i) => {
      const day = vnDateString(p.startsAt);
      if (!seen.has(day)) {
        ctx.addIssue({ code: 'custom', path: ['photoSlots', i], message: `Chụp ảnh ${dayLabel(day)}: không phải ngày diễn ra sự kiện` });
      }
      if (p.endsAt <= p.startsAt) {
        ctx.addIssue({ code: 'custom', path: ['photoSlots', i, 'endsAt'], message: `Chụp ảnh ${dayLabel(day)}: giờ kết thúc phải sau giờ bắt đầu` });
      }
      if (photoDays.has(day)) ctx.addIssue({ code: 'custom', path: ['photoSlots', i], message: `Chụp ảnh ${dayLabel(day)} bị chọn trùng` });
      photoDays.add(day);
    });

    if (d.publish) {
      if (d.memberIds.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['memberIds'], message: 'Chọn ít nhất 1 thành viên BTT phụ trách' });
      }
      if (d.deliverables.length === 0 && photoSlots.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['deliverables'], message: 'Chọn ít nhất 1 ấn phẩm hoặc bật chụp ảnh' });
      }
    }

    const { sessions: _s, photoSlots: _p, ...rest } = d;
    return {
      ...rest,
      sessions,
      photoSlots,
      // Cả sự kiện = từ đầu ngày đầu tiên tới cuối ngày cuối cùng
      startsAt: sessions[0].startsAt,
      endsAt: sessions[sessions.length - 1].endsAt,
      photographerNeeded: photoSlots.length > 0,
      photographerQuantity: photoSlots.reduce((m, p) => Math.max(m, p.quantity), 0), // đông nhất trong 1 ngày
    };
  });

/** '2026-11-08' -> '08/11' */
const dayLabel = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

type EventInput = z.output<typeof eventSchema>;

/** Mô tả ngắn lịch chụp cho task PHOTOGRAPHER: "2 người chụp ảnh" hoặc "3 ngày · 5 lượt người chụp" */
function photoSummary(slots: EventInput['photoSlots']) {
  if (slots.length === 1) return `${slots[0].quantity} người chụp ảnh`;
  return `${slots.length} ngày · ${slots.reduce((s, p) => s + p.quantity, 0)} lượt người chụp`;
}

function assertFuture(d: EventInput, user: AuthUser) {
  if (user.role !== 'ADMIN' && d.startsAt <= new Date()) {
    throw badRequest('Thời gian sự kiện phải ở tương lai');
  }
}

async function assertMembersAreBtt(ids: number[]) {
  if (ids.length === 0) return;
  const count = await prisma.user.count({ where: { id: { in: ids }, role: 'BTT' } });
  if (count !== new Set(ids).size) throw badRequest('Danh sách phụ trách chỉ được gồm tài khoản BTT');
}

/** Ghi task của sự kiện theo form: cập nhật task có id, xoá task bị bỏ chọn, tạo task mới */
async function syncTasks(tx: Prisma.TransactionClient, eventId: number, d: EventInput) {
  const existing = await tx.task.findMany({ where: { eventId } });
  const keepIds = new Set(d.deliverables.map((x) => x.id).filter(Boolean));

  // 1) Ấn phẩm media
  const toDelete = existing.filter(
    (t) => !['PHOTOGRAPHER', 'RECAP'].includes(t.type) && !keepIds.has(t.id),
  );
  if (toDelete.length) await tx.task.deleteMany({ where: { id: { in: toDelete.map((t) => t.id) } } });

  for (const item of d.deliverables) {
    const data = {
      type: item.type as TaskType,
      title: item.type === 'OTHER' ? item.title! : item.title || TASK_TYPE_LABEL[item.type],
      dimensions: item.dimensions || null,
      deadline: item.deadline,
    };
    const match = item.id ? existing.find((t) => t.id === item.id) : undefined;
    if (item.id && !match) throw badRequest(`Task #${item.id} không thuộc sự kiện này`);
    if (match) await tx.task.update({ where: { id: match.id }, data });
    else await tx.task.create({ data: { ...data, eventId } });
  }

  // 2) Phân công chụp ảnh — MỘT task cho cả lịch chụp, hạn = giờ chụp đầu tiên
  const photo = existing.find((t) => t.type === 'PHOTOGRAPHER');
  if (d.photographerNeeded) {
    const data = {
      title: TASK_TYPE_LABEL.PHOTOGRAPHER,
      dimensions: photoSummary(d.photoSlots),
      deadline: d.photoSlots[0].startsAt,
    };
    if (photo) await tx.task.update({ where: { id: photo.id }, data });
    else await tx.task.create({ data: { ...data, eventId, type: 'PHOTOGRAPHER' } });
  } else if (photo) {
    await tx.task.delete({ where: { id: photo.id } });
  }

  // 3) Recap — luôn có, hạn = giờ kết thúc + 7 ngày
  const recap = existing.find((t) => t.type === 'RECAP');
  const recapData = {
    title: TASK_TYPE_LABEL.RECAP,
    deadline: addDays(d.endsAt, config.recapDueDays),
  };
  if (recap) await tx.task.update({ where: { id: recap.id }, data: recapData });
  else await tx.task.create({ data: { ...recapData, eventId, type: 'RECAP' } });
}

/** Ghi lại các ngày diễn ra + lịch chụp (thay toàn bộ, vì form luôn gửi đủ danh sách) */
async function syncSchedule(tx: Prisma.TransactionClient, eventId: number, d: EventInput) {
  await tx.eventSession.deleteMany({ where: { eventId } });
  await tx.photoSlot.deleteMany({ where: { eventId } });
  await tx.eventSession.createMany({ data: d.sessions.map((s) => ({ eventId, startsAt: s.startsAt, endsAt: s.endsAt })) });
  if (d.photoSlots.length) {
    await tx.photoSlot.createMany({
      data: d.photoSlots.map((p) => ({ eventId, startsAt: p.startsAt, endsAt: p.endsAt, quantity: p.quantity })),
    });
  }
}

/** Gửi thông báo sau khi lưu: BTT mới được phân công nhận EVENT_ASSIGNED, BTT cũ nhận TASK_UPDATED */
async function notifyAfterSave(
  user: AuthUser,
  event: { id: number; name: string },
  memberIds: number[],
  previousMemberIds: number[],
  wasPublished: boolean,
) {
  const prev = new Set(wasPublished ? previousMemberIds : []);
  const added = memberIds.filter((id) => !prev.has(id));
  const kept = memberIds.filter((id) => prev.has(id));

  await notify({
    recipientIds: added,
    type: 'EVENT_ASSIGNED',
    title: 'Bạn được phân công sự kiện mới',
    body: `${user.fullName} đã phân công bạn phụ trách "${event.name}". Mở app để xem các task của sự kiện.`,
    eventId: event.id,
    sentById: user.id,
  });
  await notify({
    recipientIds: kept,
    type: 'TASK_UPDATED',
    title: `Sự kiện được cập nhật · ${event.name}`,
    body: `${user.fullName} đã chỉnh sửa thông tin sự kiện hoặc task. Kiểm tra lại hạn chót nhé.`,
    eventId: event.id,
    sentById: user.id,
  });
}

/** POST /api/events — BCH tạo sự kiện (nháp hoặc gửi luôn) */
eventsRouter.post('/', requireRole('BCH'), async (req, res) => {
  const user = currentUser(req);
  const d = eventSchema.parse(req.body);
  assertFuture(d, user);
  await assertMembersAreBtt(d.memberIds);

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        name: d.name,
        location: d.location,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        notes: d.notes,
        onlineContent: d.onlineContent,
        offlineContent: d.offlineContent,
        photographerNeeded: d.photographerNeeded,
        photographerQuantity: d.photographerNeeded ? d.photographerQuantity : 0,
        status: d.publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: d.publish ? new Date() : null,
        createdById: user.id,
        members: { create: d.memberIds.map((userId) => ({ userId })) },
      },
    });
    await syncSchedule(tx, created.id, d);
    await syncTasks(tx, created.id, d);
    await tx.activityLog.create({
      data: {
        eventId: created.id,
        actorId: user.id,
        message: d.publish
          ? `${user.fullName} đã tạo sự kiện và phân công cho BTT.`
          : `${user.fullName} đã lưu bản nháp sự kiện.`,
      },
    });
    return created;
  });

  if (d.publish) await notifyAfterSave(user, event, d.memberIds, [], false);

  const full = await prisma.event.findUniqueOrThrow({ where: { id: event.id }, include: eventDetailInclude });
  res.status(201).json({ event: presentEventDetail(full) });
});

/** PUT /api/events/:id — sửa (chỉ khi sự kiện CHƯA diễn ra) */
eventsRouter.put('/:id', requireRole('BCH', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const current = await prisma.event.findUniqueOrThrow({ where: { id }, include: { members: true } });
  assertCanManage(current, user);
  if (user.role !== 'ADMIN' && new Date() >= current.startsAt) {
    throw forbidden('Sự kiện đã diễn ra, không thể chỉnh sửa');
  }

  const d = eventSchema.parse(req.body);
  assertFuture(d, user);
  await assertMembersAreBtt(d.memberIds);
  const wasPublished = current.status !== 'DRAFT';
  const publishNow = wasPublished || d.publish; // đã phát hành thì không quay về nháp

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id },
      data: {
        name: d.name,
        location: d.location,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        notes: d.notes,
        onlineContent: d.onlineContent,
        offlineContent: d.offlineContent,
        photographerNeeded: d.photographerNeeded,
        photographerQuantity: d.photographerNeeded ? d.photographerQuantity : 0,
        status: publishNow ? (current.status === 'COMPLETED' ? 'COMPLETED' : 'PUBLISHED') : 'DRAFT',
        publishedAt: current.publishedAt ?? (publishNow ? new Date() : null),
      },
    });
    // Thay toàn bộ danh sách thành viên
    await tx.eventMember.deleteMany({ where: { eventId: id, userId: { notIn: d.memberIds } } });
    await tx.eventMember.createMany({
      data: d.memberIds.map((userId) => ({ eventId: id, userId })),
      skipDuplicates: true,
    });
    await syncSchedule(tx, id, d);
    await syncTasks(tx, id, d);
    await tx.activityLog.create({
      data: {
        eventId: id,
        actorId: user.id,
        message:
          !wasPublished && publishNow
            ? `${user.fullName} đã gửi sự kiện và phân công cho BTT.`
            : `${user.fullName} đã cập nhật thông tin sự kiện.`,
      },
    });
  });

  if (publishNow) {
    await notifyAfterSave(user, { id, name: d.name }, d.memberIds, current.members.map((m) => m.userId), wasPublished);
  }

  const full = await prisma.event.findUniqueOrThrow({ where: { id }, include: eventDetailInclude });
  res.json({ event: presentEventDetail(full) });
});

/** DELETE /api/events/:id — BCH xoá bản nháp; Admin xoá bất kỳ */
eventsRouter.delete('/:id', requireRole('BCH', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const event = await prisma.event.findUniqueOrThrow({ where: { id } });
  assertCanManage(event, user);
  if (user.role !== 'ADMIN' && event.status !== 'DRAFT') {
    throw forbidden('Chỉ xoá được sự kiện ở trạng thái nháp');
  }
  await prisma.event.delete({ where: { id } });
  res.status(204).end();
});
