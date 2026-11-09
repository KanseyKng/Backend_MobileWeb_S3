// src/app.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { productRouter } from './routes/product.route';
import { authRouter } from './routes/auth.route'; 
import { transactionRouter } from './routes/transaction.route';
import { adminRouter } from './routes/admin.route';
import { notificationRouter } from './routes/notification.route'; 
import { APP_CONFIG } from './config/app.config';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware'; // ✅ IMPORT MIDDLEWARE

const app = express();

// 1. Middleware Dasar
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Static Files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 3. Routes (WAJIB DIDAFTARKAN SEBELUM MIDDLEWARE 404)
app.use('/api/products', productRouter);
app.use('/api/auth', authRouter); 
app.use('/api/transactions', transactionRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationRouter); 

// ✅ 4. 404 Handler (Paling Bawah Setelah Routes)
app.use(notFoundMiddleware);

// ✅ 5. Error Handler (Paling Bawah Sekali)
app.use(errorMiddleware);

// 6. Listen
app.listen(APP_CONFIG.PORT, '0.0.0.0', () => {
  console.log(`✅ Server berjalan di port ${APP_CONFIG.PORT}`);
  console.log(`✅ BASE URL saat ini: ${APP_CONFIG.BASE_URL}`);
});