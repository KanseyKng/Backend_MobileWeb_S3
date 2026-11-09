// src/index.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { routes } from './routes';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';

const app = express();

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ✅ Static files untuk folder uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Ikobana Backend API berjalan!',
    version: '1.0.0',
    database: 'SQLite + Prisma',
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout',
      me: 'GET /api/auth/me',
      adminUsers: 'GET /api/admin/users (khusus ADMIN)',
      notifications: 'GET /api/notifications (khusus login)',
    },
  });
});

// ============================================================
// ROUTES
// ============================================================
app.use('/api', routes);

// ============================================================
// ERROR HANDLER (harus di paling bawah)
// ============================================================
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// ============================================================
// START SERVER
// ============================================================
const startServer = async () => {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log('');
    console.log('════════════════════════════════════════');
    console.log(`🚀 Server berjalan di http://localhost:${env.port}`);
    console.log(`📦 Environment: ${env.nodeEnv}`);
    console.log(`🗄️  Database: SQLite (file: prisma/dev.db)`);
    console.log('════════════════════════════════════════');
    console.log('');
  });
};

startServer();