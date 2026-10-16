// src/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'default_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

// Validasi wajib
if (!env.jwtSecret || env.jwtSecret === 'default_secret') {
  console.warn('⚠️  JWT_SECRET belum di-set di .env');
}