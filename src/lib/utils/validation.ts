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
  name: z.string().min(2).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;

// ─── Admin ────────────────────────────────────────────────────────────────
export const createProductSchema = z.object({
  printifyId: z.string().min(1),
  title: z.string().min(2).max(200),
  description: z.string().max(5000),
  section: z.enum(['society_fuckers', 'valueless_bitches']),
  price: z.number().positive(),
  tier: z.number().int().min(1).max(5).optional(),
  prebookingPrice: z.number().nonnegative().nullish(),
  isPublished: z.boolean().default(false),
  images: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        size: z.string(),
        color: z.string(),
        colorHex: z.string().optional(),
        price: z.number().positive(),
        available: z.boolean().default(true),
        images: z.array(z.string()).optional(),
      })
    )
    .optional(),
  showManifesto: z.boolean().optional(),
  showSpecs: z.boolean().optional(),
  showFeatures: z.boolean().optional(),
  showComparison: z.boolean().optional(),
  showUgc: z.boolean().optional(),
  showFaq: z.boolean().optional(),
  fitRecommendation: z.string().optional(),
  materialSpec: z.string().optional(),
  fitSpec: z.string().optional(),
  weightSpec: z.string().optional(),
  originSpec: z.string().optional(),
  manifestoQuote: z.string().optional(),
  manifestoBody: z.string().optional(),
  ugcVideos: z
    .array(
      z.object({
        name: z.string(),
        stars: z.number().int().min(1).max(5),
        videoUrl: z.string(),
      })
    )
    .optional(),
  featuresList: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    )
    .optional(),
  comparisonRows: z
    .array(
      z.object({
        feature: z.string(),
        us: z.string(),
        them: z.string(),
      })
    )
    .optional(),
  faqsList: z
    .array(
      z.object({
        q: z.string(),
        a: z.string(),
      })
    )
    .optional(),
  commitmentText: z.string().optional(),
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
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
