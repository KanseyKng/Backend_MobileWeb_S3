// src/routes/transaction.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { snap } from '../services/midtrans.service';

export const transactionRouter = Router();

// ✅ HELPER: Kirim notifikasi ke semua Admin
async function notifyAdmins(title: string, message: string, category: string, relatedId?: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admins.length === 0) return;
    await Promise.all(
      admins.map((admin) =>
        prisma.notification.create({
          data: { userId: admin.id, title, message, category, relatedId },
        })
      )
    );
  } catch (error) {
    console.error('Gagal mengirim notifikasi ke admin:', error);
  }
}

function toIntPrice(v: any): number {
  if (typeof v === 'number') return Math.round(v);
  const s = String(v ?? '').trim();
  if (!s) return 0;
  if (/^\d+\.\d{1,2}$/.test(s)) return Math.round(parseFloat(s));
  const digits = s.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function toIntQty(v: any): number {
  const n = Math.round(Number(v ?? 1));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

interface NormalizedItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  productId?: string;
  imageUrl?: string;
}

function normalizeItems(raw: any): NormalizedItem[] {
  let arr: any[];
  if (typeof raw === 'string') {
    arr = JSON.parse(raw);
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    throw new Error('Format items tidak valid');
  }
  if (!Array.isArray(arr)) throw new Error('Format items tidak valid');

  return arr.map((it: any, idx: number) => {
    const baseId = String(it.productId ?? it.id ?? `P${idx + 1}`);
    return {
      id: `${baseId}-${idx + 1}`.slice(0, 50),
      name: String(it.productName ?? it.name ?? 'Produk').slice(0, 50),
      price: toIntPrice(it.price),
      qty: toIntQty(it.qty ?? it.quantity ?? 1),
      productId: it.productId ? String(it.productId) : undefined,
      imageUrl: it.imageUrl ? String(it.imageUrl) : '',
    };
  });
}

// ============================================================
// 1. CHECKOUT (Pesanan Masuk)
// ============================================================
transactionRouter.post(
  '/checkout',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return errorResponse(res, 'User tidak valid', 401);

      const { customerName, customerPhone, customerAddress } = req.body ?? {};
      const paymentMethod = String(req.body?.paymentMethod ?? 'MIDTRANS');

      if (!customerName || !customerPhone || !customerAddress) {
        return errorResponse(res, 'Nama, telepon, dan alamat wajib diisi', 400);
      }

      let items: NormalizedItem[];
      try {
        items = normalizeItems(req.body?.items);
      } catch (e: any) {
        return errorResponse(res, e?.message || 'Format items tidak valid', 400);
      }

      if (items.length === 0) return errorResponse(res, 'Keranjang kosong', 400);
      if (items.some((i) => i.price <= 0)) return errorResponse(res, 'Harga tidak valid', 400);

      const productIds = items.map((i) => i.productId).filter((id): id is string => !!id);
      if (productIds.length > 0) {
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, price: true, name: true },
        });
        const priceMap = new Map(products.map((p) => [p.id, p.price]));
        for (const it of items) {
          if (it.productId && priceMap.has(it.productId)) {
            if (it.price !== priceMap.get(it.productId)!) {
              return errorResponse(res, `Harga produk "${it.name}" tidak valid.`, 400);
            }
          }
        }
      }

      const shippingCost = Math.max(0, Math.round(Number(req.body?.shippingCost ?? 0)));
      const itemDetails = items.map((i) => ({
        id: i.id, price: i.price, quantity: i.qty, name: i.name,
      }));
      if (shippingCost > 0) {
        itemDetails.push({ id: 'SHIPPING', price: shippingCost, quantity: 1, name: 'Ongkos Kirim' });
      }

      const grossAmount = itemDetails.reduce((sum, it) => sum + it.price * it.quantity, 0);
      if (grossAmount < 1) return errorResponse(res, 'Total tidak valid', 400);

      const orderId = `TRX-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const user = await prisma.user.findUnique({
        where: { id: userId }, select: { name: true, email: true },
      });

      const parameter: any = {
        transaction_details: { order_id: orderId, gross_amount: grossAmount },
        item_details: itemDetails,
        customer_details: {
          first_name: String(customerName).slice(0, 50),
          phone: String(customerPhone).slice(0, 20),
          ...(user?.email ? { email: user.email } : {}),
        },
        enabled_payments: ['credit_card', 'other_qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'permata_va', 'echannel'],
        expiry: { unit: 'hours', duration: 24 },
      };

      const transaction = await snap.createTransaction(parameter);

      const newTransaction = await prisma.transaction.create({
        data: {
          orderId, userId,
          customerName: String(customerName),
          customerPhone: String(customerPhone),
          customerAddress: String(customerAddress),
          items: JSON.stringify(items),
          totalPrice: grossAmount,
          paymentMethod,
          status: 'Menunggu Pembayaran',
          snapToken: transaction.token,
        },
      });

      await prisma.notification.create({
        data: {
          userId,
          title: 'Pesanan Berhasil Dibuat',
          message: `Pesanan #${orderId} berhasil dibuat. Silakan selesaikan pembayaran.`,
          category: 'Pesanan',
          relatedId: newTransaction.id,
        },
      });

      // ✅ Notifikasi Admin (Pesanan Masuk)
      await notifyAdmins(
        'Pesanan Baru Masuk',
        `Pesanan #${orderId} oleh ${customerName} sebesar Rp ${grossAmount.toLocaleString('id-ID')} menunggu pembayaran.`,
        'Pesanan',
        newTransaction.id
      );

      return successResponse(res, {
        transaction: newTransaction,
        snapToken: transaction.token,
        redirectUrl: transaction.redirect_url,
      }, 'Pesanan berhasil dibuat', 201);

    } catch (error: any) {
      console.error('❌ ERROR CHECKOUT:', error);
      return errorResponse(res, `Gagal membuat pesanan`, 500);
    }
  }
);

