// src/middlewares/role.middleware.ts
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import { errorResponse } from '../utils/response';

/**
 * Middleware untuk cek role user
 * Contoh: roleMiddleware('ADMIN') → hanya admin boleh akses
 */
export const roleMiddleware = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Pastikan sudah login
    if (!req.user) {
      return errorResponse(res, 'Akses ditolak. Belum login.', 401);
    }

    // Cek role
    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Akses ditolak. Hanya ${allowedRoles.join(', ')} yang bisa mengakses.`,
        403
      );
    }

    next();
  };
};