// Gửi bản tin hằng ngày ngay từ dòng lệnh: npm run digest:run
import { prisma } from '../prisma';
import { runDailyDigest } from '../services/digest';

runDailyDigest()
  .then((r) => console.log('Kết quả:', r))
  .finally(() => prisma.$disconnect());
