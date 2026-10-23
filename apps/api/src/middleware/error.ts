// Middleware xử lý lỗi tập trung: mọi lỗi ném ra trong route đều về đây.
// Express 5 tự bắt lỗi của hàm async, nên route không cần try/catch.
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Không có đường dẫn ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Dữ liệu gửi lên sai định dạng (zod)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: err.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  // Lỗi từ Prisma/PostgreSQL
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Với driver adapter, tên cột nằm sâu trong err.meta -> tìm trong toàn bộ chuỗi JSON
      const target = JSON.stringify(err.meta ?? {});
      const field = target.includes('email') ? 'Email' : target.includes('username') ? 'Username' : 'Giá trị';
      return res.status(409).json({ error: `${field} đã được sử dụng` });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy dữ liệu' });
  }

  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau' });
}
