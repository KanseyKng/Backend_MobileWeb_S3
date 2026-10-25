// src/routes/product.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const productRouter = Router();

// 1. GET /api/products (Public - Untuk Mobile & Web)
productRouter.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, products, 'Berhasil ambil produk');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil produk', 500);
  }
});

// 2. POST /api/products (Khusus Admin - Untuk Web Admin)
productRouter.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, category, price, stock, description } = req.body;
      
      // Generate SKU otomatis
      const sku = `PRD-${Date.now().toString().slice(-6)}`;

      const newProduct = await prisma.product.create({
        data: {
          name,
          category,
          price: Number(price),
          stock: Number(stock),
          description,
          sku,
        },
      });

      return successResponse(res, newProduct, 'Produk berhasil ditambahkan', 201);
    } catch (error) {
      return errorResponse(res, 'Gagal menambah produk', 500);
    }
  }
);

// 3. DELETE /api/products/:id (Khusus Admin)
productRouter.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.product.delete({
        where: { id: req.params.id },
      });
      return successResponse(res, null, 'Produk berhasil dihapus');
    } catch (error) {
      return errorResponse(res, 'Gagal menghapus produk', 500);
    }
  }
);