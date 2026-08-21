import { Suspense } from 'react';
import ReceiptClient from './ReceiptClient';

export const metadata = {
  title: 'Order Receipt | GERKINK',
  description: 'Printing your official GERKINK order receipt slip.',
};

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#09090b',
            color: '#71717a',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          Initializing printer...
        </div>
      }
    >
      <ReceiptClient />
    </Suspense>
  );
}
