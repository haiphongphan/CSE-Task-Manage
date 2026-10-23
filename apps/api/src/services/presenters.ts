// "Presenter": chuyển bản ghi DB -> JSON gửi cho client.
// Đặt ở một chỗ để web và mobile luôn nhận cùng một định dạng,
// và để thêm các trường TÍNH TOÁN (quá hạn, % tiến độ...) không lưu trong DB.
import type { Event, EventMember, Task, User } from '../generated/prisma/client';

type PublicUserInput = Pick<User, 'id' | 'fullName' | 'username' | 'email' | 'role'> &
  Partial<Pick<User, 'createdAt' | 'mustChangePassword'>>;

export function presentUser(u: PublicUserInput) {
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    email: u.email,
    role: u.role,
    mustChangePassword: u.mustChangePassword ?? false,
    createdAt: u.createdAt,
  };
}

type MiniUser = Pick<User, 'id' | 'fullName' | 'role'>;
export const presentMiniUser = (u: MiniUser | null | undefined) =>
  u ? { id: u.id, fullName: u.fullName, role: u.role } : null;

export type TaskWithRelations = Task & {
  completedBy?: MiniUser | null;
  // Task giao cho CẢ NHÓM BTT của sự kiện -> kèm danh sách thành viên nếu có
  event?: (Pick<Event, 'id' | 'name'> & { members?: { user: MiniUser }[] }) | null;
};

export function presentTask(t: TaskWithRelations, now = new Date()) {
  return {
    id: t.id,
    code: t.code,
    eventId: t.eventId,
    event: t.event ? { id: t.event.id, name: t.event.name } : undefined,
    team: t.event?.members?.map((m) => presentMiniUser(m.user)!) ?? undefined,
    type: t.type,
    title: t.title,
    dimensions: t.dimensions,
    deadline: t.deadline,
    status: t.status,
    progress: t.progress,
    notes: t.notes,
    completedAt: t.completedAt,
    completedBy: presentMiniUser(t.completedBy), // ai bấm hoàn thành
    isOverdue: t.status !== 'COMPLETED' && t.deadline < now,
    updatedAt: t.updatedAt,
  };
}

/** Giai đoạn của sự kiện so với hiện tại */
export function eventPhase(e: Pick<Event, 'startsAt' | 'endsAt'>, now = new Date()) {
  if (now < e.startsAt) return 'UPCOMING' as const;
  if (now <= e.endsAt) return 'ONGOING' as const;
  return 'POST_EVENT' as const;
}

export type EventWithRelations = Event & {
  tasks?: TaskWithRelations[];
  members?: (EventMember & { user: MiniUser })[];
  createdBy?: MiniUser;
};

export function presentEventSummary(e: EventWithRelations, now = new Date()) {
  const tasks = e.tasks ?? [];
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;
  const open = tasks.filter((t) => t.status !== 'COMPLETED');
  const nextDeadline = open
    .filter((t) => t.deadline >= now)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0];

  return {
    id: e.id,
    name: e.name,
    location: e.location,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    phase: eventPhase(e, now),
    // BCH chỉ sửa được khi sự kiện CHƯA diễn ra
    editable: now < e.startsAt,
    photographerNeeded: e.photographerNeeded,
    photographerQuantity: e.photographerQuantity,
    createdBy: presentMiniUser(e.createdBy),
    members: (e.members ?? []).map((m) => presentMiniUser(m.user)),
    progress: {
      total: tasks.length,
      completed: done,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      overdue: open.filter((t) => t.deadline < now).length,
      pendingDeliverables: open.filter((t) => !['PHOTOGRAPHER', 'RECAP'].includes(t.type)).length,
      photographerPending: open.some((t) => t.type === 'PHOTOGRAPHER'),
      recapPending: open.some((t) => t.type === 'RECAP'),
      nextDeadline: nextDeadline ? { taskTitle: nextDeadline.title, deadline: nextDeadline.deadline } : null,
    },
    // Vài task còn mở, sắp theo hạn chót (cho thẻ sự kiện của BTT)
    openTasks: [...open]
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .slice(0, 3)
      .map((t) => ({ id: t.id, title: t.title, type: t.type, status: t.status, dimensions: t.dimensions, deadline: t.deadline })),
    updatedAt: e.updatedAt,
  };
}

export function presentEventDetail(e: EventWithRelations, now = new Date()) {
  return {
    ...presentEventSummary(e, now),
    notes: e.notes,
    onlineContent: e.onlineContent,
    offlineContent: e.offlineContent,
    publishedAt: e.publishedAt,
    tasks: (e.tasks ?? []).map((t) => presentTask(t, now)),
  };
}
