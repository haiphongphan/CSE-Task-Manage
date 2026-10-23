// /api/users — Admin quản lý tài khoản; BCH lấy danh sách BTT để phân công
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma';
import { currentUser, requireAuth, requireRole } from '../middleware/auth';
import { badRequest, parseId } from '../lib/http';
import { presentUser } from '../services/presenters';
import { getEmailProvider } from '../email';
import { welcomeEmail } from '../email/templates';
import { emailSchema, fullNameSchema, passwordSchema, usernameSchema } from './auth';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const roleEnum = z.enum(['ADMIN', 'BCH', 'BTT']);

/**
 * GET /api/users/options?role=BTT
 * Danh sách rút gọn để chọn người (BCH chọn BTT khi tạo sự kiện).
 */
usersRouter.get('/options', requireRole('ADMIN', 'BCH'), async (req, res) => {
  const role = roleEnum.optional().parse(req.query.role || undefined);
  const users = await prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, username: true, role: true },
  });
  res.json({ items: users });
});

// ---------------- Các route dưới đây chỉ dành cho ADMIN ----------------
usersRouter.use(requireRole('ADMIN'));

const listQuery = z.object({
  search: z.string().trim().optional(),
  role: roleEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(8),
});

/** GET /api/users?search=&role=&page=&pageSize= */
usersRouter.get('/', async (req, res) => {
  const q = listQuery.parse({ ...req.query, role: req.query.role || undefined });

  const where: Prisma.UserWhereInput = {
    role: q.role,
    ...(q.search && {
      OR: [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { username: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
  };

  // Chạy song song 3 truy vấn cho nhanh
  const [items, total, byRole] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
  ]);

  const countOf = (r: string) => byRole.find((g) => g.role === r)?._count._all ?? 0;
  res.json({
    items: items.map(presentUser),
    total,
    page: q.page,
    pageSize: q.pageSize,
    stats: {
      total: byRole.reduce((s, g) => s + g._count._all, 0),
      admin: countOf('ADMIN'),
      bch: countOf('BCH'),
      btt: countOf('BTT'),
    },
  });
});

const createSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleEnum,
  sendEmail: z.boolean().optional().default(false),
});

/** POST /api/users — Admin tạo tài khoản với mật khẩu tạm */
usersRouter.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      role: data.role,
      passwordHash: await bcrypt.hash(data.password, 10),
      mustChangePassword: true, // buộc đổi mật khẩu sau lần đăng nhập đầu
    },
  });
  // Gửi email thông tin đăng nhập (Resend khi EMAIL_PROVIDER=resend, còn lại chỉ log)
  const emailSent = data.sendEmail
    ? await getEmailProvider().send({ to: user.email, ...welcomeEmail(user.fullName, user.username, data.password, user.role) })
    : false;
  res.status(201).json({ user: presentUser(user), emailSent });
});

const updateSchema = z.object({
  fullName: fullNameSchema.optional(),
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  role: roleEnum.optional(),
  password: passwordSchema.optional(), // admin đặt lại mật khẩu (tuỳ chọn)
});

/** PATCH /api/users/:id */
usersRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = updateSchema.parse(req.body);
  const me = currentUser(req);

  if (id === me.id && data.role && data.role !== 'ADMIN') {
    throw badRequest('Bạn không thể tự hạ quyền Admin của chính mình');
  }

  const target = await prisma.user.findUniqueOrThrow({ where: { id } });

  const user = await prisma.$transaction(async (tx) => {
    // Đổi khỏi BTT -> gỡ khỏi các sự kiện đang phụ trách (trigger DB chỉ cho BTT trong event_members)
    if (data.role && target.role === 'BTT' && data.role !== 'BTT') {
      await tx.eventMember.deleteMany({ where: { userId: id } });
    }
    return tx.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        role: data.role,
        ...(data.password && {
          passwordHash: await bcrypt.hash(data.password, 10),
          mustChangePassword: true,
        }),
      },
    });
  });
  res.json({ user: presentUser(user) });
});

/** DELETE /api/users/:id — chỉ xoá được người chưa tạo sự kiện nào */
usersRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === currentUser(req).id) throw badRequest('Bạn không thể xoá chính mình');
  const events = await prisma.event.count({ where: { createdById: id } });
  if (events > 0) throw badRequest('Tài khoản này đã tạo sự kiện, không thể xoá. Hãy đổi vai trò thay vì xoá.');
  await prisma.user.delete({ where: { id } });
  res.status(204).end();
});
