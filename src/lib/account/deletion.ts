import 'server-only';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface AccountDeletionResult {
  success: boolean;
  status: 'ok' | 'conflict' | 'error';
  error?: string;
  statusCode?: number;
}

export function maskEmail(email?: string): string {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name.slice(0, 1)}***`;
  return `${maskedName}@${domain}`;
}

/**
 * Commits Firestore operations in batches of max 400 to respect Firestore limits.
 */
async function commitBatchedWrites(operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();
    for (const op of chunk) {
      op(batch);
    }
    await batch.commit();
  }
}

/**
 * Executes full account deletion workflow according to GERKINK data retention policy.
 */
export async function executeAccountDeletion(uid: string): Promise<AccountDeletionResult> {
  try {
    // 1. Resolve User profile for context (email, referralCode, etc.)
    const userDocRef = adminDb.collection('users').doc(uid);
    const userSnap = await userDocRef.get();
    const userData = userSnap.data() || {};
    const userEmail = (userData.email || '').trim().toLowerCase();

    // 2. Check for unresolved pending payouts -> STRICT CONFLICT GUARD (HTTP 409)
    const pendingPayoutsSnap = await adminDb
      .collection('payout_requests')
      .where('userId', '==', uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingPayoutsSnap.empty) {
      return {
        success: false,
        status: 'conflict',
        statusCode: 409,
        error: 'Cannot delete account while an affiliate payout request is currently pending review. Please wait for the payout to be processed or contact support.',
      };
    }

    // 3. Storage Cleanup: Delete only user-owned prefixes
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (bucketName) {
      try {
        const bucket = adminStorage.bucket(bucketName);

        // Delete user avatars: users/${uid}/
        await bucket.deleteFiles({ prefix: `users/${uid}/`, force: true }).catch((e: any) => {
          console.warn('[AccountDeletion] users storage prefix cleanup non-fatal:', e?.message || e);
        });

        // Delete atelier uploads: custom-design/${uid}/
        await bucket.deleteFiles({ prefix: `custom-design/${uid}/`, force: true }).catch((e: any) => {
          console.warn('[AccountDeletion] custom-design storage prefix cleanup non-fatal:', e?.message || e);
        });
      } catch (storageErr: any) {
        console.warn('[AccountDeletion] Storage bucket deletion non-fatal warning:', storageErr?.message || storageErr);
      }
    }

    // 4. Gather Firestore operations across all user-related collections
    const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

    // 4.1 Delete secure payout details subcollection
    const securePayoutRef = userDocRef.collection('secure_payout_details').doc('payout');
    operations.push((batch) => batch.delete(securePayoutRef));

    // 4.1b Delete user favorites subcollection
    const favoritesSnap = await userDocRef.collection('favorites').get();
    favoritesSnap.forEach((doc) => {
      operations.push((batch) => batch.delete(doc.ref));
    });

    // 4.2 Delete main user document
    operations.push((batch) => batch.delete(userDocRef));

    // 4.3 Delete user-owned coupons
    const userCouponsSnap = await adminDb.collection('coupons').where('userId', '==', uid).get();
    userCouponsSnap.forEach((doc) => {
      operations.push((batch) => batch.delete(doc.ref));
    });

    // 4.4 Milestones: Delete or mark deleted
    const milestonesSnap = await adminDb.collection('milestones').where('affiliateUid', '==', uid).get();
    milestonesSnap.forEach((doc) => {
      operations.push((batch) => batch.delete(doc.ref));
    });

    // 4.5 Anonymize Reviews: Retain ratings and aggregate sentiment without personal identity
    const reviewsSnap = await adminDb.collection('reviews').where('userId', '==', uid).get();
    reviewsSnap.forEach((doc) => {
      operations.push((batch) =>
        batch.update(doc.ref, {
          userId: 'deleted_account',
          userName: 'Former Customer',
          userEmailMasked: null,
          accountDeleted: true,
          updatedAt: FieldValue.serverTimestamp(),
        })
      );
    });

    // 4.6 Referrals: Anonymize and mark ineligible for future claims
    const referralsSnap = await adminDb.collection('referrals').where('affiliateUid', '==', uid).get();
    referralsSnap.forEach((doc) => {
      const rData = doc.data();
      const updatePayload: Record<string, any> = {
        accountDeleted: true,
        anonymizedAt: FieldValue.serverTimestamp(),
      };
      if (rData.status === 'eligible_for_claim') {
        updatePayload.status = 'ineligible_account_deleted';
      }
      operations.push((batch) => batch.update(doc.ref, updatePayload));
    });

    // 4.7 Orders & Financial Records: RETAIN FOR AUDIT, remove direct account association
    const ordersSnap = await adminDb.collection('orders').where('userId', '==', uid).get();
    ordersSnap.forEach((doc) => {
      const oData = doc.data();
      const masked = maskEmail(oData.userEmail || userEmail);
      operations.push((batch) =>
        batch.update(doc.ref, {
          accountDeleted: true,
          accountDeletedAt: FieldValue.serverTimestamp(),
          userEmailMasked: masked,
        })
      );
    });

    // 4.8 Custom Design Requests: Retain manufacturing and financial ledger, redact personal email
    const customDesignsSnap = await adminDb.collection('customDesignRequests').where('userId', '==', uid).get();
    customDesignsSnap.forEach((doc) => {
      const cdData = doc.data();
      const masked = maskEmail(cdData.customerEmail || userEmail);
      operations.push((batch) =>
        batch.update(doc.ref, {
          accountDeleted: true,
          customerEmail: '[REDACTED_ACCOUNT_DELETED]',
          customerName: '[REDACTED_ACCOUNT_DELETED]',
          customerEmailMasked: masked,
          updatedAt: FieldValue.serverTimestamp(),
        })
      );
    });

    // 4.9 Processed Payout Requests: Retain accounting audit log, redact sensitive banking data
    const payoutsSnap = await adminDb.collection('payout_requests').where('userId', '==', uid).get();
    payoutsSnap.forEach((doc) => {
      const pData = doc.data();
      const masked = maskEmail(pData.userEmail || userEmail);
      operations.push((batch) =>
        batch.update(doc.ref, {
          accountDeleted: true,
          accountDetails: '[REDACTED_ACCOUNT_DELETED]',
          userEmailMasked: masked,
          updatedAt: FieldValue.serverTimestamp(),
        })
      );
    });

    // 4.10 System Emails: Retain dispatch logs, mask recipient email
    if (userEmail) {
      const emailsSnap = await adminDb.collection('system_emails').where('to', '==', userEmail).get();
      emailsSnap.forEach((doc) => {
        operations.push((batch) =>
          batch.update(doc.ref, {
            accountDeleted: true,
            to: maskEmail(userEmail),
          })
        );
      });
    }

    // 5. Commit all database updates
    await commitBatchedWrites(operations);

    // 6. Revoke refresh tokens and delete Firebase Auth user account
    await adminAuth.revokeRefreshTokens(uid).catch((authErr: any) => {
      console.warn('[AccountDeletion] revokeRefreshTokens non-fatal:', authErr?.message || authErr);
    });

    await adminAuth.deleteUser(uid).catch((authErr: any) => {
      console.warn('[AccountDeletion] deleteUser non-fatal:', authErr?.message || authErr);
    });

    // 7. Non-PII Audit Logging
    console.log(`[AUDIT] Account deletion completed successfully for user ${uid.slice(0, 6)}***`);

    return {
      success: true,
      status: 'ok',
    };
  } catch (err: any) {
    console.error('[AccountDeletion] Fatal error during deletion workflow:', err);
    return {
      success: false,
      status: 'error',
      statusCode: 500,
      error: 'Failed to delete account. Please try again or contact support.',
    };
  }
}
