// src/routes/transaction.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { APP_CONFIG } from '../config/app.config'; // ✅ Import config

export const transactionRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => cb(null, `proof-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`),
});
const upload = multer({ storage });

// 1. POST /api/transactions/checkout
transactionRouter.post('/checkout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { customerName, customerPhone, customerAddress, items, totalPrice, paymentMethod } = req.body;
    const orderId = `TRX-${Date.now().toString().slice(-6)}`;

    let itemsJson = '';
    if (typeof items === 'string') {
      itemsJson = items;
    } else if (Array.isArray(items)) {
      itemsJson = JSON.stringify(items);
    } else {
      return errorResponse(res, 'Format items tidak valid', 400);
    }

    const newTransaction = await prisma.transaction.create({
      data: { orderId, customerName, customerPhone, customerAddress, items: itemsJson, totalPrice, paymentMethod, status: 'Menunggu Verifikasi' },
    });

    await prisma.notification.create({
      data: {
        title: 'Pesanan Baru Diterima',
        message: `Pesanan #${orderId} oleh ${customerName} menunggu verifikasi pembayaran.`,
        category: 'Pesanan',
        relatedId: newTransaction.id,
      },
    });

    return successResponse(res, newTransaction, 'Pesanan berhasil dibuat', 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Gagal membuat pesanan', 500);
  }
});

// 2. POST /api/transactions/upload-proof/:orderId
transactionRouter.post('/upload-proof/:orderId', upload.single('proof'), async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'File bukti tidak ditemukan', 400);

    // ✅ Gunakan APP_CONFIG.BASE_URL dari .env
    const fileUrl = `${APP_CONFIG.BASE_URL}/uploads/${req.file.filename}`;

    const updated = await prisma.transaction.update({
      where: { orderId: req.params.orderId },
      data: { paymentProof: fileUrl, status: 'Menunggu Verifikasi' },
    });

    return successResponse(res, updated, 'Bukti transfer berhasil diunggah');
  } catch (error) {
    return errorResponse(res, 'Gagal upload bukti', 500);
  }
});

// 3. GET /api/transactions
transactionRouter.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, transactions, 'Berhasil ambil transaksi');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil transaksi', 500);
  }
});

// 4. PUT /api/transactions/:id
transactionRouter.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) return errorResponse(res, 'Status wajib diisi', 400);

    const updated = await prisma.transaction.update({
      where: { id: req.params.id },
      data: { status },
    });

    if (status === 'Dikirim' || status === 'Selesai') {
      await prisma.notification.create({
        data: {
          title: status === 'Dikirim' ? 'Pesanan Telah Dikirim' : 'Pesanan Selesai',
          message: `Pesanan #${updated.orderId} telah ${status === 'Dikirim' ? 'diserahkan ke kurir' : 'diselesaikan'}.`,
          category: 'Pengiriman',
          relatedId: updated.id,
        },
      });
    }

    return successResponse(res, updated, `Status diubah menjadi ${status}`);
  } catch (error: any) {
    if (error?.code === 'P2025') return errorResponse(res, 'Transaksi tidak ditemukan', 404);
    return errorResponse(res, 'Gagal update status', 500);
  }
});

// 5. DELETE /api/transactions/:id
transactionRouter.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.transaction.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Transaksi berhasil dihapus');
  } catch (error: any) {
    if (error?.code === 'P2025') return errorResponse(res, 'Transaksi tidak ditemukan', 404);
    return errorResponse(res, 'Gagal menghapus transaksi', 500);
  }
});