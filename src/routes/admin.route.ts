// src/routes/admin.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const adminRouter = Router();

// Semua route di bawah WAJIB login + role ADMIN
adminRouter.use(authMiddleware);
adminRouter.use(roleMiddleware('ADMIN'));

// GET /api/admin/users
adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return successResponse(res, users, 'Berhasil ambil semua user');
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return errorResponse(res, 'User tidak ditemukan', 404);
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'User berhasil dihapus');
  } catch (error) {
    return errorResponse(res, 'Gagal hapus user', 500);
  }
});