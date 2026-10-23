// /api/cron/* — cho dịch vụ hẹn giờ BÊN NGOÀI gọi (cron-job.org, GitHub Actions...).
// Cần khi deploy lên gói miễn phí (Render free tự "ngủ" nên node-cron bên trong
// không chạy đúng 09:00). Bảo vệ bằng CRON_SECRET thay vì đăng nhập.
import { Router } from 'express';
import { config } from '../config';
import { forbidden } from '../lib/http';
import { runDailyDigest } from '../services/digest';

export const cronRouter = Router();

cronRouter.post('/daily-digest', async (req, res) => {
  const header = req.headers['x-cron-secret'] ?? req.headers.authorization?.replace(/^Bearer /, '');
  if (!config.cronSecret || header !== config.cronSecret) throw forbidden('Sai hoặc thiếu CRON_SECRET');
  res.json(await runDailyDigest());
});
