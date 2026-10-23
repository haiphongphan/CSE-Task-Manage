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
  reminderCron: process.env.REMINDER_CRON ?? '0 8 * * *',
  reminderRunOnStart: (process.env.REMINDER_RUN_ON_START ?? 'true') === 'true',
  pushProvider: (process.env.PUSH_PROVIDER ?? 'log') as 'log' | 'expo',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  timezone: 'Asia/Ho_Chi_Minh',
  /** Recap phải nộp trong bao nhiêu ngày sau khi sự kiện kết thúc */
  recapDueDays: 7,
  /** Nhắc phân công chụp ảnh bắt đầu từ bao nhiêu ngày trước sự kiện */
  photoReminderDaysBefore: 3,
};
