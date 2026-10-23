// /api/auth — đăng ký, đăng nhập, thông tin bản thân, đổi mật khẩu
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { currentUser, requireAuth, signToken } from '../middleware/auth';
import { badRequest, unauthorized } from '../lib/http';
import { presentUser } from '../services/presenters';

export const authRouter = Router();

// Quy tắc dùng chung (cũng dùng ở routes/users.ts)
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,50}$/, 'Username 3–50 ký tự, chỉ gồm chữ thường, số, dấu chấm, gạch dưới');
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .regex(/\d/, 'Mật khẩu phải có ít nhất 1 chữ số');
export const emailSchema = z.string().trim().toLowerCase().email('Email không hợp lệ');
export const fullNameSchema = z.string().trim().min(2, 'Vui lòng nhập họ tên').max(100);

const registerSchema = z
  .object({
    fullName: fullNameSchema,
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    // Tự đăng ký CHỈ được chọn BCH hoặc BTT — Admin do admin khác tạo
    role: z.enum(['BCH', 'BTT'], { errorMap: () => ({ message: 'Vui lòng chọn vai trò BCH hoặc BTT' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });

authRouter.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      role: data.role,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
  });
  res.status(201).json({ token: signToken(user), user: presentUser(user) });
});

const loginSchema = z.object({
  login: z.string().trim().min(1, 'Nhập username hoặc email'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});

authRouter.post('/login', async (req, res) => {
  const { login, password } = loginSchema.parse(req.body);
  const key = login.toLowerCase();
  const user = await prisma.user.findFirst({ where: { OR: [{ username: key }, { email: key }] } });

  // Cùng một thông báo cho cả 2 trường hợp, tránh lộ việc tài khoản có tồn tại hay không
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Sai tên đăng nhập hoặc mật khẩu');
  }
  res.json({ token: signToken(user), user: presentUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id } });
  res.json({ user: presentUser(user) });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('Mật khẩu hiện tại không đúng');
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
  });
  res.json({ user: presentUser(updated) });
});
