import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import type { PayoutMethodPreferences } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/user/payout-profile
 * Get the saved payout preference profile for the affiliate.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch payoutPreferences from the secure subcollection
    const securePayoutDoc = await adminDb
      .collection('users')
      .doc(uid)
      .collection('secure_payout_details')
      .doc('payout')
      .get();

    const secureData = securePayoutDoc.exists ? securePayoutDoc.data() : null;
    const prefs = secureData?.payoutPreferences as PayoutMethodPreferences | undefined;

    if (!prefs) {
      return NextResponse.json({ payoutPreferences: null });
    }

    // Decrypt bank details if method is bank
    if (prefs.method === 'bank' && prefs.bankDetails) {
      const decrypted = {
        method: 'bank' as const,
        bankDetails: {
          accountHolderName: prefs.bankDetails.accountHolderName,
          routingNumber: decrypt(prefs.bankDetails.routingNumber),
          accountNumber: decrypt(prefs.bankDetails.accountNumber),
          accountType: prefs.bankDetails.accountType,
          email: prefs.bankDetails.email || '',
          country: prefs.bankDetails.country,
          city: prefs.bankDetails.city,
          streetAddress: prefs.bankDetails.streetAddress,
          state: prefs.bankDetails.state,
          zipCode: prefs.bankDetails.zipCode,
        }
      };
      return NextResponse.json({ payoutPreferences: decrypted });
    }

    return NextResponse.json({ payoutPreferences: prefs });
  } catch (err: any) {
    console.error('Error fetching payout preferences:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/user/payout-profile
 * Save or update the affiliate's preferred payout method.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { method, email, bankDetails } = body;

    if (!['wise', 'paypal', 'bank'].includes(method)) {
      return NextResponse.json({ error: 'Invalid payout method selected' }, { status: 400 });
    }

    let updatedPreferences: PayoutMethodPreferences;

    if (method === 'wise' || method === 'paypal') {
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
      }
      updatedPreferences = { method, email };
    } else {
      // bank transfer details validation
      if (!bankDetails) {
        return NextResponse.json({ error: 'Bank details are required' }, { status: 400 });
      }
      const {
        accountHolderName,
        routingNumber,
        accountNumber,
        accountType,
        email: bankEmail,
        country,
        city,
        streetAddress,
        state,
        zipCode
      } = bankDetails;

      if (!accountHolderName || !routingNumber || !accountNumber || !accountType || !country || !city || !streetAddress || !state || !zipCode) {
        return NextResponse.json({ error: 'All bank details and address fields are required' }, { status: 400 });
      }

      if (!['checking', 'savings'].includes(accountType)) {
        return NextResponse.json({ error: 'Invalid account type selected' }, { status: 400 });
      }

      if (accountNumber.length < 4 || accountNumber.length > 25) {
        return NextResponse.json({ error: 'Invalid account number length' }, { status: 400 });
      }

      if (routingNumber.length < 4 || routingNumber.length > 20) {
        return NextResponse.json({ error: 'Invalid routing number length' }, { status: 400 });
      }

      // Encrypt bank values before writing to DB
      updatedPreferences = {
        method: 'bank',
        bankDetails: {
          accountHolderName,
          routingNumber: encrypt(routingNumber),
          accountNumber: encrypt(accountNumber),
          accountType,
          email: bankEmail || '',
          country,
          city,
          streetAddress,
          state,
          zipCode
        }
      };
    }

    const batch = adminDb.batch();
    const userRef = adminDb.collection('users').doc(uid);
    const secureRef = userRef.collection('secure_payout_details').doc('payout');

    batch.set(
      secureRef,
      {
        payoutPreferences: updatedPreferences,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Delete legacy field from main users document if it exists
    batch.update(userRef, {
      payoutPreferences: FieldValue.delete(),
    });

    await batch.commit();

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error saving payout preferences:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
