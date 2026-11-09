// src/config/app.config.ts
import dotenv from 'dotenv';
import path from 'path';

// Load file .env dari root folder backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const APP_CONFIG: {
  PORT: number; // ✅ PASTIKAN TIPENYA NUMBER SAJA
  BASE_URL: string;
  JWT_SECRET: string;
} = {
  // ✅ Konversi ke Number agar app.listen tidak error
  PORT: process.env.PORT ? Number(process.env.PORT) : 5000,
  BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
  JWT_SECRET: process.env.JWT_SECRET || 'rahasia_default',
};