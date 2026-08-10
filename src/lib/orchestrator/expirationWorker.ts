import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { appendOrderHistory } from './orderProcessor';

/**
 * Sweeps expired 'pending' orders older than 30 minutes, restores reserved product stock, and sets order status to 'expired'.
 */
export async function releaseExpiredPendingOrders(): Promise<{ releasedCount: number }> {
  const now = new Date();
  let releasedCount = 0;

  try {
    const expiredQuery = await adminDb
      .collection('orders')
      .where('status', '==', 'pending')
      .where('expiresAt', '<=', now)
      .get();

    for (const doc of expiredQuery.docs) {
      const orderId = doc.id;
      const data = doc.data();

      try {
        await adminDb.runTransaction(async (transaction) => {
          const freshDoc = await transaction.get(doc.ref);
          if (!freshDoc.exists || freshDoc.data()?.status !== 'pending') return;

          // Restore product variant stock
          const items = freshDoc.data()?.items || [];
          for (const item of items) {
            if (item.productId) {
              const productRef = adminDb.collection('products').doc(item.productId);
              const prodSnap = await transaction.get(productRef);
              if (prodSnap.exists) {
                const prodData = prodSnap.data()!;
                const variants = (prodData.variants || []).map((v: any) => {
                  if (v.id === item.variant?.id) {
                    return { ...v, stock: (v.stock || 0) + item.quantity };
                  }
                  return v;
                });
                transaction.update(productRef, { variants, updatedAt: FieldValue.serverTimestamp() });
              }
            }
          }

          transaction.update(doc.ref, {
            status:    'expired',
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        await appendOrderHistory(orderId, 'order_expired_stock_released', 'system');
        releasedCount++;
      } catch (orderErr) {
        console.error(`[expirationWorker] Failed releasing stock for order ${orderId}:`, orderErr);
      }
    }
  } catch (err) {
    console.error('[expirationWorker] Query error during stock expiration sweep:', err);
  }

  return { releasedCount };
}
