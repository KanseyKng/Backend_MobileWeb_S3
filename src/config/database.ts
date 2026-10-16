// src/config/database.ts
import { PrismaClient } from '@prisma/client';

// Singleton — supaya tidak buka banyak koneksi
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Cek koneksi ke database
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Database Connected (SQLite via Prisma)');
  } catch (error) {
    console.error('❌ Database Connection Error:', error);
    process.exit(1);
  }
};