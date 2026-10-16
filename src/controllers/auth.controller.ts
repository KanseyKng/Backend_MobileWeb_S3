// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { generateToken } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';
import { validateRegister, validateLogin } from '../validators/auth.validator';
import type { AuthRequest } from '../middlewares/auth.middleware';

// ============================================================
// REGISTER
// ============================================================
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password } = req.body;

    // 1. Validasi input
    const errors = validateRegister(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validasi gagal', 400, errors);
    }

    // 2. Cek duplikat email
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingEmail) {
      return errorResponse(res, 'Email sudah terdaftar', 400);
    }

    // 3. Cek duplikat phone
    const existingPhone = await prisma.user.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      return errorResponse(res, 'Nomor HP sudah terdaftar', 400);
    }

    // 4. Hash password (10 rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Simpan user baru (default role USER)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: hashedPassword,
        role: 'USER',
      },
    });

    // 6. Response (TANPA password!)
    return successResponse(
      res,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      'Registrasi berhasil. Silakan login.',
      201
    );
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

    // 1. Validasi
    const errors = validateLogin(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validasi gagal', 400, errors);
    }

    // 2. Cari user by email atau phone
    const user = await prisma.user.findFirst({
      where: email
        ? { email: email.toLowerCase() }
        : { phone: phone },
    });

    if (!user) {
      return errorResponse(res, 'Akun tidak ditemukan. Silakan daftar dulu.', 401);
    }

    // 3. Cek user aktif
    if (!user.isActive) {
      return errorResponse(res, 'Akun Anda tidak aktif. Hubungi admin.', 403);
    }

    // 4. Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, 'Password salah', 401);
    }

    // 5. Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'USER' | 'ADMIN',
    });

    // 6. Response
    return successResponse(
      res,
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
      'Login berhasil',
      200
    );
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
    // JWT bersifat stateless → logout cuma konfirmasi.
    // Client WAJIB hapus token dari storage (SharedPreferences/localStorage)
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
    if (!req.user) {
      return errorResponse(res, 'Tidak terautentikasi', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return errorResponse(res, 'User tidak ditemukan', 404);
    }

    return successResponse(
      res,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
      'Berhasil ambil data user'
    );
  } catch (error: any) {
    return errorResponse(res, 'Terjadi kesalahan', 500);
  }
};