// src/controllers/auth.controller.ts
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { prisma } from '../config/database';
import { generateToken } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';
import { validateRegister, validateLogin } from '../validators/auth.validator';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { APP_CONFIG } from '../config/app.config';

// ============================================================
// KONFIGURASI UPLOAD AVATAR (DIPERBAIKI)
// ============================================================
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `avatar-${Date.now()}-${safeName}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // ✅ Naikkan ke 5MB
  fileFilter: (_req, file, cb) => {
    // ✅ Longgarkan: Terima semua file yang MIME-nya dimulai dengan "image/"
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan!'));
    }
  },
});

// ============================================================
// ✅ MIDDLEWARE UNTUK MENANGKAP ERROR MULTER
// ============================================================
export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    // Error dari multer (misal: file terlalu besar)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'Ukuran file terlalu besar. Maksimal 5MB.', 400);
    }
    return errorResponse(res, `Upload error: ${err.message}`, 400);
  } else if (err) {
    // Error dari fileFilter (tipe file tidak diizinkan)
    return errorResponse(res, err.message, 400);
  }
  next();
};

// ============================================================
// REGISTER
// ============================================================
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password } = req.body;

    const errors = validateRegister(req.body);
    if (errors.length > 0) return errorResponse(res, 'Validasi gagal', 400, errors);

    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) return errorResponse(res, 'Email sudah terdaftar', 400);

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) return errorResponse(res, 'Nomor HP sudah terdaftar', 400);

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: hashedPassword,
        role: 'USER',
      },
    });

    return successResponse(res, {
      id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, photoUrl: user.photoUrl,
    }, 'Registrasi berhasil. Silakan login.', 201);
  } catch (error: any) {
    console.error('Register error:', error);
    return errorResponse(res, 'Terjadi kesalahan saat registrasi', 500);
  }
};

// ============================================================
// LOGIN
// ============================================================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, phone, password } = req.body;

    const errors = validateLogin(req.body);
    if (errors.length > 0) return errorResponse(res, 'Validasi gagal', 400, errors);

    const user = await prisma.user.findFirst({ where: email ? { email: email.toLowerCase() } : { phone } });
    if (!user) return errorResponse(res, 'Akun tidak ditemukan. Silakan daftar dulu.', 401);
    if (!user.isActive) return errorResponse(res, 'Akun Anda tidak aktif. Hubungi admin.', 403);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return errorResponse(res, 'Password salah', 401);

    const token = generateToken({ userId: user.id, email: user.email, role: user.role as 'USER' | 'ADMIN' });

    return successResponse(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, photoUrl: user.photoUrl },
    }, 'Login berhasil', 200);
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse(res, 'Terjadi kesalahan saat login', 500);
  }
};

// ============================================================
// LOGOUT
// ============================================================
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    return successResponse(res, null, 'Logout berhasil', 200);
  } catch (error: any) {
    return errorResponse(res, 'Terjadi kesalahan saat logout', 500);
  }
};

// ============================================================
// GET ME (Profil Sendiri)
// ============================================================
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return errorResponse(res, 'Tidak terautentikasi', 401);

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return errorResponse(res, 'User tidak ditemukan', 404);

    return successResponse(res, {
      id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, photoUrl: user.photoUrl, createdAt: user.createdAt,
    }, 'Berhasil ambil data user');
  } catch (error: any) {
    return errorResponse(res, 'Terjadi kesalahan', 500);
  }
};

// ============================================================
// UPDATE PROFILE
// ============================================================
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) return errorResponse(res, 'Semua field wajib diisi', 400);

    const updated = await prisma.user.update({
      where: { id: req.user?.userId },
      data: { name, email: email.toLowerCase(), phone },
      select: { id: true, name: true, email: true, phone: true, role: true, photoUrl: true },
    });

    return successResponse(res, updated, 'Profil berhasil diperbarui');
  } catch (error: any) {
    if (error.code === 'P2002') return errorResponse(res, 'Email atau No HP sudah digunakan', 400);
    return errorResponse(res, 'Gagal update profil', 500);
  }
};

// ============================================================
// ✅ FUNGSI BARU: UPLOAD AVATAR
// ============================================================
export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return errorResponse(res, 'File foto tidak ditemukan', 400);

    const fileUrl = `${APP_CONFIG.BASE_URL}/uploads/${req.file.filename}`;

    const updated = await prisma.user.update({
      where: { id: req.user?.userId },
      data: { photoUrl: fileUrl },
      select: { id: true, name: true, email: true, phone: true, photoUrl: true },
    });

    return successResponse(res, updated, 'Foto profil berhasil diunggah');
  } catch (error: any) {
    console.error('Upload avatar error:', error);
    return errorResponse(res, 'Gagal mengunggah foto profil', 500);
  }
};

// ============================================================
// ✅ FUNGSI BARU: DELETE AVATAR (Kembali ke Inisial)
// ============================================================
export const deleteAvatar = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user?.userId },
      data: { photoUrl: null },
    });

    return successResponse(res, null, 'Foto profil berhasil dihapus');
  } catch (error: any) {
    return errorResponse(res, 'Gagal menghapus foto profil', 500);
  }
};

// ============================================================
// CHANGE PASSWORD
// ============================================================
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return errorResponse(res, 'Semua field wajib diisi', 400);
    }

    if (newPassword !== confirmPassword) {
      return errorResponse(res, 'Konfirmasi password baru tidak cocok', 400);
    }

    if (newPassword.length < 8) {
      return errorResponse(res, 'Password baru minimal 8 karakter', 400);
    }

    if (!/(?=.*[a-z])/.test(newPassword) || !/(?=.*[A-Z])/.test(newPassword)) {
      return errorResponse(res, 'Password baru harus mengandung huruf besar dan kecil', 400);
    }

    if (!/(?=.*\d)/.test(newPassword)) {
      return errorResponse(res, 'Password baru harus mengandung angka', 400);
    }

    if (!/(?=.*[!@#$%^&*])/.test(newPassword)) {
      return errorResponse(res, 'Password baru harus mengandung simbol (!@#$%^&*)', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user?.userId } });
    if (!user) return errorResponse(res, 'User tidak ditemukan', 404);

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) return errorResponse(res, 'Password saat ini salah', 401);

    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld) return errorResponse(res, 'Password baru tidak boleh sama dengan password lama', 400);

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    return successResponse(res, null, 'Password berhasil diubah');
  } catch (error: any) {
    console.error('Change password error:', error);
    return errorResponse(res, 'Gagal mengubah password', 500);
  }
};

// ============================================================
// GET SETTINGS
// ============================================================
export const getSettings = async (_req: Request, res: Response) => {
  try {
    let setting = await prisma.setting.findUnique({ where: { id: 'main' } });
    if (!setting) {
      setting = await prisma.setting.create({
        data: { id: 'main', appName: 'LOCALMART', businessName: 'Ikobana Frozen Food', description: 'Platform pemesanan...' },
      });
    }
    return successResponse(res, setting, 'Berhasil ambil setting');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil setting', 500);
  }
};

// ============================================================
// UPDATE SETTINGS
// ============================================================
export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { appName, businessName, description } = req.body;
    if (!appName || !businessName) return errorResponse(res, 'Nama aplikasi dan bisnis wajib diisi', 400);

    const updated = await prisma.setting.upsert({
      where: { id: 'main' },
      update: { appName, businessName, description },
      create: { id: 'main', appName, businessName, description },
    });

    return successResponse(res, updated, 'Pengaturan berhasil diperbarui');
  } catch (error) {
    return errorResponse(res, 'Gagal update pengaturan', 500);
  }
};