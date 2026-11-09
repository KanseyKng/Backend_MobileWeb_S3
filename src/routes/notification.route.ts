// src/routes/notification.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const notificationRouter = Router();

notificationRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { category, search, startDate, endDate, status } = req.query;
    const where: any = {};

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

notificationRouter.get('/unread-count', authMiddleware, async (_req, res) => {
  try {
    const count = await prisma.notification.count({ where: { isRead: false } });
    return successResponse(res, { count }, 'Berhasil ambil jumlah unread');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil unread', 500);
  }
});

notificationRouter.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    return successResponse(res, null, 'Notifikasi ditandai sudah dibaca');
  } catch (error) {
    return errorResponse(res, 'Gagal update notifikasi', 500);
  }
});

notificationRouter.put('/read-all', authMiddleware, async (_req, res) => {
  try {
    await prisma.notification.updateMany({ data: { isRead: true } });
    return successResponse(res, null, 'Semua notifikasi ditandai sudah dibaca');
  } catch (error) {
    return errorResponse(res, 'Gagal update notifikasi', 500);
  }
});

notificationRouter.delete('/old', authMiddleware, async (_req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const deleted = await prisma.notification.deleteMany({
      where: { createdAt: { lt: startOfMonth } },
    });

    return successResponse(res, { deleted: deleted.count }, 'Notifikasi lama dihapus');
  } catch (error) {
    return errorResponse(res, 'Gagal hapus notifikasi', 500);
  }
});