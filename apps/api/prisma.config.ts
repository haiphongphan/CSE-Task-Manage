// Cấu hình Prisma CLI (Prisma 7): chỉ đường tới schema và chuỗi kết nối DB
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Dùng process.env (không dùng env()) để `prisma generate` chạy được cả khi chưa có .env
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
