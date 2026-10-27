// Kiểm tra quyền truy cập sự kiện theo vai trò + các include Prisma dùng chung
import type { Prisma } from '../generated/prisma/client';
import type { AuthUser } from '../middleware/auth';
import { forbidden, notFound } from '../lib/http';
import { prisma } from '../prisma';

const miniUser = { select: { id: true, fullName: true, role: true } } as const;

/** Include đầy đủ cho trang chi tiết */
export const eventDetailInclude = {
  createdBy: miniUser,
  members: { include: { user: miniUser }, orderBy: { addedAt: 'asc' } },
  tasks: { include: { completedBy: miniUser }, orderBy: [{ deadline: 'asc' }, { id: 'asc' }] },
  // Chỉ thông tin file, KHÔNG kèm nội dung (data) — tải riêng qua /attachments/:id
  attachments: {
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.EventInclude;

/** Điều kiện WHERE: những sự kiện user này được XEM */
export function visibleEventsWhere(user: AuthUser): Prisma.EventWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'BCH':
      return { createdById: user.id };
    case 'BTT':
      // BTT chỉ thấy sự kiện đã phát hành mà mình được phân công
      return { status: { not: 'DRAFT' }, members: { some: { userId: user.id } } };
  }
}

export async function loadVisibleEvent(id: number, user: AuthUser) {
  const event = await prisma.event.findFirst({
    where: { id, ...visibleEventsWhere(user) },
    include: eventDetailInclude,
  });
  if (!event) throw notFound('Không tìm thấy sự kiện hoặc bạn không có quyền xem');
  return event;
}

/** Chỉ người tạo (BCH) hoặc Admin được sửa/nhắc việc */
export function assertCanManage(event: { createdById: number }, user: AuthUser) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'BCH' && event.createdById === user.id) return;
  throw forbidden('Chỉ BCH tạo sự kiện mới được thực hiện thao tác này');
}

/**
 * Sau khi task đổi trạng thái: nếu mọi task đã xong -> sự kiện COMPLETED;
 * nếu có task mở lại -> quay về PUBLISHED. Không đụng tới bản nháp.
 */
export async function syncEventCompletion(tx: Prisma.TransactionClient, eventId: number) {
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true } });
  if (event.status === 'DRAFT') return;
  const open = await tx.task.count({ where: { eventId, status: { not: 'COMPLETED' } } });
  const next = open === 0 ? 'COMPLETED' : 'PUBLISHED';
  if (next !== event.status) await tx.event.update({ where: { id: eventId }, data: { status: next } });
}
