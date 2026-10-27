// /api/events/:eventId/attachments — file mẫu / tham chiếu cho ấn phẩm (mục 03 của form)
//   POST   : BCH tạo sự kiện (hoặc Admin) tải lên 1 file / request, thân request là nội dung file thô
//   GET    /:id : ai xem được sự kiện thì tải được file
//   DELETE /:id : BCH tạo sự kiện (hoặc Admin) xoá file
import express, { Router, type Request } from 'express';
import { prisma } from '../prisma';
import { currentUser, requireAuth, requireRole, type AuthUser } from '../middleware/auth';
import { badRequest, forbidden, notFound, parseId } from '../lib/http';
import { assertCanManage, loadVisibleEvent } from '../services/eventAccess';

export const attachmentsRouter = Router({ mergeParams: true });
attachmentsRouter.use(requireAuth);

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB / file
export const MAX_ATTACHMENTS_PER_EVENT = 20;

/** Định dạng cho phép -> MIME lưu trong DB (quyết định theo đuôi file, không tin header của client) */
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  ai: 'application/postscript',
  eps: 'application/postscript',
  psd: 'image/vnd.adobe.photoshop',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  zip: 'application/zip',
};

/** :eventId nằm ở đường dẫn cha (mergeParams) nên kiểu của Express không tự suy ra được */
const eventIdOf = (req: Request) => parseId((req.params as Record<string, string>).eventId);

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** Cùng điều kiện với PUT /api/events/:id: chỉ người tạo/Admin, và chỉ khi sự kiện CHƯA diễn ra */
async function loadManageableEvent(eventId: number, user: AuthUser) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Không tìm thấy sự kiện');
  assertCanManage(event, user);
  if (user.role !== 'ADMIN' && new Date() >= event.startsAt) {
    throw forbidden('Sự kiện đã diễn ra, không thể chỉnh sửa');
  }
  return event;
}

/** POST /api/events/:eventId/attachments?name=<tên file> — body là nội dung file */
attachmentsRouter.post(
  '/',
  requireRole('BCH', 'ADMIN'),
  express.raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES }),
  async (req, res) => {
    const user = currentUser(req);
    const event = await loadManageableEvent(eventIdOf(req), user);

    const fileName = String(req.query.name ?? '').trim().slice(0, 255);
    if (!fileName) throw badRequest('Thiếu tên file');
    const mimeType = ATTACHMENT_TYPES[extOf(fileName)];
    if (!mimeType) throw badRequest(`Định dạng file "${fileName}" không được hỗ trợ`);
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest(`File "${fileName}" rỗng`);

    const count = await prisma.eventAttachment.count({ where: { eventId: event.id } });
    if (count >= MAX_ATTACHMENTS_PER_EVENT) {
      throw badRequest(`Mỗi sự kiện tối đa ${MAX_ATTACHMENTS_PER_EVENT} file đính kèm`);
    }

    const att = await prisma.eventAttachment.create({
      data: {
        eventId: event.id,
        fileName,
        mimeType,
        sizeBytes: body.length,
        data: new Uint8Array(body),
        uploadedById: user.id,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    res.status(201).json({ attachment: att });
  },
);

/** GET /api/events/:eventId/attachments/:id — tải file */
attachmentsRouter.get('/:id', async (req, res) => {
  const event = await loadVisibleEvent(eventIdOf(req), currentUser(req));
  const att = await prisma.eventAttachment.findFirst({ where: { id: parseId(req.params.id), eventId: event.id } });
  if (!att) throw notFound('Không tìm thấy file');

  res.setHeader('Content-Type', att.mimeType);
  res.setHeader('Content-Length', att.sizeBytes);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(Buffer.from(att.data));
});

/** DELETE /api/events/:eventId/attachments/:id */
attachmentsRouter.delete('/:id', requireRole('BCH', 'ADMIN'), async (req, res) => {
  const event = await loadManageableEvent(eventIdOf(req), currentUser(req));
  const { count } = await prisma.eventAttachment.deleteMany({ where: { id: parseId(req.params.id), eventId: event.id } });
  if (!count) throw notFound('Không tìm thấy file');
  res.status(204).end();
});
