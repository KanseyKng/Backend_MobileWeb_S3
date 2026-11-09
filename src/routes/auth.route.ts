// src/routes/auth.route.ts
import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  getSettings,
  updateSettings,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const authRouter = Router();

// PUBLIC
authRouter.post('/register', register);
authRouter.post('/login', login);

// PROTECTED
authRouter.post('/logout', authMiddleware, logout);
authRouter.get('/me', authMiddleware, getMe);

// ✅ ENDPOINT BARU
authRouter.put('/profile', authMiddleware, updateProfile);
authRouter.get('/settings', getSettings);
authRouter.put('/settings', authMiddleware, updateSettings);