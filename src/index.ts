// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { connectDatabase, prisma } from './config/database'; // ✅ Tambahkan prisma
import { routes } from './routes';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';

const app = express();

// ============================================================
// 1. TRUST PROXY
// ============================================================
app.set('trust proxy', 1);

// ============================================================
// 2. CORS - DIPERBAIKI UNTUK FLUTTER WEB + NGROK
// ============================================================
const corsOptions = {
  origin: true, // Development: izinkan semua origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'ngrok-skip-browser-warning', // ✅ Kunci untuk melewati peringatan Ngrok
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ============================================================
// 3. LOGGER & BODY PARSER
// ============================================================
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// 4. HEALTH CHECK & ROOT
// ============================================================
app.get('/api/health', (_req, res) => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
  const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? '';
  const isProduction = String(process.env.MIDTRANS_IS_PRODUCTION ?? 'false').toLowerCase() === 'true';

  res.status(200).json({
    success: true,
    message: 'Ikobana API OK',
    version: '1.0.0',
    env: env.nodeEnv,
    time: new Date().toISOString(),
    midtrans: {
      isProduction,
      serverKeyLoaded: serverKey.length > 0,
      serverKeyPrefix: serverKey.slice(0, 7) || null,
      clientKeyLoaded: clientKey.length > 0,
    },
  });
});

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: '🚀 Ikobana Backend API berjalan!',
    version: '1.0.0',
    database: 'MySQL + Prisma',
    storage: 'Cloudinary',
  });
});

// ============================================================
// 5. STATIC FILE UPLOAD
// ============================================================
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    fallthrough: true,
    maxAge: '1d',
  })
);

// ============================================================
// 6. SEMUA ROUTE API
// ============================================================
app.use('/api', routes);

// ============================================================
// 7. 404 & ERROR HANDLER
// ============================================================
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// ============================================================
// 8. FUNGSI AUTO-CLEANUP NOTIFIKASI (RETENSI 6 BULAN)
// ============================================================
const cleanupOldNotifications = async () => {
  try {
    // Hitung tanggal 6 bulan yang lalu
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const deleted = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: sixMonthsAgo, // lt = Less Than (Lebih kecil / lebih lama dari 6 bulan lalu)
        },
      },
    });

    if (deleted.count > 0) {
      console.log(`🧹 [Auto-Cleanup] Berhasil menghapus ${deleted.count} notifikasi yang berumur > 6 bulan.`);
    }
  } catch (error) {
    console.error('❌ [Auto-Cleanup] Gagal menghapus notifikasi lama:', error);
  }
};

// ============================================================
// 9. START SERVER
// ============================================================
const startServer = async () => {
  await connectDatabase();

  // Jalankan Auto-Cleanup saat server pertama kali menyala
  await cleanupOldNotifications();

  // Jadwalkan Auto-Cleanup setiap 24 jam (1 hari sekali)
  // 24 jam * 60 menit * 60 detik * 1000 milidetik
  setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000);

  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
  const isProduction = String(process.env.MIDTRANS_IS_PRODUCTION ?? 'false').toLowerCase() === 'true';

  app.listen(env.port, '0.0.0.0', () => {
    console.log('');
    console.log('════════════════════════════════════════');
    console.log(`🚀 Server berjalan di http://localhost:${env.port}`);
    console.log(`📦 Environment: ${env.nodeEnv}`);
    console.log(`🗄️  Database: MySQL`);
    console.log(`☁️  Storage: Cloudinary`);

    if (!serverKey) {
      console.log('⚠️  MIDTRANS_SERVER_KEY KOSONG — checkout akan gagal');
    } else if (!isProduction && !serverKey.startsWith('SB-')) {
      console.log('⚠️  Key Midtrans bukan format Sandbox (SB-...)');
    } else {
      console.log(`💳 Midtrans: ${isProduction ? 'PRODUCTION' : 'SANDBOX'} ✅`);
    }

    console.log('✅ Auto-Cleanup Notifikasi (Retensi 6 Bulan): AKTIF');
    console.log('════════════════════════════════════════');
    console.log('');
  });
};

startServer();