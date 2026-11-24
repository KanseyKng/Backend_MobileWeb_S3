// src/scripts/test-webhook.ts
import 'dotenv/config';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../config/database';

/**
 * Simulasi webhook Midtrans dengan signature valid.
 *
 * Pakai:
 *   npm run test:webhook                          -> buat transaksi dummy + settlement
 *   npm run test:webhook -- TRX-123               -> pakai orderId yang sudah ada
 *   npm run test:webhook -- TRX-123 expire        -> tes status expire/dibatalkan
 *   npm run test:webhook -- --fresh               -> paksa buat transaksi baru
 *
 * Status yang didukung: settlement | pending | expire | deny | cancel
 */

const STATUS_CODES: Record<string, string> = {
  settlement: '200',
  capture: '200',
  pending: '201',
  deny: '202',
  cancel: '202',
  expire: '407',
};

async function main() {
  const args = process.argv.slice(2).filter((a) => a.trim() !== '');
  const forceFresh = args.includes('--fresh');
  const positional = args.filter((a) => !a.startsWith('--'));

  let orderId: string | undefined = positional[0];
  let transactionStatus = positional[1] || 'settlement';

  if (!STATUS_CODES[transactionStatus]) {
    console.log(`❌ Status "${transactionStatus}" tidak dikenal.`);
    console.log('   Pilihan: settlement | pending | expire | deny | cancel');
    process.exit(1);
  }

  const webhookUrl =
    process.env.WEBHOOK_TEST_URL ||
    'http://localhost:5000/api/transactions/webhook';

  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  if (!serverKey) {
    console.log('❌ MIDTRANS_SERVER_KEY kosong di .env');
    process.exit(1);
  }

  // ==========================================================
  // 1. TENTUKAN TRANSAKSI
  // ==========================================================
  let trx = null;

  if (orderId && !forceFresh) {
    trx = await prisma.transaction.findUnique({ where: { orderId } });
    if (!trx) {
      console.log(`⚠️  orderId "${orderId}" tidak ada di database.`);
      console.log('   Script akan membuat transaksi dummy baru...');
    }
  }

  if (!trx) {
    // Cari user untuk dijadikan pemilik transaksi dummy
    let user = await prisma.user.findFirst({ where: { role: 'USER' } });
    if (!user) {
      user = await prisma.user.findFirst();
    }
    if (!user) {
      console.log('❌ Tidak ada user di database.');
      console.log('   Jalankan seed / daftar user dulu: npm run seed');
      process.exit(1);
    }

    orderId = `TRX-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    trx = await prisma.transaction.create({
      data: {
        orderId,
        userId: user.id,
        customerName: user.name,
        customerPhone: user.phone,
        customerAddress: 'Alamat testing webhook lokal',
        items: JSON.stringify([
          { id: 'P1-1', name: 'Produk Testing', price: 25000, qty: 1 },
        ]),
        totalPrice: 25000,
        paymentMethod: 'MIDTRANS',
        status: 'Menunggu Pembayaran',
      },
    });

    console.log(`✅ Transaksi dummy dibuat untuk user: ${user.name}`);
    console.log(`   orderId: ${orderId}`);
  }

  console.log('\n📦 SEBELUM:', {
    orderId: trx.orderId,
    status: trx.status,
    totalPrice: trx.totalPrice,
    paymentType: trx.paymentType,
  });

  // ==========================================================
  // 2. BANGUN PAYLOAD + SIGNATURE
  // ==========================================================
  const statusCode = STATUS_CODES[transactionStatus];
  const grossAmount = `${trx.totalPrice}.00`;
  const transactionId = `SIM-${trx.id}`;

  const signatureKey = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');

  const payload = {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey,
    transaction_status:
      transactionStatus === 'capture' ? 'capture' : transactionStatus,
    fraud_status: 'accept',
    payment_type: 'qris',
    transaction_id: transactionId,
    status_message: 'midtrans payment notification (simulasi lokal)',
    transaction_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };

  // ==========================================================
  // 3. KIRIM KE BACKEND
  // ==========================================================
  console.log(`\n📤 POST ${webhookUrl}`);
  console.log(`   order_id : ${orderId}`);
  console.log(`   status   : ${transactionStatus} (status_code ${statusCode})`);
  console.log(`   amount   : ${grossAmount}`);

  let httpStatus = 0;
  let responseData: any = null;

  try {
    const res = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });
    httpStatus = res.status;
    responseData = res.data;
    console.log(`\n✅ HTTP ${res.status}`);
    console.log('   Response:', responseData);
  } catch (e: any) {
    console.log('\n❌ GAGAL KIRIM:', e?.message);
    if (e?.code === 'ECONNREFUSED') {
      console.log('   → Backend tidak jalan. Jalankan: npm run dev');
    }
    process.exit(1);
  }

  // ==========================================================
  // 4. VERIFIKASI HASIL DI DATABASE
  // ==========================================================
  const after = await prisma.transaction.findUnique({ where: { orderId } });
  console.log('\n📦 SESUDAH:', {
    status: after?.status,
    paymentType: after?.paymentType,
    transactionId: after?.transactionId,
  });

  const expected: Record<string, string> = {
    settlement: 'Diproses',
    capture: 'Diproses',
    pending: 'Menunggu Pembayaran',
    expire: 'Dibatalkan',
    cancel: 'Dibatalkan',
    deny: 'Dibatalkan',
  };

  console.log('\n' + '─'.repeat(52));

  if (after?.status === expected[transactionStatus]) {
    console.log(`🎉 SUKSES! Status berubah menjadi "${after.status}"`);
    console.log('   → transaction.route.ts versi baru SUDAH AKTIF.');
    console.log('   → Backend, signature, dan database 100% benar.');
    console.log('   → Lanjut ke testing dari aplikasi Flutter.');
  } else if (httpStatus === 200) {
    console.log('⚠️  HTTP 200 tapi status TIDAK berubah.');
    console.log(`   Diharapkan: "${expected[transactionStatus]}"`);
    console.log(`   Aktual    : "${after?.status}"`);
    console.log('');
    console.log('   Kemungkinan penyebab:');
    console.log('   1. transaction.route.ts versi LAMA masih jalan');
    console.log('   2. Ada route webhook duplikat di src/routes/index.ts');
    console.log('   3. Server belum di-restart setelah file ditimpa');
    console.log('   → Kirim isi src/routes/index.ts ke saya.');
  } else if (httpStatus === 403) {
    console.log('❌ 403 Invalid signature.');
    console.log('   → MIDTRANS_SERVER_KEY di .env beda dengan yang dipakai server.');
    console.log('   → Restart backend: Ctrl+C lalu npm run dev');
  } else if (httpStatus === 404) {
    console.log('❌ 404 Route tidak ditemukan.');
    console.log('   → Path webhook berbeda. Kirim src/routes/index.ts ke saya.');
  } else {
    console.log(`❌ Gagal. HTTP ${httpStatus}`);
    console.log('   → Cek log di terminal backend.');
  }

  console.log('─'.repeat(52));
  console.log('\n💡 Jalankan perintah yang sama sekali lagi untuk uji idempotency.');
  console.log('   Harus muncul: ↩️ Webhook duplikat, diabaikan');
}

main()
  .catch((e) => {
    console.error('❌ Error tak terduga:', e?.response?.data ?? e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });