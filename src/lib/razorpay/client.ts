import 'server-only';
import Razorpay from 'razorpay';
import { getRateForCurrency } from '@/lib/currency/rates';

let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (_razorpay) return _razorpay;

  const key_id     = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  }

  _razorpay = new Razorpay({ key_id, key_secret });
  return _razorpay;
}

export async function createRazorpayOrder(
  amountUSD: number,
  receiptId: string,
  forceINR = false
): Promise<{ id: string; amount: number; currency: string }> {
  const razorpay = getRazorpay();

  if (forceINR) {
    console.log('[Razorpay] Forcing INR order creation for domestic transaction');
    return createInrOrderFallback(amountUSD, receiptId, razorpay);
  }

  const amountCents = Math.round(amountUSD * 100);

  try {
    const order = await razorpay.orders.create({
      amount: amountCents,
      currency: 'USD',
      receipt: receiptId,
      notes: { platform: 'gerkink' },
    });

    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  } catch (err: any) {
    const errDesc = err?.error?.description || err?.message || '';
    console.warn('[Razorpay] USD order failed, attempting INR fallback:', errDesc);
    return createInrOrderFallback(amountUSD, receiptId, razorpay);
  }
}

async function createInrOrderFallback(
  amountUSD: number,
  receiptId: string,
  razorpay: any
): Promise<{ id: string; amount: number; currency: string }> {
  try {
    let liveInrRate: number;
    try {
      liveInrRate = await getRateForCurrency('INR');
    } catch (rateErr) {
      console.warn('[Razorpay] Live rate fetch failed, using fallback rate 83.5:', rateErr);
      liveInrRate = 83.5; // hardcoded safety net
    }

    const amountINR = Math.round(amountUSD * liveInrRate);
    const amountPaise = amountINR * 100;

    console.log(`[Razorpay] Creating INR order: $${amountUSD} × ${liveInrRate} = ₹${amountINR} (${amountPaise} paise)`);

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: { platform: 'gerkink', currency_converted: 'USD_to_INR', rate_used: liveInrRate },
    });

    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  } catch (inrErr: any) {
    const inrDesc = inrErr?.error?.description || inrErr?.message || 'INR fallback failed';
    console.error('[Razorpay] INR fallback order failed:', inrDesc, inrErr);
    throw new Error(`Razorpay order failed (INR fallback: ${inrDesc})`);
  }
}

export async function refundRazorpayPayment(
  paymentId: string,
  amountUSD: number
): Promise<{ id: string; status: string }> {
  if (process.env.NODE_ENV !== 'production' && paymentId.startsWith('pay_mock_')) {
    return {
      id: 'rfnd_mock_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      status: 'processed',
    };
  }

  const razorpay = getRazorpay();
  const amountCents = Math.round(amountUSD * 100);

  const refund = await razorpay.payments.refund(paymentId, {
    amount: amountCents,
    notes: { reason: 'Referral Reward Refund' },
  });

  return {
    id: refund.id,
    status: refund.status,
  };
}

// ─── RazorpayX Automated Payouts ──────────────────────────────────────────

async function razorpayxRequest(path: string, method: string, body: any) {
  const keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('RazorpayX API credentials missing');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.description || `RazorpayX Payout API failed with status ${res.status}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Registers an affiliate as a contact in RazorpayX
 */
export async function createRazorpayxContact(name: string, email: string): Promise<string> {
  if (process.env.NODE_ENV === 'test' || !process.env.RAZORPAYX_KEY_ID) {
    return 'cont_mock_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  const data = await razorpayxRequest('/contacts', 'POST', {
    name,
    email,
    type: 'employee',
    reference_id: 'gkink_affiliate',
  });

  return data.id;
}

/**
 * Creates a fund account (bank account) for the contact in RazorpayX
 */
export async function createRazorpayxFundAccount(
  contactId: string,
  accountHolderName: string,
  accountNumber: string,
  ifscCode: string
): Promise<string> {
  if (contactId.startsWith('cont_mock_') || !process.env.RAZORPAYX_KEY_ID) {
    return 'fa_mock_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  const data = await razorpayxRequest('/fund_accounts', 'POST', {
    contact_id: contactId,
    account_type: 'bank_account',
    bank_account: {
      name: accountHolderName,
      ifsc: ifscCode,
      account_number: accountNumber,
    },
  });

  return data.id;
}

/**
 * Triggers a direct bank transfer payout via RazorpayX
 */
export async function createRazorpayxPayout(
  fundAccountId: string,
  amountUSD: number,
  currencyRate: number = 83 // 1 USD = 83 INR by default
): Promise<{ id: string; status: string; amountPaidINR: number }> {
  const amountINR = Math.round(amountUSD * currencyRate);
  const amountPaise = amountINR * 100;

  if (fundAccountId.startsWith('fa_mock_') || !process.env.RAZORPAYX_KEY_ID) {
    return {
      id: 'pout_mock_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      status: 'processed',
      amountPaidINR: amountINR,
    };
  }

  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!accountNumber) {
    throw new Error('RAZORPAYX_ACCOUNT_NUMBER is not set');
  }

  const data = await razorpayxRequest('/payouts', 'POST', {
    account_number: accountNumber,
    fund_account_id: fundAccountId,
    amount: amountPaise,
    currency: 'INR',
    mode: 'IMPS',
    purpose: 'referral',
    queue_if_low_balance: true,
    notes: {
      reason: 'GERKINK Affiliate Referral Commission Payout',
    },
  });

  return {
    id: data.id,
    status: data.status,
    amountPaidINR: amountINR,
  };
}


