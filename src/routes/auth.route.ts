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
  changePassword,
  uploadAvatar,
  deleteAvatar,
  upload,
  handleMulterError, // ✅ Import middleware
} from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const authRouter = Router();

// PUBLIC
authRouter.post('/register', register);
authRouter.post('/login', login);

// PROTECTED
authRouter.post('/logout', authMiddleware, logout);
authRouter.get('/me', authMiddleware, getMe);

// ✅ ENDPOINT
authRouter.put('/profile', authMiddleware, updateProfile);
authRouter.put('/change-password', authMiddleware, changePassword);
// ✅ Tambahkan handleMulterError setelah upload.single
authRouter.post('/upload-avatar', authMiddleware, upload.single('avatar'), handleMulterError, uploadAvatar);
authRouter.delete('/delete-avatar', authMiddleware, deleteAvatar);
authRouter.get('/settings', getSettings);
authRouter.put('/settings', authMiddleware, updateSettings);