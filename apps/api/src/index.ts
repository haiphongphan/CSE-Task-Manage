// Điểm khởi động API: mở cổng HTTP + lên lịch bản tin hằng ngày.
import cron from 'node-cron';
import { config } from './config';
import { createApp } from './app';
import { prisma } from './prisma';
import { catchUpDigest, runDailyDigest } from './services/digest';

async function main() {
  await prisma.$connect(); // báo lỗi sớm nếu DATABASE_URL sai
  const app = createApp();

  // 0.0.0.0 để điện thoại cùng mạng Wi-Fi gọi được API qua IP LAN của máy Mac
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`✅ API chạy tại http://localhost:${config.port}/api  (push: ${config.pushProvider}, email: ${config.emailProvider})`);
  });

  // Bản tin gộp: mặc định 09:00 mỗi ngày theo giờ Việt Nam
  cron.schedule(config.digestCron, () => void runDailyDigest(), { timezone: config.timezone });
  console.log(`⏰ Đã lên lịch bản tin hằng ngày: "${config.digestCron}" (${config.timezone})`);

  // Khởi động sau 09:00 mà hôm nay chưa gửi -> gửi bù (DB tự chặn gửi trùng)
  if (config.digestCatchUpOnStart) {
    catchUpDigest().catch((err) => console.error('[digest] lỗi:', err));
  }
}

main().catch((err) => {
  console.error('Không khởi động được API:', err);
  process.exit(1);
});
