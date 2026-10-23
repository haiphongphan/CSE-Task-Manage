// Xác thực bằng JWT: client gửi header "Authorization: Bearer <token>".
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../generated/prisma/client';
import { config } from '../config';
import { forbidden, unauthorized } from '../lib/http';
import { prisma } from '../prisma';

export interface AuthUser {
  id: number;
  role: UserRole;
  fullName: string;
  username: string;
}

// Mở rộng kiểu Request của Express để có req.user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: number;
  role: UserRole;
}

export function signToken(user: { id: number; role: UserRole }): string {
  const payload: TokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** Bắt buộc đăng nhập. Đọc lại user từ DB để role luôn mới nhất (admin vừa đổi role vẫn đúng). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret) as unknown as TokenPayload;
  } catch {
    throw unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, role: true, fullName: true, username: true },
  });
  if (!user) throw unauthorized('Tài khoản không còn tồn tại');

  req.user = user;
  next();
}

/** Chỉ cho phép các role được liệt kê. Dùng SAU requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Lấy user hiện tại (đã chắc chắn có vì requireAuth chạy trước) */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
