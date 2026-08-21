# GERKINK Technical Specifications & Architecture Document

## 1. Technology Stack & Infrastructure

| Layer | Technology / Framework | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) | Server-side rendering, static prerendering, API route handlers |
| **Language** | TypeScript (Strict Mode) | Type-safe data models and backend contracts |
| **Styling** | Vanilla CSS Tokens + CSS Modules + Tailwind CSS v4 | Dark mode theme, glassmorphism, responsive grid layout |
| **Database** | Firebase Firestore (Google Cloud) | Real-time document DB, ACID transactions, document security rules |
| **Auth** | Firebase Auth + Firebase Admin SDK v13 | Email/password, Google OAuth, HttpOnly session cookies |
| **Payment Gateways** | Razorpay SDK (India/INR) & PayPal REST v2 (International/USD) | Multi-currency checkout, webhook signature verification |
| **Fulfillment** | Printify REST API v1 | Automated print-on-demand submission & order sync |
| **Email** | Resend API / SMTP Transport | Order confirmation emails with HTML templating |
| **Encryption** | Node.js `crypto` (AES-256-GCM) | Server-side encryption of affiliate bank & payout details |

---

## 2. Database Schema (Firestore Collections)

### 2.1 Collection: `users/{uid}`
```typescript
interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  referralCode: string;             // e.g. "GK-89A12"
  referredBy?: string | null;       // Affiliate code used at signup
  totalEarnings: number;            // Accumulated USD earnings from referrals ($100 per 10 sales)
  claimedEarnings: number;          // Total USD paid out
  createdAt: FieldValue;
  updatedAt: FieldValue;
}
```

### 2.2 Subcollection: `users/{uid}/secure_payout_details/payout`
```typescript
interface SecurePayoutDocument {
  encryptedData: string;            // AES-256-GCM ciphertext (hex encoded)
  iv: string;                       // Initialization Vector (hex encoded)
  authTag: string;                  // Authentication Tag (hex encoded)
  updatedAt: FieldValue;
}
```

### 2.3 Collection: `products/{productId}`
```typescript
interface ProductDocument {
  id: string;
  title: string;
  description: string;
  section: 'society_fuckers' | 'valueless_bitches';
  tier: 'regular' | 'exclusive';
  price: number;                    // Base price in USD
  prebookingPrice?: number;         // Pre-book deposit price for Society Fuckers
  isPublished: boolean;
  images: string[];
  videos?: string[];
  printifyId?: string;              // Printify product blueprint ID
  variants: Array<{
    id: string;
    size: string;
    color: string;
    colorHex?: string;
    price: number;
    available: boolean;
    stock?: number;
  }>;
  createdAt: FieldValue;
}
```

### 2.4 Collection: `orders/{orderId}`
```typescript
interface OrderDocument {
  id: string;
  userId: string;                   // Firebase UID or "guest_timestamp"
  userEmail: string;
  items: Array<{
    productId: string;
    title: string;
    variant: { id: string; size: string; color: string; price: number };
    quantity: number;
    price: number;
    image: string;
    printifyProductId?: string;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentGateway: 'razorpay' | 'paypal';
  paymentCaptured: boolean;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paypalOrderId?: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  referralCode?: string | null;
  couponCode?: string | null;
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
  printifyOrderId?: string;
  trackingNumber?: string;
  createdAt: FieldValue;
}
```

### 2.5 Collection: `referrals/{referralId}`
```typescript
interface ReferralDocument {
  id: string;
  affiliateUid: string;             // Owner of the referral code
  referralCode: string;
  referredOrderIds: string[];      // Array of paid order IDs attached to code
  count: number;                    // Active referral order counter
  status: 'active' | 'eligible_for_claim' | 'claimed';
  lastMilestoneAt?: FieldValue;
  createdAt: FieldValue;
}
```

---

## 3. Security & Cryptographic Architecture

### 3.1 Session Token Management
* User authenticates via client SDK → exchanges ID token at `/api/auth/session` → receives HttpOnly, Secure, SameSite=Strict `session` cookie (valid for 14 days).
* Server endpoints verify cookie using `adminAuth.verifySessionCookie(session, true)`.
* On logout, `adminAuth.revokeRefreshTokens(uid)` immediately invalidates all active sessions server-side.

### 3.2 AES-256-GCM Payout Encryption
Bank details (Account No, IFSC, UPI ID, PayPal email) are encrypted before writing to Firestore:
```typescript
const key = Buffer.from(process.env.ENCRYPTION_SECRET_KEY, 'hex'); // 32 bytes
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(JSON.stringify(bankPayload), 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag().toString('hex');
```

### 3.3 Payment Webhook Signature Verification
* **Razorpay:** Computes HMAC-SHA256 hash using `process.env.RAZORPAY_WEBHOOK_SECRET` and compares signatures using `crypto.timingSafeEqual()` to prevent timing attacks.
* **PayPal:** Validates webhook signature by hitting PayPal's `/v1/notifications/verify-webhook-signature` REST endpoint.

---

## 4. Background Order & Printify Orchestration
Order processing is decoupled using a resilient background queue pattern (`src/lib/orchestrator/orderProcessor.ts`):
1. Payment webhook receives `payment.captured` signal.
2. Webhook marks order status as `paid` inside a Firestore transaction.
3. Invokes `processOrderFulfillment(orderId)`.
4. `orderProcessor` fetches order details, transforms shipping address into Printify recipient schema, and executes API POST to Printify.
5. Updates order doc with `printifyOrderId` and appends timeline audit logs.
