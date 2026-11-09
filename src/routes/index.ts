// src/routes/index.ts
import { Router } from 'express';
import { authRouter } from './auth.route';
import { productRouter } from './product.route';
import { transactionRouter } from './transaction.route';
import { adminRouter } from './admin.route';
import { notificationRouter } from './notification.route'; // ✅ TAMBAHKAN

export const routes = Router();

routes.use('/auth', authRouter);
routes.use('/products', productRouter);
routes.use('/transactions', transactionRouter);
routes.use('/admin', adminRouter);
routes.use('/notifications', notificationRouter); // ✅ DAFTARKAN