import type { Product } from '@/types';
import { ValuelessClientPage } from './ValuelessClientPage';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Valueless Bi*ches — GERKINK',
  description: 'Streetwear for people who know their worth.',
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

  return (
    <div className={styles.page}>
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
