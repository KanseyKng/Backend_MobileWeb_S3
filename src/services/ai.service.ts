// src/services/ai.service.ts
import axios from 'axios';
import axiosRetry from 'axios-retry'; // ✅ Import library retry
import { prisma } from '../config/database';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// ✅ Konfigurasi Retry: Coba 3x dengan jeda meningkat jika error 503
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  // ✅ Tambahkan ': any' agar TypeScript tidak error
  retryCondition: (error: any) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status && error.response.status >= 500);
  },
});

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

async function getProductContext(): Promise<string> {
  try {
    const products = await prisma.product.findMany({
      select: { name: true, category: true, price: true, stock: true, description: true },
      take: 20,
    });

    if (products.length === 0) return 'Belum ada produk di database.';

    const productList = products.map(p => 
      `- ${p.name} (Kategori: ${p.category}, Harga: Rp ${p.price.toLocaleString('id-ID')}, Stok: ${p.stock})`
    ).join('\n');

    return `Berikut adalah daftar produk yang tersedia di toko:\n${productList}`;
  } catch (error) {
    return 'Gagal mengambil data produk.';
  }
}

export async function getAIResponse(userMessage: string, history: ChatMessage[] = []): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY tidak ditemukan di .env');
    }

    const productContext = await getProductContext();

    const systemInstructionText = `Kamu adalah "Ikobana Assistant", asisten virtual ramah dari toko frozen food "Ikobana Frozen Food". 
Tugasmu:
1. Menjawab FAQ (jam operasional, cara pembayaran, pengiriman).
2. Memberikan tips penyimpanan dan cara memasak frozen food.
3. Merekomendasikan produk berdasarkan preferensi pelanggan.

ATURAN:
- Jawab dengan sopan, ramah, dan bahasa Indonesia santai.
- Gunakan daftar produk di bawah ini untuk merekomendasikan. JANGAN mengarang produk.
- Tolak dengan sopan jika ditanya di luar topik frozen food.
- Jika pelanggan ingin memesan, arahkan ke menu "Keranjang".

${productContext}`;

    const input = history.map(h => ({
      type: 'text',
      text: h.parts[0].text,
    }));
    input.push({ type: 'text', text: userMessage });

    const requestBody = {
      model: 'gemini-3.5-flash-lite',
      input: input,
      system_instruction: systemInstructionText,
      generation_config: {
        temperature: 0.7,
        max_output_tokens: 500,
      },
    };

    const response = await axios.post(GEMINI_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, 
      },
    });

    let aiText = response.data?.output_text;

    if (!aiText && Array.isArray(response.data?.steps)) {
      const modelOutputStep = response.data.steps.find(
        (step: any) => step.type === 'model_output' && Array.isArray(step.content)
      );
      if (modelOutputStep) {
        aiText = modelOutputStep.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
      }
    }
    
    if (!aiText) {
      console.error('Struktur respons tidak dikenal:', JSON.stringify(response.data, null, 2));
      throw new Error('AI tidak memberikan respons yang valid.');
    }

    return aiText;
  } catch (error: any) {
    console.error('❌ ERROR AI SERVICE:', error.response?.data || error.message);
    return 'Maaf, asisten sedang sibuk. Silakan coba lagi beberapa saat lagi atau hubungi admin via WhatsApp.';
  }
}