// src/routes/index.ts
import { Router } from 'express';
import { authRouter } from './auth.route';
import { adminRouter } from './admin.route';
import { productRouter } from './product.route'; // ✅ Tambahkan ini

export const routes = Router();

routes.use('/auth', authRouter);
routes.use('/admin', adminRouter);
routes.use('/products', productRouter); // ✅ Daftarkan route