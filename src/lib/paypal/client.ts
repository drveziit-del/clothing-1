import 'server-only';
import crypto from 'crypto';
import type { PaymentGateway } from '@/lib/payment/types';

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getPayPalBaseUrl(): string {
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function clearPayPalAccessToken(): void {
  cachedAccessToken = null;
}

export async function getPayPalAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60000) {
    return cachedAccessToken.token;
  }

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseUrl = getPayPalBaseUrl();

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal token authentication failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const expiresInMs = (data.expires_in || 3600) * 1000;

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  return data.access_token;
}

function get2LetterCountryCode(countryCode?: string): string {
  if (!countryCode) return 'US';
  const clean = countryCode.trim().toUpperCase();
  return clean.length === 2 ? clean : 'US';
}

export class PayPalGateway implements PaymentGateway {
  async createOrder(
    amountUSD: number,
    receiptId: string,
    shippingAddress?: {
      name: string;
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      phone?: string;
    },
    userEmail?: string
  ): Promise<{ id: string; amount: number; currency: string }> {
    const token = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    const countryCode = get2LetterCountryCode(shippingAddress?.country);

    const nameParts = (shippingAddress?.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'Valued';
    const cleanPhone = (shippingAddress?.phone || '').replace(/\D/g, '');

    const payload: any = {
      intent: 'CAPTURE',
      application_context: {
        brand_name: 'GERKINK',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        shipping_preference: shippingAddress ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING',
      },
      ...(shippingAddress ? {
        payer: {
          ...(userEmail ? { email_address: userEmail } : {}),
          name: {
            given_name: firstName,
            surname: lastName,
          },
          ...(cleanPhone.length >= 7 ? {
            phone: {
              phone_type: 'MOBILE',
              phone_number: {
                national_number: cleanPhone.slice(-10),
              },
            },
          } : {}),
          address: {
            address_line_1: shippingAddress.street,
            admin_area_2: shippingAddress.city,
            admin_area_1: shippingAddress.state,
            postal_code: shippingAddress.zip,
            country_code: countryCode,
          },
        },
      } : {}),
      purchase_units: [
        {
          reference_id: receiptId,
          amount: {
            currency_code: 'USD',
            value: amountUSD.toFixed(2),
          },
          ...(shippingAddress ? {
            shipping: {
              name: { full_name: shippingAddress.name },
              address: {
                address_line_1: shippingAddress.street,
                admin_area_2: shippingAddress.city,
                admin_area_1: shippingAddress.state,
                postal_code: shippingAddress.zip,
                country_code: countryCode,
              },
            },
          } : {}),
        },
      ],
    };

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearPayPalAccessToken();
      }
      let desc = '';
      try {
        const errorData = await res.json();
        desc = errorData.message || JSON.stringify(errorData);
      } catch {
        desc = await res.text();
      }
      throw new Error(`PayPal createOrder failed (${res.status}): ${desc}`);
    }

    const order = await res.json();
    const purchaseVal = order.purchase_units?.[0]?.amount?.value;
    const amountCents = purchaseVal
      ? Math.round(Number(purchaseVal) * 100)
      : Math.round(amountUSD * 100);

    return {
      id: order.id,
      amount: amountCents,
      currency: 'USD',
    };
  }

  async captureOrder(
    paypalOrderId: string
  ): Promise<{ captureId: string; status: string; amountValue?: number; currency?: string }> {
    const token = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    const res = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearPayPalAccessToken();
      }
      const errText = await res.text();
      throw new Error(`PayPal captureOrder failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id || data.id;
    const status = data.status || capture?.status || 'COMPLETED';
    const amountValue = capture?.amount?.value ? parseFloat(capture.amount.value) : undefined;
    const currency = capture?.amount?.currency_code || data.purchase_units?.[0]?.amount?.currency_code || 'USD';

    return { captureId, status, amountValue, currency };
  }

  async verifyWebhook(request: Request): Promise<{ valid: boolean; event?: any }> {
    // 1. Explicit Secret Check for Test/Dev Webhook Bypass
    // The test webhook bypass is strictly unavailable unless PAYPAL_TEST_WEBHOOK_SECRET is explicitly configured.
    const testSecret = process.env.PAYPAL_TEST_WEBHOOK_SECRET;
    const providedTestSecret =
      request.headers.get('x-paypal-test-secret') ||
      request.headers.get('x-test-webhook-secret') ||
      request.headers.get('x-test-webhook');

    if (
      process.env.NODE_ENV !== 'production' &&
      testSecret &&
      testSecret.trim().length > 0 &&
      providedTestSecret
    ) {
      const testBuf = Buffer.from(testSecret.trim());
      const provBuf = Buffer.from(providedTestSecret.trim());
      if (testBuf.length === provBuf.length && crypto.timingSafeEqual(testBuf, provBuf)) {
        try {
          const raw = await request.text();
          return { valid: true, event: JSON.parse(raw) };
        } catch {
          return { valid: false };
        }
      }
    }

    // 2. Official PayPal Transmission Verification
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error('[PayPalGateway] CRITICAL: PAYPAL_WEBHOOK_ID is missing. Rejecting unverified webhook.');
      return { valid: false };
    }

    const authAlgo = request.headers.get('paypal-auth-algo');
    const certUrl = request.headers.get('paypal-cert-url');
    const transmissionId = request.headers.get('paypal-transmission-id');
    const transmissionSig = request.headers.get('paypal-transmission-sig');
    const transmissionTime = request.headers.get('paypal-transmission-time');

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      return { valid: false };
    }

    const rawBody = await request.text();
    const token = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    const verifyPayload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      client_metadata_id: transmissionId,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    };

    const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyPayload),
    });

    if (!res.ok) return { valid: false };

    const verifyResult = await res.json();
    const valid = verifyResult.verification_status === 'SUCCESS';
    return { valid, event: JSON.parse(rawBody) };
  }
}

export const paypalGateway = new PayPalGateway();
