// src/routes/auth.route.ts
import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const authRouter = Router();

// ============ PUBLIC ROUTES ============
authRouter.post('/register', register);
authRouter.post('/login', login);

// ============ PROTECTED ROUTES ============
authRouter.post('/logout', authMiddleware, logout);
authRouter.get('/me', authMiddleware, getMe);