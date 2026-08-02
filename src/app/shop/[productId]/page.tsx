import { notFound } from 'next/navigation';
import { ProductDetailClient } from './ProductDetailClient';
import type { Product } from '@/types';
import styles from './page.module.css';

interface Props {
  params: Promise<{ productId: string }>;
}

import { adminDb } from '@/lib/firebase/admin';

async function getProduct(productId: string): Promise<Product | null> {
  try {
    const docSnap = await adminDb.collection('products').doc(productId).get();
    if (!docSnap.exists) return null;
    
    const data = docSnap.data();
    if (!data?.isPublished) return null;

    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
    } as unknown as Product;
  } catch (err) {
    console.error('Error fetching product detail:', err);
    return null;
  }
}

async function getRecommendedProducts(section: string, currentId: string): Promise<Product[]> {
  try {
    const snapshot = await adminDb
      .collection('products')
      .where('section', '==', section)
      .where('isPublished', '==', true)
      .limit(5)
      .get();

    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
        } as unknown as Product;
      })
      .filter((p) => p.id !== currentId)
      .slice(0, 4);
  } catch (err) {
    console.error('Error fetching recommended products:', err);
    return [];
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { productId } = await params;
  const product = await getProduct(productId);

  if (!product) {
    notFound();
  }

  const recommended = await getRecommendedProducts(product.section, product.id);

  return (
    <div className={styles.page}>
      <ProductDetailClient product={product} recommendedProducts={recommended} />
    </div>
  );
}
