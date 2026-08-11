'use client';

import { useEffect, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { useRoast } from '@/hooks/useRoast';
import { useCurrency } from '@/context/CurrencyContext';
import styles from './RazorpayButton.module.css';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, handler: (res: unknown) => void) => void;
    };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler?: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayButtonProps {
  razorpayOrderId: string;
  amount: number; // in cents
  currency: string;
  firestoreOrderId: string;
  userEmail?: string;
  userName?: string;
  isPrebooking?: boolean;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
  amountUSD?: number;
}

export default function RazorpayButton({
  razorpayOrderId,
  amount,
  currency,
  firestoreOrderId,
  userEmail,
  userName,
  isPrebooking = false,
  onSuccess,
  onError,
  amountUSD,
}: RazorpayButtonProps) {
  const { clearCart } = useCart();
  const { toast } = useRoast();
  const { formatPrice } = useCurrency();
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || window.Razorpay || scriptLoaded.current) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    scriptLoaded.current = true;
  }, []);

  const handlePay = async () => {
    if (!window.Razorpay) {
      toast('Payment gateway not loaded. Refresh and try again.', 'error');
      return;
    }

    const options: RazorpayOptions = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
      amount,
      currency,
      order_id: razorpayOrderId,
      name: 'GERKINK',
      description: 'You actually went through with it. Respect.',
      prefill: { email: userEmail, name: userName },
      theme: { color: '#FF6B6B' },
      handler: async (response: RazorpaySuccessResponse) => {
        try {
          const res = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...response,
              orderId: firestoreOrderId,
            }),
          });

          if (!res.ok) throw new Error('Payment verification failed');

           if (!isPrebooking) {
            clearCart();
          }
          toast(isPrebooking ? "Pre-booking confirmed. Admin will contact you soon." : "Order confirmed. You're officially less basic.", 'success');
          onSuccess?.();
        } catch {
          toast('Payment received but verification failed. Contact support.', 'error');
          onError?.('Verification failed');
        }
      },
      modal: {
        ondismiss: () => toast('Backed out? Your wardrobe noticed.', 'roast'),
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <button onClick={handlePay} className={`${styles.payBtn} btn btn-primary btn-lg btn-full`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <path d="M1 10h22" />
      </svg>
      Pay Now — {amountUSD !== undefined ? formatPrice(amountUSD) : `${currency} ${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
    </button>
  );
}
