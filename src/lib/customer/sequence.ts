import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const CAMPAIGN_MAX_CUSTOMERS = 500;

export interface CustomerAllocationResult {
  customerNumber: number;
  isFounding500: boolean;
}

/**
 * Atomically allocates the next sequential customer number for a paid order.
 * Strictly guarantees concurrency safety through a Firestore ACID transaction.
 * Idempotent: If the order already has a customer number, returns the existing number.
 */
export async function allocateCustomerNumber(orderId: string): Promise<CustomerAllocationResult | null> {
  if (!orderId || typeof orderId !== 'string') return null;

  const orderRef = adminDb.collection('orders').doc(orderId);
  const campaignRef = adminDb.collection('settings').doc('campaign');

  try {
    return await adminDb.runTransaction(async (transaction) => {
      // ── 1. ALL READS FIRST ─────────────────────────────────────────────────
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) return null;

      const orderData = orderDoc.data()!;

      // Idempotency: Return existing allocation if already stamped
      if (typeof orderData.customerNumber === 'number') {
        const isFounding500 = orderData.isFounding500 ?? (orderData.customerNumber <= CAMPAIGN_MAX_CUSTOMERS);
        return { customerNumber: orderData.customerNumber, isFounding500 };
      }

      if (orderData.simulateAllocError) {
        throw new Error('SIMULATED_ALLOCATION_TRANSACTION_FAILURE');
      }

      // Check user doc if registered
      const isRegisteredUser = typeof orderData.userId === 'string' && !orderData.userId.startsWith('guest_');
      const userRef = isRegisteredUser ? adminDb.collection('users').doc(orderData.userId) : null;
      const userDoc = userRef ? await transaction.get(userRef) : null;

      const campaignDoc = await transaction.get(campaignRef);

      // Calculations
      const currentSequence = campaignDoc.data()?.currentCustomerNumber ?? 0;
      const nextSequence = currentSequence + 1;
      const isFounding500 = nextSequence <= CAMPAIGN_MAX_CUSTOMERS;

      // ── 2. ALL WRITES AFTER READS ──────────────────────────────────────────
      // Update campaign sequence counter
      transaction.set(
        campaignRef,
        {
          currentCustomerNumber: nextSequence,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Stamp customer number onto order (and clear any previous failure flag)
      transaction.update(orderRef, {
        customerNumber: nextSequence,
        isFounding500,
        customerNumberAllocFailed: false,
        customerNumberAllocError: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // If registered user, also stamp on user profile
      if (userRef && userDoc && userDoc.exists) {
        transaction.set(
          userRef,
          {
            customerNumber: nextSequence,
            isFounding500,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return { customerNumber: nextSequence, isFounding500 };
    });
  } catch (err: any) {
    console.error(`[allocateCustomerNumber] Transaction failed for order ${orderId}:`, err);
    try {
      await orderRef.set(
        {
          customerNumberAllocFailed: true,
          customerNumberAllocError: err?.message || 'Customer number allocation transaction failed',
          customerNumberAllocAttemptedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (persistErr) {
      console.error(`[allocateCustomerNumber] Failed to persist failure state for order ${orderId}:`, persistErr);
    }
    return null;
  }
}
