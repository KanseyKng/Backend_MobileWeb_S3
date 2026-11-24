// src/routes/notification.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const notificationRouter = Router();

// ✅ GET Notifikasi (Difilter berdasarkan User yang login)
notificationRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User tidak valid', 401);

    const { category, search, startDate, endDate, status } = req.query;
    
    // ✅ WAJIB: Filter berdasarkan userId
    const where: any = { userId: userId };

    if (category && category !== 'Semua') where.category = category;
    if (status === 'read') where.isRead = true;
    if (status === 'unread') where.isRead = false;

    if (search) {
      where.OR = [
        { title: { contains: String(search) } },
        { message: { contains: String(search) } },
      ];
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate) + 'T23:59:59'),
      };
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, notifications, 'Berhasil ambil notifikasi');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil notifikasi', 500);
  }
});

// ✅ GET Unread Count (Difilter berdasarkan User)
notificationRouter.get('/unread-count', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User tidak valid', 401);

    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    return successResponse(res, { count }, 'Berhasil ambil jumlah unread');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil unread', 500);
  }
});

// ✅ Mark as Read (Satu Notifikasi)
notificationRouter.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User tidak valid', 401);

    // Pastikan notifikasi milik user ini
    const notif = await prisma.notification.findFirst({
      where: { id: req.params.id, userId }
    });

    if (!notif) return errorResponse(res, 'Notifikasi tidak ditemukan', 404);

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    return successResponse(res, null, 'Notifikasi ditandai sudah dibaca');
  } catch (error) {
    return errorResponse(res, 'Gagal update notifikasi', 500);
  }
});

// ✅ Mark All as Read (Semua Notifikasi Milik User)
notificationRouter.put('/read-all', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User tidak valid', 401);

    await prisma.notification.updateMany({ 
      where: { userId }, // ✅ Hanya update milik user ini
      data: { isRead: true } 
    });
    return successResponse(res, null, 'Semua notifikasi ditandai sudah dibaca');
  } catch (error) {
    return errorResponse(res, 'Gagal update notifikasi', 500);
  }
});

// ✅ Delete Old Notifications (Difilter berdasarkan User)
notificationRouter.delete('/old', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User tidak valid', 401);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const deleted = await prisma.notification.deleteMany({
      where: { 
        userId, // ✅ Hanya hapus milik user ini
        createdAt: { lt: startOfMonth } 
      },
    });

    return successResponse(res, { deleted: deleted.count }, 'Notifikasi lama dihapus');
  } catch (error) {
    return errorResponse(res, 'Gagal hapus notifikasi', 500);
  }
});