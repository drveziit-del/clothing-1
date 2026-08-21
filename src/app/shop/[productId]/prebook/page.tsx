import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PrebookClient from './PrebookClient';
import type { Product } from '@/types';
import { adminDb } from '@/lib/firebase/admin';

interface Props {
  params: Promise<{ productId: string }>;
}

async function getProduct(productId: string): Promise<Product | null> {
  try {
    // 1. Try finding by slug first
    const slugSnap = await adminDb
      .collection('products')
      .where('slug', '==', productId)
      .where('isPublished', '==', true)
      .limit(1)
      .get();

    if (!slugSnap.empty) {
      const doc = slugSnap.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
      } as unknown as Product;
    }

    // 2. Fallback to doc ID
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
    console.error('Error fetching product for prebooking:', err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) return {};

  return {
    title: `Pre-book ${product.title} — GERKINK`,
    description: `Apply for exclusive pre-booking of ${product.title} on GERKINK.`,
  };
}

export default async function PrebookPage({ params }: Props) {
  const { productId } = await params;
  const product = await getProduct(productId);

  if (!product) {
    notFound();
  }

  if (product.slug && productId !== product.slug) {
    redirect(`/shop/${product.slug}/prebook`);
  }

  return <PrebookClient product={product} />;
}
