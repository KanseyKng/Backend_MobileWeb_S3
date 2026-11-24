// src/routes/chatbot.route.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAIResponse } from '../services/ai.service';
import { successResponse, errorResponse } from '../utils/response';

export const chatbotRouter = Router();

/**
 * POST /api/chat
 * Body: { message: string, history?: ChatMessage[] }
 */
chatbotRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return errorResponse(res, 'Pesan tidak boleh kosong', 400);
    }

    // Kirim ke AI Service
    const aiReply = await getAIResponse(message, history || []);

    return successResponse(res, { reply: aiReply }, 'Berhasil mendapatkan balasan AI');
  } catch (error: any) {
    console.error('❌ ERROR CHATBOT ROUTE:', error.message);
    return errorResponse(res, 'Gagal memproses pesan', 500);
  }
});