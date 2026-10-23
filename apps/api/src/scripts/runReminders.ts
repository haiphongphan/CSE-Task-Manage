// Chạy job nhắc nhở một lần từ dòng lệnh: npm run reminders:run
import { prisma } from '../prisma';
import { runDailyReminders } from '../services/reminders';

runDailyReminders()
  .then((r) => console.log('Kết quả:', r))
  .finally(() => prisma.$disconnect());
