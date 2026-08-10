import { Timestamp } from 'firebase-admin/firestore';

export interface PaymentGateway {
  createOrder(
    amountUSD: number,
    receiptId: string
  ): Promise<{ id: string; amount: number; currency: string }>;

  captureOrder(
    orderId: string
  ): Promise<{ captureId: string; status: string }>;

  verifyWebhook(
    request: Request
  ): Promise<{ valid: boolean; event?: any }>;
}

export interface OrderJob {
  id: string;
  orderId: string;
  event: 'OrderPaid';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'manual_review';
  attemptCount: number;
  lastError?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface OrderHistoryEvent {
  timestamp: Date | string;
  event: string;
  actor: 'system' | 'customer' | 'admin';
  metadata?: Record<string, unknown>;
}