// ============================================================
// 2. WEBHOOK (Midtrans Verifikasi)
// ============================================================
transactionRouter.post('/webhook', async (req, res) => {
  try {
    const notification = req.body ?? {};
    const signatureSecret = (process.env.MIDTRANS_SIGNATURE_SECRET || '').trim();

    if (!notification.order_id || !notification.signature_key) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${signatureSecret}`)
      .digest('hex');

    if (expectedSignature !== notification.signature_key) {
      return res.status(403).json({ message: 'Invalid signature' });
    }

    const orderId = String(notification.order_id);
    const transactionStatus = String(notification.transaction_status);
    const fraudStatus = notification.fraud_status ? String(notification.fraud_status) : undefined;
    const transactionId = notification.transaction_id ? String(notification.transaction_id) : undefined;

    console.log(`🔔 Webhook Midtrans: ${orderId} | status=${transactionStatus}`);

    const trx = await prisma.transaction.findUnique({ where: { orderId } });
    if (!trx) return res.status(200).json({ message: 'Not found' });

    let newStatus = trx.status;
    switch (transactionStatus) {
      case 'capture':
      case 'settlement':
        newStatus = fraudStatus === 'challenge' ? 'Menunggu Verifikasi' : 'Diproses';
        break;
      case 'pending': newStatus = 'Menunggu Pembayaran'; break;
      case 'deny': case 'cancel': case 'expire': case 'failure': newStatus = 'Dibatalkan'; break;
    }

    if (newStatus === trx.status && (transactionId ?? null) === (trx.transactionId ?? null)) {
      return res.status(200).json({ message: 'OK (no change)' });
    }

    await prisma.transaction.update({
      where: { id: trx.id },
      data: { status: newStatus, ...(transactionId ? { transactionId } : {}) },
    });

    if (newStatus === 'Diproses' && trx.status !== 'Diproses') {
      await prisma.notification.create({
        data: {
          userId: trx.userId,
          title: 'Pembayaran Berhasil',
          message: `Pembayaran pesanan #${orderId} berhasil. Pesanan diproses.`,
          category: 'Pesanan',
          relatedId: trx.id,
        },
      });
      // ✅ Notifikasi Admin (Midtrans Settlement)
      await notifyAdmins(
        'Pembayaran Diterima',
        `Pembayaran untuk pesanan #${orderId} telah berhasil diverifikasi oleh sistem.`,
        'Pesanan',
        trx.id
      );
    }

    return res.status(200).json({ message: 'OK' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ============================================================
// 3. GET ALL TRANSACTIONS
// ============================================================
transactionRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.userId;
    const whereClause = userRole === 'ADMIN' ? {} : { userId };
    
    const transactions = await prisma.transaction.findMany({
      where: whereClause, orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });

    return successResponse(res, transactions, 'Berhasil ambil transaksi');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil transaksi', 500);
  }
});

