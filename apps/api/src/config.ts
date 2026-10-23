// Đọc biến môi trường từ file .env một lần, kiểm tra và xuất ra object cấu hình có kiểu.
import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}. Hãy copy .env.example thành .env và điền giá trị.`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Lịch gửi bản tin hằng ngày (giờ Việt Nam). Mặc định 09:00 */
  digestCron: process.env.DIGEST_CRON ?? '0 9 * * *',
  /** Giờ gửi bản tin (dùng để "gửi bù" khi server khởi động sau 09:00, VD Render vừa thức dậy) */
  digestHour: Number(process.env.DIGEST_HOUR ?? 9),
  digestCatchUpOnStart: (process.env.DIGEST_CATCH_UP_ON_START ?? 'true') === 'true',
  /** Bí mật để dịch vụ cron bên ngoài (cron-job.org...) gọi POST /api/cron/daily-digest */
  cronSecret: process.env.CRON_SECRET || undefined,
  pushProvider: (process.env.PUSH_PROVIDER ?? 'log') as 'log' | 'expo',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  /** Web Push (PWA trên iPhone/Android/máy tính). Tạo cặp khoá: npx web-push generate-vapid-keys */
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || undefined,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || undefined,
  /** Liên hệ của người gửi (Apple/Google yêu cầu): mailto:email-cua-ban hoặc https://ten-mien */
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  emailProvider: (process.env.EMAIL_PROVIDER ?? 'log') as 'log' | 'resend',
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  emailFrom: process.env.EMAIL_FROM ?? 'CSE Task Manage <onboarding@resend.dev>',
  /** Địa chỉ web, dùng để tạo link trong email */
  webUrl: (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  timezone: 'Asia/Ho_Chi_Minh',
  /** Recap phải nộp trong bao nhiêu ngày sau khi sự kiện kết thúc */
  recapDueDays: 7,
  /** Nhắc phân công chụp ảnh bắt đầu từ bao nhiêu ngày trước sự kiện */
  photoReminderDaysBefore: 3,
};
