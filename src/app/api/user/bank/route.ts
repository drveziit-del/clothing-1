import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/user/bank
 * Retrieve the saved bank details for the logged-in user (decrypted).
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
    const securePayoutDoc = await adminDb
      .collection('users')
      .doc(uid)
      .collection('secure_payout_details')
      .doc('payout')
      .get();

    const bankDetails = securePayoutDoc.exists ? securePayoutDoc.data()?.bankDetails : null;

    if (!bankDetails) {
      return NextResponse.json({ bankDetails: null });
    }

    // Decrypt details before sending to client
    const decrypted = {
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      accountNumber: decrypt(bankDetails.accountNumber),
      ifscCode: decrypt(bankDetails.ifscCode),
    };

    return NextResponse.json({ bankDetails: decrypted });
  } catch (err: any) {
    console.error('Error fetching bank details:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/user/bank
 * Save the user's bank details (encrypt accountNumber and ifscCode before storing).
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
    const { accountHolderName, accountNumber, ifscCode, bankName } = body;

    // Basic Validation
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (accountNumber.length < 5 || accountNumber.length > 25) {
      return NextResponse.json({ error: 'Invalid account number length' }, { status: 400 });
    }

    if (ifscCode.length < 5 || ifscCode.length > 15) {
      return NextResponse.json({ error: 'Invalid IFSC/Routing code' }, { status: 400 });
    }

    // Encrypt sensitive fields
    const encryptedBankDetails = {
      accountHolderName,
      bankName,
      accountNumber: encrypt(accountNumber),
      ifscCode: encrypt(ifscCode),
    };

    const batch = adminDb.batch();
    const userRef = adminDb.collection('users').doc(uid);
    const secureRef = userRef.collection('secure_payout_details').doc('payout');

    batch.set(
      secureRef,
      {
        bankDetails: encryptedBankDetails,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Delete legacy field from main users document if it exists
    batch.update(userRef, {
      bankDetails: FieldValue.delete(),
    });

    await batch.commit();

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error saving bank details:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
