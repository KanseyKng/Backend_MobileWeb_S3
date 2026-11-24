// src/utils/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';
import path from 'path';

// Paksa baca .env dari root folder backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Validasi Kredensial
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ FATAL ERROR: Kredensial Cloudinary tidak ditemukan di .env!');
  console.error('Pastikan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET sudah diisi.');
  process.exit(1); // Hentikan server jika kredensial tidak ada
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder: string = 'ikobana'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary Upload Error:', error);
          return reject(new Error(`Gagal upload ke Cloudinary: ${error.message}`));
        }
        if (result && result.secure_url) {
          console.log(`✅ Cloudinary Upload Success [${folder}]:`, result.secure_url);
          resolve(result.secure_url);
        } else {
          reject(new Error('Cloudinary tidak mengembalikan URL yang valid.'));
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};