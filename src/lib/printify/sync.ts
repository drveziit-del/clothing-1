import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { getProducts, getProduct } from './client';
import type { Product, Variant } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function syncProductsFromPrintify(shopId: string): Promise<{
  synced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const { data: printifyProducts } = await getProducts(shopId);

    for (const pp of printifyProducts) {
      try {
        const full = await getProduct(shopId, pp.id);

        // Build option lookup maps from Printify options
        const sizeMap: Record<number, string> = {};
        const colorMap: Record<number, string> = {};
        const colorHexMap: Record<number, string> = {};

        full.options?.forEach((opt: any) => {
          if (opt.type === 'size') {
            opt.values?.forEach((val: any) => {
              sizeMap[val.id] = val.title;
            });
          } else if (opt.type === 'color') {
            opt.values?.forEach((val: any) => {
              colorMap[val.id] = val.title;
              if (val.colors && val.colors.length > 0) {
                colorHexMap[val.id] = val.colors[0];
              }
            });
          }
        });

        const variants: Variant[] = full.variants
          .filter((v) => v.is_enabled)
          .map((v) => {
            let sizeName = 'One Size';
            let colorName = 'Default';
            let hexValue = '#ffffff';

            if (Array.isArray(v.options)) {
              v.options.forEach((optId: any) => {
                const idNum = Number(optId);
                if (sizeMap[idNum]) {
                  sizeName = sizeMap[idNum];
                }
                if (colorMap[idNum]) {
                  colorName = colorMap[idNum];
                  hexValue = colorHexMap[idNum] || '#ffffff';
                }
              });
            } else if (v.options && typeof v.options === 'object') {
              // Fallback for custom formatted options if any
              const opt = v.options as Record<string, string>;
              if (opt.size) sizeName = opt.size;
              if (opt.color) colorName = opt.color;
            }

            const variantImages = Array.isArray(full.images)
              ? full.images
                  .filter((img: any) => {
                    const ids = img.variant_ids || [];
                    return ids.some((id: any) => String(id) === String(v.id));
                  })
                  .map((img: any) => img.src)
              : [];

            return {
              id: String(v.id),
              size: sizeName,
              color: colorName,
              colorHex: hexValue,
              price: v.price / 100, // Printify returns cents
              available: v.is_enabled,
              printifyVariantId: String(v.id),
              images: variantImages,
            };
          });

        const basePrice = variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;

        const productData: Omit<Product, 'id'> = {
          printifyId: pp.id,
          title: full.title,
          description: full.description,
          section: 'valueless_bitches', // Default; owner assigns section in admin
          price: basePrice,
          images: full.images.map((img) => img.src),
          variants,
          isPublished: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Generate unique slug
        const slugify = (text: string) =>
          text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/&/g, '-and-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');

        const baseSlug = slugify(full.title);

        // Upsert by Printify ID
        const existing = await adminDb
          .collection('products')
          .where('printifyId', '==', pp.id)
          .limit(1)
          .get();

        if (existing.empty) {
          let uniqueSlug = baseSlug;
          let suffix = 1;
          let isUnique = false;
          while (!isUnique) {
            const dupSnap = await adminDb.collection('products')
              .where('slug', '==', uniqueSlug)
              .limit(1)
              .get();
            if (dupSnap.empty) {
              isUnique = true;
            } else {
              uniqueSlug = `${baseSlug}-${suffix}`;
              suffix++;
            }
          }

          await adminDb.collection('products').add({
            ...productData,
            slug: uniqueSlug,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const existingDoc = existing.docs[0];
          const existingData = existingDoc.data();
          const updateData: any = {
            title: productData.title,
            description: productData.description,
            images: productData.images,
            variants: productData.variants,
            price: productData.price,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (!existingData.slug) {
            let uniqueSlug = baseSlug;
            let suffix = 1;
            let isUnique = false;
            while (!isUnique) {
              const dupSnap = await adminDb.collection('products')
                .where('slug', '==', uniqueSlug)
                .limit(1)
                .get();
              if (dupSnap.empty || dupSnap.docs[0].id === existingDoc.id) {
                isUnique = true;
              } else {
                uniqueSlug = `${baseSlug}-${suffix}`;
                suffix++;
              }
            }
            updateData.slug = uniqueSlug;
          }

          await existingDoc.ref.update(updateData);
        }

        synced++;
      } catch (err) {
        errors.push(`Product ${pp.id}: ${String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Sync failed: ${String(err)}`);
  }

  return { synced, errors };
}
