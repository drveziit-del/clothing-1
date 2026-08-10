import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ProductDetailClient } from './ProductDetailClient';
import type { Product } from '@/types';
import styles from './page.module.css';

interface Props {
  params: Promise<{ productId: string }>;
}

import { adminDb } from '@/lib/firebase/admin';

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) return {};

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gerkink.shop';
  const pageUrl = `${baseUrl}/shop/${product.slug || product.id}`;
  const title = `${product.title} — GERKINK`;
  const description = product.description || `Buy ${product.title} from GERKINK. Two collections. Zero apologies.`;
  const image = product.images?.[0] || '/logo.png';

  return {
    title,
    description,
    keywords: [product.title, product.category || 'streetwear', 'GERKINK', product.section],
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: 'website',
      images: [{ url: image, width: 800, height: 800 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { productId } = await params;
  const product = await getProduct(productId);

  if (!product) {
    notFound();
  }

  if (product.slug && productId !== product.slug) {
    redirect(`/shop/${product.slug}`);
  }

  const recommended = await getRecommendedProducts(product.section, product.id);

  // Generate Schemas
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gerkink.shop';
  const pageUrl = `${baseUrl}/shop/${product.slug || product.id}`;

  const variantPrices = product.variants?.map((v) => v.price).filter((p) => typeof p === 'number') || [];
  const lowPrice = variantPrices.length ? Math.min(...variantPrices) : product.price;
  const highPrice = variantPrices.length ? Math.max(...variantPrices) : product.price;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "image": product.images || [],
    "description": product.description,
    "sku": product.printifyId || product.id,
    "datePublished": product.createdAt ? product.createdAt.toISOString() : undefined,
    "dateModified": product.updatedAt ? product.updatedAt.toISOString() : undefined,
    "brand": {
      "@type": "Brand",
      "name": "GERKINK"
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": lowPrice,
      "highPrice": highPrice,
      "offerCount": product.variants?.length || 0,
      "offers": product.variants?.map((v) => ({
        "@type": "Offer",
        "url": pageUrl,
        "price": v.price,
        "priceCurrency": "USD",
        "itemCondition": "https://schema.org/NewCondition",
        "availability": v.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "sku": v.id || v.printifyVariantId || ""
      })) || []
    },
    "additionalProperty": [
      ...(product.materialSpec ? [{ "@type": "PropertyValue", "name": "Material", "value": product.materialSpec }] : []),
      ...(product.fitSpec ? [{ "@type": "PropertyValue", "name": "Fit", "value": product.fitSpec }] : []),
      ...(product.weightSpec ? [{ "@type": "PropertyValue", "name": "Weight", "value": product.weightSpec }] : []),
      ...(product.originSpec ? [{ "@type": "PropertyValue", "name": "Origin", "value": product.originSpec }] : [])
    ]
  };

  const faqSchema = product.showFaq && product.faqsList?.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": product.faqsList.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  } : null;

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
        "name": product.section === 'society_fuckers' ? "Society Fuckers" : "Valueless Bitches",
        "item": `${baseUrl}/shop/${product.section === 'society_fuckers' ? 'society-fuckers' : 'valueless-bitches'}`
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": product.title,
        "item": pageUrl
      }
    ]
  };

  // Parse care instructions from description for HowTo schema
  const careInstructionsMatch = product.description?.match(/Care instructions([\s\S]*?)$/i);
  const careInstructions = careInstructionsMatch
    ? careInstructionsMatch[1]
        .split('\n')
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0 && !line.includes('<br'))
    : [];

  const howToSchema = careInstructions.length ? {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `How to care for ${product.title}`,
    "step": careInstructions.map((instruction, idx) => ({
      "@type": "HowToStep",
      "position": idx + 1,
      "text": instruction
    }))
  } : null;

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
        />
      )}
      {howToSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema).replace(/</g, '\\u003c') }}
        />
      )}
      <ProductDetailClient product={product} recommendedProducts={recommended} />
    </div>
  );
}
