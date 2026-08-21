import Link from 'next/link';
import type { Product } from '@/types';
import { ValuelessClientPage } from './ValuelessClientPage';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Valueless Bi*ches — GERKINK',
  description: 'Collection II: Streetwear with a statement. No apologies included. For the unapologetic.',
  openGraph: {
    title: 'Valueless Bi*ches — GERKINK',
    description: 'Collection II: Streetwear with a statement. No apologies included. For the unapologetic.',
    url: '/shop/valueless-bitches',
  },
  twitter: {
    title: 'Valueless Bi*ches — GERKINK',
    description: 'Collection II: Streetwear with a statement. No apologies included. For the unapologetic.',
  },
  alternates: {
    canonical: '/shop/valueless-bitches',
  },
};

import { adminDb } from '@/lib/firebase/admin';

async function getValuelessProducts(): Promise<Product[]> {
  try {
    const snapshot = await adminDb
      .collection('products')
      .where('section', '==', 'valueless_bitches')
      .where('isPublished', '==', true)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
      } as unknown as Product;
    });
  } catch (err) {
    console.error('Error fetching valueless products:', err);
    return [];
  }
}

export default async function ValuelessBitchesPage() {
  const products = await getValuelessProducts();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gerkink.shop';

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Shop",
        "item": `${baseUrl}/shop`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Valueless Bitches",
        "item": `${baseUrl}/shop/valueless-bitches`
      }
    ]
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* ── LUXURY STREETWEAR EDITORIAL HERO ───────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroContainer}>
          <div className={styles.heroLeft}>
            <div className={styles.badgeRow}>
              <span className={styles.collectionPill}>COLLECTION II</span>
              <span className={styles.statusPill}>
                <span className={styles.liveDot} />
                AVAILABLE NOW
              </span>
            </div>

            <h1 className={styles.title}>
              Valueless <span className={styles.titleGradient}>Bi*ches</span>
            </h1>

            <p className={styles.desc}>
              Provocative graphic streetwear on 240GSM heavyweight yarn. Hand-finished DTG pigment formulation,
              oversized luxury drape, and zero corporate apologies.
            </p>

            {/* Collection Switcher Nav */}
            <div className={styles.navSwitcher}>
              <span className={`${styles.switchBtn} ${styles.switchBtnActive}`}>
                🔥 Valueless Bi*ches
              </span>
              <Link href="/shop/society-fuckers" className={styles.switchBtn}>
                👑 Society Fu*kers →
              </Link>
              <Link href="/shop" className={styles.switchBtnGhost}>
                ✦ All Collections
              </Link>
            </div>
          </div>
        </div>

        <div className={styles.heroAmbientGlow} aria-hidden />
      </div>

      {/* ── PRODUCTS & FILTERS BODY ───────────────────────── */}
      <div className={styles.shopBody}>
        <ValuelessClientPage products={products} />
      </div>
    </div>
  );
}
