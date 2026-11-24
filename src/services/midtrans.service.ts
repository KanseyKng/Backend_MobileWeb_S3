// src/services/midtrans.service.ts
import * as MidtransNS from 'midtrans-client';

// Kompatibel untuk CommonJS maupun ESM, dan aman
// walau TypeScript tidak punya deklarasi tipe resmi.
const midtransClient: any = (MidtransNS as any)?.default ?? MidtransNS;

const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? '';
const isProduction =
  String(process.env.MIDTRANS_IS_PRODUCTION ?? 'false').toLowerCase() === 'true';

// ---------- Peringatan konfigurasi (muncul saat server start) ----------
if (!serverKey) {
  console.warn('⚠️ MIDTRANS_SERVER_KEY kosong — Snap tidak bisa membuat transaksi.');
} else if (!isProduction && !serverKey.startsWith('SB-')) {
  console.warn(
    '⚠️ MIDTRANS_SERVER_KEY bukan format Sandbox (SB-...). Cek MIDTRANS_IS_PRODUCTION di .env'
  );
} else if (isProduction && serverKey.startsWith('SB-')) {
  console.warn(
    '⚠️ MIDTRANS_IS_PRODUCTION=true tapi key masih Sandbox (SB-...). Transaksi akan gagal.'
  );
}

if (!clientKey) {
  console.warn('⚠️ MIDTRANS_CLIENT_KEY kosong.');
}

// ---------- Client ----------
export const snap = new midtransClient.Snap({
  isProduction,
  serverKey,
  clientKey,
});

// Dipakai kalau nanti butuh cek status langsung ke Midtrans
export const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey,
  clientKey,
});

export const midtransConfig = { isProduction, hasServerKey: !!serverKey };