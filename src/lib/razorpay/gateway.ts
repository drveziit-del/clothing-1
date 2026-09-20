import 'server-only';
import type { PaymentGateway } from '@/lib/payment/types';
import { createRazorpayOrder } from './client';
import crypto from 'crypto';

export class RazorpayGateway implements PaymentGateway {
  async createOrder(
    amountUSD: number,
    receiptId: string
  ): Promise<{ id: string; amount: number; currency: string }> {
    return createRazorpayOrder(amountUSD, receiptId);
  }

  async captureOrder(
    orderId: string
  ): Promise<{ captureId: string; status: string }> {
    // Razorpay orders are captured automatically on checkout completion or via webhook
    return { captureId: orderId, status: 'captured' };
  }

  async verifyWebhook(request: Request): Promise<{ valid: boolean; event?: any }> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[RazorpayGateway] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook.');
      return { valid: false };
    }

    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) return { valid: false };

    const rawBody = await request.text();
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);

    if (expectedBuf.length !== signatureBuf.length) return { valid: false };

    let valid = false;
    try {
      valid = crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return { valid: false };
    }

    try {
      return { valid, event: JSON.parse(rawBody) };
    } catch {
      return { valid: false };
    }
  }
}

export const razorpayGateway = new RazorpayGateway();
