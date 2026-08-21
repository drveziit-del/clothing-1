import TierPyramid from '@/components/shop/TierPyramid';
import type { Product } from '@/types';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Society Fu*kers — Tier-Based Luxury ($1K to $10M) — GERKINK',
  description: 'Collection I: Five escalating tiers of unapologetic luxury streetwear from $1,000 to $10,000,000. For those with more capital than shame.',
  openGraph: {
    title: 'Society Fu*kers — Tier-Based Luxury ($1K to $10M) — GERKINK',
    description: 'Collection I: Five escalating tiers of unapologetic luxury streetwear from $1,000 to $10,000,000. For those with more capital than shame.',
    url: '/shop/society-fuckers',
  },
  twitter: {
    title: 'Society Fu*kers — Tier-Based Luxury ($1K to $10M) — GERKINK',
    description: 'Collection I: Five escalating tiers of unapologetic luxury streetwear from $1,000 to $10,000,000. For those with more capital than shame.',
  },
  alternates: {
    canonical: '/shop/society-fuckers',
  },
};

import { adminDb } from '@/lib/firebase/admin';

async function getSocietyFuckersProducts(): Promise<Product[]> {
  try {
    const snapshot = await adminDb
      .collection('products')
      .where('section', '==', 'society_fuckers')
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
    console.error('Error fetching society fuckers products:', err);
    return [];
  }
}

export default async function SocietyFuckersPage() {
  const products = await getSocietyFuckersProducts();
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
        "name": "Society Fuckers",
        "item": `${baseUrl}/shop/society-fuckers`
      }
    ]
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* ── ULTRA LUXURY GILDED HERO ───────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadgeRow}>
            <span className="tag tag-mist">Collection I • The Hierarchy</span>
            <span className={styles.supplyPill}>1,017 Total Pieces Worldwide</span>
          </div>

          <h1 className={styles.title}>
            Society <span className={styles.titleGold}>Fu*kers</span>
          </h1>

          <p className={styles.desc}>
            Five escalating tiers of unapologetic absurdist luxury. Starting at <strong>$1,000</strong> — because mediocrity is expensive — up to <strong>$10,000,000</strong> for the single individual with a god complex and the bank receipt to prove it.
          </p>

          <div className={styles.warningBox}>
            <span aria-hidden>⚠️</span>
            <p className={styles.warningText}>
              Pricing is strictly non-negotiable. If it elevates your blood pressure, close the browser immediately.
            </p>
          </div>
        </div>

        <div className={styles.heroAmbient} aria-hidden />
      </section>

      {/* ── INTERACTIVE TIER PYRAMID & ABSURDITY CALCULATOR ─── */}
      <TierPyramid products={products} />
    </div>
  );
}
