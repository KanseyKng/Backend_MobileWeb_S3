// src/routes/product.route.ts
import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../middlewares/auth.middleware';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { APP_CONFIG } from '../config/app.config';

export const productRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `prod-${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Hanya file gambar (JPG, PNG, WEBP) yang diizinkan!'));
  },
});

const ProductSchema = z.object({
  name: z.string().min(3),
  category: z.string().min(1),
  price: z.coerce.number().min(1000),
  stock: z.coerce.number().int().min(0),
  description: z.string().optional().default(''),
});

// GET
productRouter.get('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    return successResponse(res, products, 'Berhasil ambil produk');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil produk', 500);
  }
});

// POST
productRouter.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = ProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({
          success: false,
          message: 'Validasi gagal',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { name, category, price, stock, description } = parsed.data;
      const sku = `PRD-${Date.now().toString().slice(-6)}`;
      const imageUrl = req.file ? `${APP_CONFIG.BASE_URL}/uploads/${req.file.filename}` : null;

      const newProduct = await prisma.product.create({
        data: { name, category, price, stock, description, sku, imageUrl },
      });

      // ✅ OTOMATIS BUAT NOTIFIKASI JIKA STOK AWAL < 10
      if (stock < 10) {
        await prisma.notification.create({
          data: {
            title: 'Peringatan Stok Produk',
            message: `Stok ${name} tersisa ${stock} unit. Segera lakukan pengisian stok.`,
            category: 'Stok Produk',
            relatedId: newProduct.id,
          },
        });
      }

      return successResponse(res, newProduct, 'Produk berhasil ditambahkan', 201);
    } catch (error) {
      console.error(error);
      return errorResponse(res, 'Gagal menambah produk', 500);
    }
  }
);

// DELETE
productRouter.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.product.delete({ where: { id: req.params.id } });
      return successResponse(res, null, 'Produk berhasil dihapus');
    } catch (error) {
      return errorResponse(res, 'Gagal menghapus produk', 500);
    }
  }
);

// PUT Bulk Update Stock
productRouter.put(
  '/bulk-update-stock',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) return errorResponse(res, 'Format tidak valid', 400);

      for (const u of updates) {
        const updatedProduct = await prisma.product.update({
          where: { id: u.id },
          data: { stock: u.newStock },
        });

        // ✅ OTOMATIS BUAT NOTIFIKASI JIKA STOK MENJADI < 10
        if (updatedProduct.stock < 10) {
          await prisma.notification.create({
            data: {
              title: 'Peringatan Stok Produk',
              message: `Stok ${updatedProduct.name} tersisa ${updatedProduct.stock} unit. Segera lakukan pengisian stok.`,
              category: 'Stok Produk',
              relatedId: updatedProduct.id,
            },
          });
        }
      }

      return successResponse(res, null, 'Stok berhasil diperbarui');
    } catch (error) {
      return errorResponse(res, 'Gagal update stok', 500);
    }
  }
);