import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { paypalGateway } from '@/lib/paypal/client';
import { createRazorpayOrder } from '@/lib/razorpay/client';
import { getRateForCurrency } from '@/lib/currency/rates';
import { COUNTRIES } from '@/lib/utils/countries';
import {
  createCustomDesignSchema,
  PLAN_PRICING,
  CURRENT_POLICY_VERSION,
  type CustomDesignRequest,
} from '@/lib/custom-design/types';

export const dynamic = 'force-dynamic';

function generateHumanRequestNumber(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GK-CUS-${code}`;
}

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'custom_design_create', { limit: 20, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  // 1. Authenticated customer check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
  }

  let uid: string;
  let customerEmail = '';
  let customerName = 'GERKINK Customer';
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
    customerEmail = decoded.email || '';
    if (decoded.name) customerName = decoded.name;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Fetch user profile name fallback if available
  if (!customerName || customerName === 'GERKINK Customer') {
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const udata = userDoc.data();
        if (udata?.displayName) customerName = udata.displayName;
        if (!customerEmail && udata?.email) customerEmail = udata.email;
      }
    } catch {
      // non-fatal
    }
  }

  // 2. Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = createCustomDesignSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || 'Validation error' },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  // Upload Ownership Guard — verify every upload path belongs strictly to the authenticated user
  const expectedUploadPrefix = `custom-design/${uid}/`;
  for (const upload of data.uploads) {
    if (!upload.storagePath || !upload.storagePath.startsWith(expectedUploadPrefix)) {
      console.warn(`[custom-design/create-request] Unauthorized storage path: ${upload.storagePath} for user ${uid}`);
      return NextResponse.json(
        { error: 'Forbidden: upload paths must belong to your authenticated account' },
        { status: 403 }
      );
    }
  }

  // 3. Server-authoritative country validation & routing
  const rawCountry = (data.country || 'US').trim().toUpperCase();
  const isValidCountry = COUNTRIES.some((c) => c.code === rawCountry);
  const validatedCountry = isValidCountry ? rawCountry : 'US';
  const isIndia = validatedCountry === 'IN';

  // 4. Server-authoritative pricing (never trust browser-sent amounts)
  const planDetails = PLAN_PRICING[data.plan];
  if (!planDetails) {
    return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
  }
  const authoritativeUSD = planDetails.amount; // 15 or 20 USD

  let targetCurrency: 'USD' | 'INR' = 'USD';
  let targetAmount = authoritativeUSD;
  let targetGateway: 'paypal' | 'razorpay' = 'paypal';

  if (isIndia) {
    targetCurrency = 'INR';
    targetGateway = 'razorpay';
    let inrRate = 83.5;
    try {
      inrRate = await getRateForCurrency('INR');
    } catch (rateErr) {
      console.warn('[custom-design/create-request] Using fallback rate 83.5:', rateErr);
    }
    targetAmount = Math.round(authoritativeUSD * inrRate);
  } else {
    targetCurrency = 'USD';
    targetGateway = 'paypal';
    targetAmount = authoritativeUSD;
  }

  // 5. Idempotency & Reuse Check:
  const idempotencyKey = data.idempotencyKey || `idem_${uid}_${Date.now()}`;
  const existingDocs = await adminDb
    .collection('customDesignRequests')
    .where('userId', '==', uid)
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();

  if (!existingDocs.empty) {
    const existingDoc = existingDocs.docs[0];
    const existingData = existingDoc.data() as CustomDesignRequest;

    // If already paid or submitted, do not re-create
    if (existingData.paymentStatus === 'paid' || existingData.status === 'SUBMITTED') {
      return NextResponse.json({
        requestId: existingDoc.id,
        requestNumber: existingData.requestId,
        status: existingData.status,
        alreadyPaid: true,
      });
    }

    const now = new Date().toISOString();

    // Check if we can reuse the existing gateway order
    const sameGateway = existingData.paymentProvider === targetGateway;
    const samePlan = existingData.plan === data.plan;
    const sameCountry = (existingData.country || 'US') === validatedCountry;

    if (sameGateway && samePlan && sameCountry && existingData.status === 'PAYMENT_PENDING') {
      if (targetGateway === 'paypal' && existingData.paypalOrderId) {
        await existingDoc.ref.update({
          productType: data.productType,
          preferredSize: data.preferredSize,
          preferredColor: data.preferredColor,
          productPreference: data.productPreference,
          description: data.description,
          additionalNotes: data.additionalNotes,
          uploads: data.uploads.map((u) => ({
            fileId: u.fileId,
            originalName: u.originalName,
            mimeType: u.mimeType,
            size: u.size,
            storagePath: u.storagePath,
            uploadedAt: u.uploadedAt || now,
          })),
          updatedAt: now,
        });

        return NextResponse.json({
          requestId: existingDoc.id,
          requestNumber: existingData.requestId,
          gateway: 'paypal',
          currency: 'USD',
          amount: authoritativeUSD,
          paypalOrderId: existingData.paypalOrderId,
          status: 'PAYMENT_PENDING',
          reused: true,
        });
      }

      if (targetGateway === 'razorpay' && existingData.razorpayOrderId) {
        await existingDoc.ref.update({
          productType: data.productType,
          preferredSize: data.preferredSize,
          preferredColor: data.preferredColor,
          productPreference: data.productPreference,
          description: data.description,
          additionalNotes: data.additionalNotes,
          uploads: data.uploads.map((u) => ({
            fileId: u.fileId,
            originalName: u.originalName,
            mimeType: u.mimeType,
            size: u.size,
            storagePath: u.storagePath,
            uploadedAt: u.uploadedAt || now,
          })),
          updatedAt: now,
        });

        return NextResponse.json({
          requestId: existingDoc.id,
          requestNumber: existingData.requestId,
          gateway: 'razorpay',
          currency: 'INR',
          amount: existingData.prepaymentAmount,
          amountPaise: existingData.prepaymentAmount * 100,
          razorpayOrderId: existingData.razorpayOrderId,
          status: 'PAYMENT_PENDING',
          reused: true,
        });
      }
    }

    // Refresh order on the authoritative gateway
    try {
      let refreshedPaypalOrderId: string | undefined;
      let refreshedRazorpayOrderId: string | undefined;
      let amountPaise: number | undefined;

      if (targetGateway === 'razorpay') {
        const rzOrder = await createRazorpayOrder(authoritativeUSD, existingData.requestId, true);
        refreshedRazorpayOrderId = rzOrder.id;
        amountPaise = rzOrder.amount;
      } else {
        const ppOrder = await paypalGateway.createOrder(authoritativeUSD, existingData.requestId);
        refreshedPaypalOrderId = ppOrder.id;
      }

      await existingDoc.ref.update({
        paypalOrderId: refreshedPaypalOrderId || null,
        razorpayOrderId: refreshedRazorpayOrderId || null,
        paymentProvider: targetGateway,
        currency: targetCurrency,
        prepaymentAmount: targetAmount,
        prepaymentAmountUSD: authoritativeUSD,
        country: validatedCountry,
        paymentStatus: 'pending',
        status: 'PAYMENT_PENDING',
        plan: data.plan,
        productType: data.productType,
        preferredSize: data.preferredSize,
        preferredColor: data.preferredColor,
        productPreference: data.productPreference,
        description: data.description,
        additionalNotes: data.additionalNotes,
        uploads: data.uploads.map((u) => ({
          fileId: u.fileId,
          originalName: u.originalName,
          mimeType: u.mimeType,
          size: u.size,
          storagePath: u.storagePath,
          uploadedAt: u.uploadedAt || now,
        })),
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        requestId: existingDoc.id,
        requestNumber: existingData.requestId,
        gateway: targetGateway,
        paymentProvider: targetGateway,
        currency: targetCurrency,
        amount: targetAmount,
        amountPaise,
        amountUSD: authoritativeUSD,
        paypalOrderId: refreshedPaypalOrderId,
        razorpayOrderId: refreshedRazorpayOrderId,
        razorpayKeyId: targetGateway === 'razorpay' ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID : undefined,
        status: 'PAYMENT_PENDING',
        reused: true,
      });
    } catch (err: any) {
      console.error('[custom-design/create-request] Failed to refresh payment order:', err);
      return NextResponse.json({ error: 'Failed to initialize payment gateway' }, { status: 500 });
    }
  }

  // 6. Create new custom request document
  const requestNumber = generateHumanRequestNumber();
  const docRef = adminDb.collection('customDesignRequests').doc();
  const now = new Date().toISOString();

  let paypalOrderId: string | undefined;
  let razorpayOrderId: string | undefined;
  let amountPaise: number | undefined;

  try {
    if (targetGateway === 'razorpay') {
      const rzOrder = await createRazorpayOrder(authoritativeUSD, requestNumber, true);
      razorpayOrderId = rzOrder.id;
      amountPaise = rzOrder.amount;
    } else {
      const ppOrder = await paypalGateway.createOrder(authoritativeUSD, requestNumber);
      paypalOrderId = ppOrder.id;
    }
  } catch (err: any) {
    console.error(`[custom-design/create-request] ${targetGateway} createOrder failed:`, err);
    return NextResponse.json({ error: `Failed to initialize ${targetGateway} order` }, { status: 500 });
  }

  // 7. Store document in Firestore
  const newRequest: CustomDesignRequest = {
    id: docRef.id,
    requestId: requestNumber,
    userId: uid,
    customerEmail,
    customerName,
    productType: data.productType,
    preferredSize: data.preferredSize,
    preferredColor: data.preferredColor,
    productPreference: data.productPreference,
    description: data.description,
    additionalNotes: data.additionalNotes,
    uploads: data.uploads.map((u) => ({
      fileId: u.fileId,
      originalName: u.originalName,
      mimeType: u.mimeType,
      size: u.size,
      storagePath: u.storagePath,
      uploadedAt: u.uploadedAt || now,
    })),
    plan: data.plan,
    prepaymentAmount: targetAmount,
    prepaymentAmountUSD: authoritativeUSD,
    currency: targetCurrency,
    paymentProvider: targetGateway,
    paymentStatus: 'pending',
    paypalOrderId,
    razorpayOrderId,
    country: validatedCountry,
    idempotencyKey,
    paymentPolicyVersion: CURRENT_POLICY_VERSION,
    paymentPolicyAccepted: true,
    paymentPolicyAcceptedAt: now,
    status: 'PAYMENT_PENDING',
    statusHistory: [
      {
        from: 'DRAFT',
        to: 'PAYMENT_PENDING',
        actor: 'system',
        timestamp: now,
        reason: 'Custom design request drafted and payment initialized',
      },
    ],
    customerMessages: [],
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(newRequest);

  return NextResponse.json({
    success: true,
    requestId: docRef.id,
    requestNumber,
    gateway: targetGateway,
    paymentProvider: targetGateway,
    currency: targetCurrency,
    amount: targetAmount,
    amountPaise,
    amountUSD: authoritativeUSD,
    paypalOrderId,
    razorpayOrderId,
    razorpayKeyId: targetGateway === 'razorpay' ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID : undefined,
    status: 'PAYMENT_PENDING',
  });
}
