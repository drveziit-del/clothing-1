import { verifyReviewToken } from '@/lib/reviews/token';
import { adminDb } from '@/lib/firebase/admin';
import ReviewClientPage from './ReviewClientPage';
import styles from './ReviewPage.module.css';
import Link from 'next/link';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Submit Review — GERKINK',
  robots: {
    index: false,
    follow: false,
  },
};

interface ReviewPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <p className="text-label" style={{ color: 'var(--coral-200)' }}>
            REVIEW VERIFICATION
          </p>
          <h1 className={styles.errorTitle}>Missing Review Link</h1>
          <p className={styles.errorText}>
            Review links are automatically sent to your email after your GERKINK order is delivered.
          </p>
          <Link href="/account" className="btn btn-primary">
            View My Orders →
          </Link>
        </div>
      </div>
    );
  }

  const payload = verifyReviewToken(token);

  if (!payload) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <p className="text-label" style={{ color: 'var(--coral-200)' }}>
            EXPIRED OR INVALID TOKEN
          </p>
          <h1 className={styles.errorTitle}>Link No Longer Valid</h1>
          <p className={styles.errorText}>
            This verified review link has expired or was modified. You can still review your purchase directly from your account.
          </p>
          <Link href="/account" className="btn btn-primary">
            Go to Account Orders →
          </Link>
        </div>
      </div>
    );
  }

  // Fetch product info
  let productTitle = 'Your Purchased Item';
  let productImage = '';
  try {
    const prodDoc = await adminDb.collection('products').doc(payload.productId).get();
    if (prodDoc.exists) {
      const pData = prodDoc.data()!;
      productTitle = pData.title || productTitle;
      if (pData.media && Array.isArray(pData.media) && pData.media[0]?.url) {
        productImage = pData.media[0].url;
      }
    }
  } catch (err) {
    console.warn('[ReviewPage] Failed to fetch product info:', err);
  }

  return (
    <ReviewClientPage
      token={token}
      orderId={payload.orderId}
      productId={payload.productId}
      productTitle={productTitle}
      productImage={productImage}
      customerEmail={payload.email}
    />
  );
}
