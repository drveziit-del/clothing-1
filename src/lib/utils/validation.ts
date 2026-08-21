import { z } from 'zod';

// ─── Auth ──────────────────────────────────────────────────────────────────
export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[0-9]/, 'Must include a number'),
  displayName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ─── Checkout / Payment ────────────────────────────────────────────────────
export const addressSchema = z.object({
  name: z.string().min(2).max(100),
  street: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  zip: z.string().min(3).max(20),
  country: z.string().min(2).max(100),
  phone: z.string().optional(),
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
      })
    )
    .min(1, 'Cart is empty'),
  referralCode: z.string().optional(),
  couponCode: z.string().optional(),
  shippingAddress: addressSchema,
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  orderId: z.string().min(1), // Our Firestore order ID
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

// ─── Contact ──────────────────────────────────────────────────────────────
export const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long'),
});

export type ContactInput = z.infer<typeof contactSchema>;

// ─── Admin ────────────────────────────────────────────────────────────────
export const createProductSchema = z.object({
  printifyId: z.string().min(1).optional(),
  title: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).nullish(),
  section: z.enum(['society_fuckers', 'valueless_bitches']),
  price: z.number().positive(),
  tier: z.number().int().min(1).max(5).nullish(),
  prebookingPrice: z.number().nonnegative().nullish(),
  isPublished: z.boolean().default(false),
  images: z.array(z.string()).nullish(),
  videos: z.array(z.string()).nullish(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        size: z.string(),
        color: z.string(),
        colorHex: z.string().nullish(),
        price: z.number().positive(),
        available: z.boolean().default(true),
        images: z.array(z.string()).nullish(),
        printifyVariantId: z.union([z.string(), z.number()]).nullish(),
      })
    )
    .nullish(),
  showManifesto: z.boolean().nullish(),
  showSpecs: z.boolean().nullish(),
  showFeatures: z.boolean().nullish(),
  showComparison: z.boolean().nullish(),
  showUgc: z.boolean().nullish(),
  showFaq: z.boolean().nullish(),
  fitRecommendation: z.string().nullish(),
  materialSpec: z.string().nullish(),
  fitSpec: z.string().nullish(),
  weightSpec: z.string().nullish(),
  originSpec: z.string().nullish(),
  manifestoQuote: z.string().nullish(),
  manifestoBody: z.string().nullish(),
  ugcVideos: z
    .array(
      z.object({
        name: z.string(),
        stars: z.number().int().min(1).max(5),
        videoUrl: z.string(),
      })
    )
    .nullish(),
  featuresList: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    )
    .nullish(),
  comparisonRows: z
    .array(
      z.object({
        feature: z.string(),
        us: z.string(),
        them: z.string(),
      })
    )
    .nullish(),
  faqsList: z
    .array(
      z.object({
        q: z.string(),
        a: z.string(),
      })
    )
    .nullish(),
  commitmentText: z.string().nullish(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateSettingsSchema = z.object({
  roastMessages: z.array(z.string().min(5).max(200)).optional(),
  checkoutMessage: z.string().max(200).optional(),
  siteActive: z.boolean().optional(),
  standardShippingFee: z.number().nonnegative().optional(),
  freeShippingThreshold: z.number().nonnegative().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ─── Prebooking ────────────────────────────────────────────────────────────
export const createPrebookSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  message: z.string().max(2000, 'Message is too long').optional().nullable(),
});

export type CreatePrebookInput = z.infer<typeof createPrebookSchema>;

