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
import { uploadToCloudinary } from '../utils/cloudinary';

export const productRouter = Router();

// ✅ HELPER: Kirim notifikasi ke semua Admin
async function notifyAdmins(title: string, message: string, category: string, relatedId?: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admins.length === 0) {
      console.log('❌ Gagal kirim notif: Tidak ada user dengan role ADMIN');
      return;
    }
    await Promise.all(
      admins.map((admin) =>
        prisma.notification.create({
          data: { userId: admin.id, title, message, category, relatedId },
        })
      )
    );
    console.log(`✅ Notifikasi Stok dikirim ke ${admins.length} Admin.`);
  } catch (error) {
    console.error('Gagal mengirim notifikasi ke admin:', error);
  }
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Hanya file gambar (JPG, PNG, WEBP, GIF) yang diizinkan!'));
  },
});

const ProductSchema = z.object({
  name: z.string().min(3),
  category: z.string().min(1),
  price: z.coerce.number().min(1000),
  stock: z.coerce.number().int().min(0),
  description: z.string().optional().default(''),
});

productRouter.get('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    return successResponse(res, products, 'Berhasil ambil produk');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil produk', 500);
  }
});

productRouter.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = ProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ success: false, message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors });
      }

      const { name, category, price, stock, description } = parsed.data;
      const sku = `PRD-${Date.now().toString().slice(-6)}`;
      
      let imageUrl = null;
      if (req.file) {
        imageUrl = await uploadToCloudinary(req.file.buffer, 'ikobana/products');
      }

      const newProduct = await prisma.product.create({
        data: { name, category, price, stock, description, sku, imageUrl },
      });

      if (newProduct.stock < 5) {
        await notifyAdmins(
          'Peringatan Stok Menipis',
          `Stok produk "${newProduct.name}" tersisa ${newProduct.stock} unit. Segera lakukan restock!`,
          'Stok Produk',
          newProduct.id
        );
      }

      return successResponse(res, newProduct, 'Produk berhasil ditambahkan', 201);
    } catch (error: any) {
      console.error('❌ ERROR TAMBAH PRODUK:', error.message);
      return errorResponse(res, error.message || 'Gagal menambah produk', 500);
    }
  }
);

// ✅ PERBAIKAN MUTLAK: Pindahkan bulk-update-stock KE ATAS /:id
productRouter.put('/bulk-update-stock', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) return errorResponse(res, 'Format tidak valid', 400);

    for (const u of updates) {
      // Konversi ke angka untuk memastikan tidak error saat masuk ke database
      const newStock = Number(u.newStock); 
      if (isNaN(newStock)) continue;

      const updatedProduct = await prisma.product.update({ 
        where: { id: u.id }, 
        data: { stock: newStock } 
      });
      
      if (updatedProduct.stock < 5) {
        await notifyAdmins(
          'Peringatan Stok Menipis',
          `Stok produk "${updatedProduct.name}" tersisa ${updatedProduct.stock} unit. Segera lakukan restock!`,
          'Stok Produk',
          updatedProduct.id
        );
      }
    }
    return successResponse(res, null, 'Stok berhasil diperbarui');
  } catch (error: any) {
    console.error('❌ ERROR BULK UPDATE STOK:', error.message); // Tampilkan error asli di terminal
    return errorResponse(res, 'Gagal update stok', 500);
  }
});

// ✅ Route /:id aman di bawah bulk-update-stock
productRouter.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, category, price, stock, description } = req.body;

      const updateData: any = { name, category, price: Number(price), stock: Number(stock), description };

      if (req.file) {
        updateData.imageUrl = await uploadToCloudinary(req.file.buffer, 'ikobana/products');
      }

      const updated = await prisma.product.update({ where: { id }, data: updateData });

      if (updated.stock < 5) {
        await notifyAdmins(
          'Peringatan Stok Menipis',
          `Stok produk "${updated.name}" tersisa ${updated.stock} unit. Segera lakukan restock!`,
          'Stok Produk',
          updated.id
        );
      }

      return successResponse(res, updated, 'Produk berhasil diperbarui');
    } catch (error: any) {
      console.error('❌ ERROR EDIT PRODUK:', error.message);
      return errorResponse(res, error.message || 'Gagal memperbarui produk', 500);
    }
  }
);

productRouter.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Produk berhasil dihapus');
  } catch (error) {
    return errorResponse(res, 'Gagal menghapus produk', 500);
  }
});