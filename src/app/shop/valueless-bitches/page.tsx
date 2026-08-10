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
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="tag tag-coral">Collection II</span>
          <h1 className={styles.title}>
            Valueless<br />Bi*ches
          </h1>
          <p className={styles.desc}>
            Streetwear that knows what it is. T-shirts, hoodies, accessories — 
            all priced for people who have taste and aren&#39;t afraid to show it.
            Unlike you, before you found us.
          </p>
        </div>
        <div className={styles.heroAmbient} aria-hidden />
      </div>

      <div className={styles.shopBody}>
        <ValuelessClientPage products={products} />
      </div>
    </div>
  );
}
