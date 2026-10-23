# Dự án: CSE Task Manage
## Stack
- DB: PostgreSQL 16 cài local bằng Homebrew, KHÔNG dùng Docker
- Nạp dữ liệu: psql CLI (schema.sql, seed.sql, \copy từ CSV)
- Backend: Node.js + Prisma (kết nối qua DATABASE_URL trong .env)
- Web: Next.js | Mobile: React Native (Expo)
- Monorepo: apps/web, apps/mobile, apps/api, db/
## Quy ước
- Chỉ chạy local, có .env.example, không commit .env
- Giao diện bám sát Figma: https://www.figma.com/design/lX3bPI7EG4PysKHa521nSY/Task-Manage?node-id=0-1&t=0Dh4Y4J66mYAyBKc-1
## Cách chạy
- (tôi sẽ cập nhật khi dựng xong)