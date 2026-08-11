import type { OrderHistoryEvent } from '@/lib/payment/types';

// ─── User ─────────────────────────────────────────────────────────────────
export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  totalEarnings: number;
  linkClicks?: number; // Referral clicks counter
  createdAt: Date;
  photoURL?: string;
}

// ─── Product ───────────────────────────────────────────────────────────────
export type ProductSection = 'society_fuckers' | 'valueless_bitches';

export interface Variant {
  id: string;
  size: string;
  color: string;
  colorHex?: string;
  price: number;
  available: boolean;
  printifyVariantId?: string;
  images?: string[];
}

export interface Product {
  id: string;
  printifyId: string;
  title: string;
  description: string;
  section: ProductSection;
  category?: string;
  price: number;
  tier?: 1 | 2 | 3 | 4 | 5; // Only for society_fuckers
  images: string[];
  videos?: string[];
  variants: Variant[];
  tags?: string[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt?: Date;
  prebookingPrice?: number;
  showManifesto?: boolean;
  showSpecs?: boolean;
  showFeatures?: boolean;
  showComparison?: boolean;
  showUgc?: boolean;
  showFaq?: boolean;
  fitRecommendation?: string;
  materialSpec?: string;
  fitSpec?: string;
  weightSpec?: string;
  originSpec?: string;
  manifestoQuote?: string;
  manifestoBody?: string;
  ugcVideos?: Array<{ name: string; stars: number; videoUrl: string }>;
  featuresList?: Array<{ title: string; description: string }>;
  comparisonRows?: Array<{ feature: string; us: string; them: string }>;
  faqsList?: Array<{ q: string; a: string }>;
  commitmentText?: string;
  slug?: string;
}

// ─── Cart ──────────────────────────────────────────────────────────────────
export interface CartItem {
  product: Product;
  variant: Variant;
  quantity: number;
}

// ─── Order ────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'queued_for_printify'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'payment_reversed'
  | 'chargeback'
  | 'disputed'
  | 'expired'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  productId: string;
  title: string;
  variant: Variant;
  quantity: number;
  price: number;
  image: string;
  printifyProductId?: string;
}

export interface Address {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

export interface Order {
  id: string;
  userId: string;
  userEmail: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paymentGateway?: 'razorpay' | 'paypal' | 'free';
  paymentCaptured?: boolean;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  status: OrderStatus;
  referralCode?: string;
  couponCode?: string;
  shippingAddress?: Address;
  printifyOrderId?: string;
  trackingUrl?: string;
  referralRefundedAmount?: number;
  isPrebooking?: boolean;
  prebookName?: string;
  prebookEmail?: string;
  prebookMessage?: string;
  expiresAt?: Date;
  emailSent?: boolean;
  history?: OrderHistoryEvent[];
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Referral ─────────────────────────────────────────────────────────────
export type ReferralStatus = 'pending' | 'eligible_for_claim' | 'claimed' | 'credited' | 'reversed';

export interface Referral {
  id: string;
  affiliateUid: string;
  affiliateCode: string;
  referredUid: string;
  orderId: string;
  orderValue: number;
  commission: number;
  commissionClaimed?: number;
  status: ReferralStatus;
  createdAt: Date;
  payoutMethod?: 'refund' | 'coupon' | 'wise' | 'paypal' | 'bank';
  payoutDetail?: string; // Refund ID, Coupon Code, or Payout Request ID
}

// ─── Coupon ───────────────────────────────────────────────────────────────
export interface Coupon {
  id: string;
  code: string;
  value: number;
  userId: string;
  isUsed: boolean;
  createdAt: Date;
  usedAt?: Date;
  orderId?: string;
}


// ─── Contact ──────────────────────────────────────────────────────────────
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
}

// ─── Settings ─────────────────────────────────────────────────────────────
export interface AppSettings {
  globalReferralCount: number;
  totalCustomers: number;
  roastMessages: string[];
  siteActive: boolean;
  checkoutMessage?: string;
}

// ─── Admin Metrics ────────────────────────────────────────────────────────
export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeUsers: number;
  referralCount: number;
  pendingOrders: number;
}

// ─── Printify ────────────────────────────────────────────────────────────
export interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  images: Array<{ src: string; position: string }>;
  variants: Array<{
    id: number;
    title: string;
    price: number;
    is_enabled: boolean;
    options: any;
  }>;
  options?: Array<{
    name: string;
    type: string;
    values: Array<{
      id: number;
      title: string;
      colors?: string[];
    }>;
  }>;
}

export interface PrintifyOrder {
  external_id: string;
  label: string;
  line_items: Array<{
    product_id: string;
    variant_id: number;
    quantity: number;
  }>;
  shipping_method: number;
  address_to: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    country: string;
    region: string;
    address1: string;
    address2?: string;
    city: string;
    zip: string;
  };
}

// ─── Site Copywriting ──────────────────────────────────────────────────────
export interface ManifestoSection {
  label: string;
  title: string;
  body: string;
}

export interface OwnerProfile {
  alias: string;
  role: string;
  bio: string;
}

export interface SiteCopywriting {
  heroLine1: string;
  heroLine2: string;
  heroAccent: string;
  heroSubtext: string;
  heroCta: string;
  manifestoHeroPull: string;
  manifestoCtaText: string;
  manifestoCtaButton: string;
  manifestoSections: ManifestoSection[];
  ownersTitle: string;
  ownersDesc: string;
  ownersQuote: string;
  ownersAttribution: string;
  ownersList: OwnerProfile[];
  footerTagline: string;
}

// ─── Payout Preferences & Payout Requests ─────────────────────────────────
export interface PayoutMethodPreferences {
  method: 'wise' | 'paypal' | 'bank';
  email?: string;       // Wise or PayPal email address
  bankDetails?: {
    accountHolderName: string;
    routingNumber: string; // stored encrypted on server
    accountNumber: string; // stored encrypted on server
    accountType: 'checking' | 'savings';
    email?: string; // recipient email (optional)
    country: string;
    city: string;
    streetAddress: string;
    state: string;
    zipCode: string;
  };
}

export interface PayoutRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;       // USD
  method: 'wise' | 'paypal' | 'bank';
  payoutDetails: string; // Serialized string of email or bank details
  status: 'pending' | 'processed' | 'failed';
  createdAt: Date;
}




// --- Reviews ---
export interface Review {
  id: string;
  productId?: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  text: string;
  createdAt: Date;
  updatedAt?: Date;
}
