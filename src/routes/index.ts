// src/routes/index.ts
import { Router } from 'express';
import { authRouter } from './auth.route';
import { adminRouter } from './admin.route';

export const routes = Router();

// Registrasi route
routes.use('/auth', authRouter);
routes.use('/admin', adminRouter);