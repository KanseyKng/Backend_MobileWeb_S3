// src/routes/wishlist.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const wishlistRouter = Router();

// 1. GET /api/wishlists (Ambil semua wishlist user)
wishlistRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const wishlists = await prisma.wishlist.findMany({
      where: { userId: req.user?.userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    // Kembalikan array produk saja
    const products = wishlists.map((w) => w.product);
    return successResponse(res, products, 'Berhasil ambil wishlist');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil wishlist', 500);
  }
});

// 2. POST /api/wishlists (Tambah ke wishlist)
wishlistRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.body;
    if (!productId) return errorResponse(res, 'Product ID wajib diisi', 400);

    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId: req.user!.userId, productId } },
    });

    if (existing) return successResponse(res, null, 'Produk sudah ada di wishlist');

    await prisma.wishlist.create({
      data: { userId: req.user!.userId, productId },
    });

    return successResponse(res, null, 'Berhasil tambah wishlist', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal tambah wishlist', 500);
  }
});

// 3. DELETE /api/wishlists/:productId (Hapus dari wishlist)
wishlistRouter.delete('/:productId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.wishlist.deleteMany({
      where: { userId: req.user!.userId, productId: req.params.productId },
    });
    return successResponse(res, null, 'Berhasil hapus dari wishlist');
  } catch (error) {
    return errorResponse(res, 'Gagal hapus wishlist', 500);
  }
});