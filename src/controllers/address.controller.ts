// src/controllers/address.controller.ts
import type { Response } from 'express';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import type { AuthRequest } from '../middlewares/auth.middleware';

// 1. GET /api/addresses
export const getAddresses = async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user?.userId },
      orderBy: { isPrimary: 'desc' },
    });
    return successResponse(res, addresses, 'Berhasil ambil alamat');
  } catch (error) {
    return errorResponse(res, 'Gagal ambil alamat', 500);
  }
};

// 2. POST /api/addresses
export const createAddress = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body;

    // Cek limit maksimal 3 alamat
    const count = await prisma.address.count({ where: { userId: req.user?.userId } });
    if (count >= 3) return errorResponse(res, 'Maksimal 3 alamat per user', 400);

    // Jika isPrimary true, matikan isPrimary alamat lain
    if (body.isPrimary) {
      await prisma.address.updateMany({
        where: { userId: req.user?.userId },
        data: { isPrimary: false },
      });
    } else if (count === 0) {
      // Jika ini alamat pertama, otomatis jadi primary
      body.isPrimary = true;
    }

    const newAddress = await prisma.address.create({
      data: {
        userId: req.user!.userId,
        label: body.label,
        recipientName: body.recipientName,
        phoneNumber: body.phoneNumber,
        street: body.street,
        village: body.village,
        district: body.district,
        city: body.city,
        province: body.province,
        postalCode: body.postalCode,
        latitude: body.latitude,
        longitude: body.longitude,
        isPrimary: body.isPrimary,
      },
    });

    return successResponse(res, newAddress, 'Alamat berhasil ditambahkan', 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Gagal menambah alamat', 500);
  }
};

// 3. PUT /api/addresses/:id
export const updateAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.isPrimary) {
      await prisma.address.updateMany({
        where: { userId: req.user?.userId },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id },
      data: {
        label: body.label,
        recipientName: body.recipientName,
        phoneNumber: body.phoneNumber,
        street: body.street,
        village: body.village,
        district: body.district,
        city: body.city,
        province: body.province,
        postalCode: body.postalCode,
        latitude: body.latitude,
        longitude: body.longitude,
        isPrimary: body.isPrimary,
      },
    });

    return successResponse(res, updated, 'Alamat berhasil diperbarui');
  } catch (error) {
    return errorResponse(res, 'Gagal update alamat', 500);
  }
};

// 4. DELETE /api/addresses/:id
export const deleteAddress = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.address.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Alamat berhasil dihapus');
  } catch (error) {
    return errorResponse(res, 'Gagal hapus alamat', 500);
  }
};