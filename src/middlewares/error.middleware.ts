// src/middlewares/error.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Handler error global
 */
export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('❌ Error:', err.message);

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[])?.join(', ') || 'field';
      return res.status(400).json({
        success: false,
        message: `${fields} sudah terdaftar`,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Data tidak ditemukan',
      });
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid',
    });
  }

  // Default
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server',
  });
};

/**
 * Handler 404 Not Found
 */
export const notFoundMiddleware = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} tidak ditemukan`,
  });
};