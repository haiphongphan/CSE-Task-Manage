// Điểm khởi động API: mở cổng HTTP + lên lịch job nhắc nhở hằng ngày.
import cron from 'node-cron';
import { config } from './config';
import { createApp } from './app';
import { prisma } from './prisma';
import { runDailyReminders } from './services/reminders';

async function main() {
  await prisma.$connect(); // báo lỗi sớm nếu DATABASE_URL sai
  const app = createApp();

  // 0.0.0.0 để điện thoại cùng mạng Wi-Fi gọi được API qua IP LAN của máy Mac
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`✅ API chạy tại http://localhost:${config.port}/api  (push: ${config.pushProvider})`);
  });

  // Job nhắc nhở: mặc định 08:00 mỗi ngày theo giờ Việt Nam
  cron.schedule(config.reminderCron, () => void runDailyReminders(), { timezone: config.timezone });
  console.log(`⏰ Đã lên lịch nhắc nhở: "${config.reminderCron}" (${config.timezone})`);

  if (config.reminderRunOnStart) {
    runDailyReminders().catch((err) => console.error('[reminders] lỗi:', err));
  }
}

main().catch((err) => {
  console.error('Không khởi động được API:', err);
  process.exit(1);
});