// ============================================================
// 4. UPDATE STATUS (Hanya Admin)
// ============================================================
transactionRouter.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) return errorResponse(res, 'Status wajib diisi', 400);
    if (status === 'Selesai') return errorResponse(res, 'Status "Selesai" hanya bisa diubah oleh Customer.', 403);

    const updated = await prisma.transaction.update({
      where: { id: req.params.id }, data: { status },
    });

    if (status === 'Dikirim') {
      await prisma.notification.create({
        data: {
          userId: updated.userId, title: 'Pesanan Telah Dikirim',
          message: `Pesanan #${updated.orderId} telah diserahkan ke kurir.`,
          category: 'Pengiriman', relatedId: updated.id,
        },
      });
    }
    return successResponse(res, updated, `Status diubah menjadi ${status}`);
  } catch (error: any) {
    return errorResponse(res, 'Gagal update status', 500);
  }
});

// ============================================================
// 5. CUSTOMER: TANDAI SELESAI
// ============================================================
transactionRouter.put('/:id/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const trx = await prisma.transaction.findUnique({ where: { id: req.params.id } });

    if (!trx) return errorResponse(res, 'Transaksi tidak ditemukan', 404);
    if (trx.userId !== userId) return errorResponse(res, 'Akses ditolak', 403);
    if (trx.status !== 'Dikirim') return errorResponse(res, 'Hanya pesanan berstatus Dikirim yang bisa diselesaikan.', 400);

    const updated = await prisma.transaction.update({
      where: { id: trx.id }, data: { status: 'Selesai' },
    });

    await prisma.notification.create({
      data: {
        userId: trx.userId, title: 'Pesanan Selesai',
        message: `Pesanan #${trx.orderId} telah selesai. Terima kasih telah berbelanja.`,
        category: 'Pesanan', relatedId: trx.id,
      },
    });

    // ✅ Notifikasi Admin (Pesanan Selesai oleh User)
    await notifyAdmins(
      'Pesanan Diselesaikan',
      `Pesanan #${trx.orderId} telah dikonfirmasi selesai oleh pembeli.`,
      'Pesanan',
      trx.id
    );

    return successResponse(res, updated, 'Pesanan berhasil diselesaikan');
  } catch (error: any) {
    return errorResponse(res, 'Gagal menyelesaikan pesanan', 500);
  }
});

// ============================================================
// 6. ADMIN: BATALKAN TRANSAKSI
// ============================================================
transactionRouter.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const trx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!trx) return errorResponse(res, 'Transaksi tidak ditemukan', 404);

    const updated = await prisma.transaction.update({
      where: { id: trx.id }, data: { status: 'Dibatalkan' },
    });

    await prisma.notification.create({
      data: {
        userId: trx.userId, title: 'Pesanan Dibatalkan',
        message: `Pesanan #${trx.orderId} telah dibatalkan oleh Admin.`,
        category: 'Pesanan', relatedId: trx.id,
      },
    });

    return successResponse(res, updated, 'Transaksi berhasil dibatalkan');
  } catch (error: any) {
    return errorResponse(res, 'Gagal membatalkan transaksi', 500);
  }
});