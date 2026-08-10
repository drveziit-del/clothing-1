'use client';

import {
  PayPalScriptProvider,
  PayPalButtons,
  FUNDING,
} from '@paypal/react-paypal-js';
import { useCart } from '@/context/CartContext';
import { useRoast } from '@/hooks/useRoast';

interface PayPalMultiButtonProps {
  amountUSD: number;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  referralCode?: string;
  couponCode?: string;
  shippingAddress: any;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}

export default function PayPalMultiButton({
  amountUSD,
  items,
  referralCode,
  couponCode,
  shippingAddress,
  onSuccess,
  onError,
}: PayPalMultiButtonProps) {
  const { clearCart } = useCart();
  const { toast } = useRoast();
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

  if (!clientId) {
    return (
      <div style={{ color: 'var(--accent)', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem' }}>
        PayPal client ID is not configured. Please contact support.
      </div>
    );
  }

  const handleCreateOrder = async () => {
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          referralCode,
          couponCode,
          shippingAddress,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(`Server error (${res.status}): ${textErr.slice(0, 100)}`);
      }

      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error || `Error ${res.status}`);
        throw new Error(errMsg);
      }

      sessionStorage.setItem('pending_paypal_order_id', data.orderId);
      return data.paypalOrderId;
    } catch (err: any) {
      const msg = err?.message || 'Payment initialization failed';
      toast(msg, 'error');
      onError?.(msg);
      throw err;
    }
  };

  const handleApprove = async (data: { orderID: string }) => {
    try {
      const orderId = sessionStorage.getItem('pending_paypal_order_id') || '';
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paypalOrderId: data.orderID,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let resData: any = {};
      if (contentType.includes('application/json')) {
        resData = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(`Capture server error (${res.status}): ${textErr.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(resData.error || 'Payment capture failed');
      }

      clearCart();
      sessionStorage.removeItem('pending_paypal_order_id');
      toast("Order confirmed! Payment processed via PayPal.", 'success');
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.message || 'Payment verification failed';
      toast(msg, 'error');
      onError?.(msg);
    }
  };

  return (
    <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', maxWidth: '420px', width: '100%' }}>
        <style>{`
          iframe:focus-visible, .paypal-buttons:focus-visible, div[data-funding-source]:focus-visible {
            outline: 2px solid var(--accent, #ff4444) !important;
            outline-offset: 2px !important;
          }
        `}</style>

        {/* 1. Direct Express PayPal Button */}
        <PayPalButtons
          fundingSource={FUNDING.PAYPAL}
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 48 }}
          createOrder={handleCreateOrder}
          onApprove={handleApprove}
          onError={(err) => toast('PayPal transaction error', 'error')}
        />

        {/* 2. Standalone Debit or Credit Card Button */}
        <PayPalButtons
          fundingSource={FUNDING.CARD}
          style={{ layout: 'vertical', color: 'black', shape: 'rect', label: 'pay', height: 48 }}
          createOrder={handleCreateOrder}
          onApprove={handleApprove}
          onError={(err) => toast('Card transaction error', 'error')}
        />
      </div>
    </PayPalScriptProvider>
  );
}
