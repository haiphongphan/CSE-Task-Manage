// Lắp ráp ứng dụng Express: middleware chung -> các router -> xử lý lỗi.
// Tách khỏi index.ts để có thể import app trong script kiểm thử mà không mở cổng.
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { eventsRouter } from './routes/events';
import { attachmentsRouter } from './routes/attachments';
import { tasksRouter } from './routes/tasks';
import { notificationsRouter } from './routes/notifications';
import { cronRouter } from './routes/cron';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();

  // App mobile không gửi header Origin nên luôn được phép; web phải nằm trong CORS_ORIGINS
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/events/:eventId/attachments', attachmentsRouter); // trước eventsRouter: nhận body là file thô
  app.use('/api/events', eventsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/cron', cronRouter); // đặt TRƯỚC notificationsRouter (router đó yêu cầu đăng nhập)
  app.use('/api', notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
