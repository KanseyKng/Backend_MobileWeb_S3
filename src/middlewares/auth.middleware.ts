// src/middlewares/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { errorResponse } from '../utils/response';
import { prisma } from '../config/database';
import type { JwtPayload, AuthenticatedUser } from '../models/user.model';

// Extend Request untuk simpan user
export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Cek header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Akses ditolak. Token tidak ditemukan.', 401);
    }

    // 2. Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return errorResponse(res, 'Token tidak valid.', 401);
    }

    // 3. Verify token
    const decoded: JwtPayload = verifyToken(token);

    // 4. Cek user masih ada di DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'User tidak ditemukan atau tidak aktif.', 401);
    }

    // 5. Simpan user di request
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'USER' | 'ADMIN',
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token sudah kedaluwarsa. Silakan login ulang.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Token tidak valid.', 401);
    }
    return errorResponse(res, 'Terjadi kesalahan autentikasi.', 500);
  }
};