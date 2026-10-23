// Một PrismaClient dùng chung cho cả ứng dụng.
// Prisma 7 kết nối DB qua "driver adapter": ở đây là thư viện `pg` (node-postgres).
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { config } from './config';

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({
  adapter,
  // Lỗi đã được middleware error.ts xử lý, chỉ cần log cảnh báo
  log: ['warn'],
});
