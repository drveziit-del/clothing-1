import TierPyramid from '@/components/shop/TierPyramid';
import type { Product } from '@/types';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Society Fu*kers — GERKINK',
  description: 'Collection I: Tier-based luxury from $1,000 to $10,000,000. For those with more money than shame.',
  openGraph: {
    title: 'Society Fu*kers — GERKINK',
    description: 'Collection I: Tier-based luxury from $1,000 to $10,000,000. For those with more money than shame.',
    url: '/shop/society-fuckers',
  },
  twitter: {
    title: 'Society Fu*kers — GERKINK',
    description: 'Collection I: Tier-based luxury from $1,000 to $10,000,000. For those with more money than shame.',
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
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="tag tag-mist">Collection I</span>
          <h1 className={styles.title}>
            Society<br />Fu*kers
          </h1>
          <p className={styles.desc}>
            Five tiers of escalating absurdity. Starting at $1,000 — 
            because mediocrity is expensive — up to $10,000,000 for 
            the one person with a god complex and the receipt to prove it.
          </p>
          <p className={styles.warning}>
            ✦ Pricing is intentional. If it gives you heart palpitations, close the tab.
          </p>
        </div>
        <div className={styles.heroAmbient} aria-hidden />
      </div>

      <TierPyramid products={products} />
    </div>
  );
}
