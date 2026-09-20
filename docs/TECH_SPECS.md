# GERKINK Technical Specifications & Architecture Document

## 1. Technology Stack & Infrastructure

| Layer | Technology / Framework | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) | Server-side rendering, static prerendering, Route Handlers |
| **Language** | TypeScript (Strict Mode) | Type-safe data models and backend contracts |
| **Styling** | Vanilla CSS Tokens + CSS Modules + Tailwind CSS v4 | Dark mode theme, glassmorphism, responsive bento grids |
| **Database** | Firebase Firestore (Google Cloud) | Real-time document DB, ACID transactions, security rules |
| **Auth** | Firebase Auth + Firebase Admin SDK v13 | Email/password, Google OAuth, HttpOnly session cookies |
| **Payment Gateways** | Razorpay SDK (India/INR) & PayPal REST v2 (International/USD) | Multi-currency checkout, webhook signature verification |
| **Fulfillment** | Printify REST API v1 | Automated print-on-demand submission & order sync |
| **Email** | Google SMTP Transport / Nodemailer | Order confirmations, payout status, studio alerts |
| **Encryption** | Node.js `crypto` (AES-256-GCM + scrypt) | Server-side encryption of affiliate bank & payout details |

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
  referralCount: number;            // Count of active qualifying referrals
  totalEarnings: number;            // Accumulated USD earnings from referrals ($100 per 10 sales)
  claimedEarnings: number;          // Total USD paid out
  customerNumber?: number;          // Sequential customer number (1..N)
  isFounding500?: boolean;          // True for orders within initial 500 founding allocation
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
  tier: 'regular' | 'exclusive' | 1 | 2 | 3 | 4;
  price: number;                    // Base price in USD
  prebookingPrice?: number;         // Pre-book deposit price for Society Fu*kers
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
  paymentGateway: 'razorpay' | 'paypal' | 'free' | 'wire';
  paymentCaptured: boolean;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paypalOrderId?: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'awaiting_wire_confirmation' | 'expired';
  isPrebooking?: boolean;
  tier?: number;
  referralCode?: string | null;
  couponCode?: string | null;
  customerNumber?: number;
  isFounding500?: boolean;
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
  expiresAt?: Date;
  emailSent?: boolean;
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
  payoutMethod?: string;
  payoutDetail?: string;            // Links to payout_requests document
  lastMilestoneAt?: FieldValue;
  createdAt: FieldValue;
}
```

### 2.6 Collection: `payout_requests/{requestId}`
```typescript
interface PayoutRequestDocument {
  id: string;
  userId: string;                   // Affiliate UID
  userEmail: string;
  userName: string;
  amount: number;                   // USD amount (e.g. 100)
  method: 'bank' | 'paypal' | 'upi' | 'wire';
  status: 'pending' | 'paid_manual' | 'rejected' | 'processed';
  adminNote?: string | null;
  paidBy?: string;
  paidAt?: FieldValue;
  rejectedBy?: string;
  rejectedAt?: FieldValue;
  createdAt: FieldValue;
  updatedAt?: FieldValue;
}
```

### 2.7 Collection: `customDesignRequests/{requestId}`
```typescript
interface CustomDesignDocument {
  id: string;
  userId: string;
  userEmail: string;
  ideaDescription: string;
  productType: 'hoodie' | 'tshirt' | 'sweatshirt' | 'jacket';
  size: string;
  color: string;
  budgetTier: 'ready_to_wear' | 'bespoke' | 'couture';
  status: CustomDesignStatus;
  adminNotes?: string;
  finalPrice?: number;
  statusHistory: Array<{
    from: string;
    to: string;
    actor: 'user' | 'admin' | 'system';
    actorId: string;
    timestamp: string;
    reason: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

### 2.8 Collection: `reviews/{reviewId}`
```typescript
interface ReviewDocument {
  id: string;
  productId: string;
  rating: number;                   // 1 to 5
  reviewText: string;
  authorName: string;
  authorEmail?: string;
  orderId?: string;
  verifiedPurchase: boolean;
  status: 'pending' | 'approved' | 'rejected';
  featured?: boolean;
  mediaUrls?: string[];
  helpfulCount: number;
  createdAt: FieldValue;
  updatedAt?: FieldValue;
}
```

### 2.9 Collection: `coupons/{couponId}`
```typescript
interface CouponDocument {
  id: string;
  code: string;                     // Uppercase alphanumeric (e.g. "VIP20")
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  usageCount: number;
  usageLimit?: number | null;
  minSpend?: number;
  isGlobal?: boolean;
  userId?: string | null;
  isActive: boolean;
  expiresAt?: Date | null;
  createdAt: FieldValue;
}
```

---

## 3. Security & Cryptographic Architecture

### 3.1 Session Token Management
* User authenticates via client SDK → exchanges ID token at `/api/auth/session` → receives HttpOnly, Secure, SameSite=Strict `session` cookie (valid for 14 days).
* Server endpoints verify cookie using `adminAuth.verifySessionCookie(session, true)`.
* On logout, `adminAuth.revokeRefreshTokens(uid)` immediately invalidates active sessions server-side.

### 3.2 AES-256-GCM Payout Encryption
Bank details (Account No, IFSC, UPI ID, PayPal email) are encrypted before writing to Firestore:
```typescript
// Key derived from ENCRYPTION_KEY using scrypt
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'gerkink_encryption_salt_123', 32);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(cleartext, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag().toString('hex');
```

### 3.3 Timing-Safe Webhook Signatures
All webhook and token signature comparisons utilize `crypto.timingSafeEqual()`:
* **Razorpay:** HMAC-SHA256 of payload against `RAZORPAY_WEBHOOK_SECRET`.
* **Printify:** HMAC-SHA256 of payload against `PRINTIFY_WEBHOOK_SECRET`.
* **PayPal:** OAuth token exchange + transmission verification via PayPal API.

---

## 4. Custom Design Finite State Machine (FSM)

The Bespoke Luxury Custom Design workflow follows strict transition invariants defined in `src/lib/custom-design/stateMachine.ts`:

```
DRAFT ──► PAYMENT_PENDING ──► PAYMENT_PROCESSING ──► SUBMITTED ──► UNDER_REVIEW
                                                                      │
      ┌───────────────────────────────────────────────────────────────┴───────────────┐
      ▼                                                                               ▼
NEEDS_INFORMATION                                                            DESIGN_IN_PROGRESS
      ▲                                                                               │
      └───────────────────────────────────────────────────────────┬───────────────────┘
                                                                  ▼
                                                      CUSTOMER_APPROVAL_REQUIRED
                                                                  │
                                                                  ▼
                                                               APPROVED
                                                                  │
                                                                  ▼
                                                         READY_FOR_PRODUCTION
                                                                  │
                                                                  ▼
                                                            IN_PRODUCTION
                                                                  │
                                                                  ▼
                                                              FULFILLED
```
*Any illegal state skip (e.g. `SUBMITTED` -> `IN_PRODUCTION`) is rejected with HTTP 400 Bad Request.*

---

## 5. Background Fulfillment & Resiliency

Order processing is decoupled using a resilient background worker pattern (`src/lib/orchestrator/orderProcessor.ts`):
1. Webhook or verification handler receives successful payment confirmation.
2. Marks order status as `paid` inside an ACID transaction.
3. Allocates sequential customer number (1..N) and founding badge (`allocateCustomerNumber`).
4. Dispatches order confirmation email via idempotent lock (`sendOrderConfirmationEmailsOnce`).
5. Submits order to Printify REST API (`createPrintifyOrder`).
6. Appends structured history event to `order.history` array.

---

## 6. Account Deletion & Data Retention Specification

The customer account self-deletion engine (`DELETE /api/account` and `src/lib/account/deletion.ts`) enforces strict data classification rules balancing user privacy erasure against accounting, tax, and anti-fraud record retention:

| Category | Collections / Resources | Policy | Mechanism & Field Level Handling |
|---|---|:---:|---|
| **User Profile & PII** | `users/{uid}`, `users/{uid}/secure_payout_details` | **DELETE** | Document deleted; encrypted bank records wiped. |
| **Auth Credentials** | Firebase Authentication | **DELETE** | `adminAuth.revokeRefreshTokens(uid)` + `adminAuth.deleteUser(uid)`. Session cookies invalidated (`maxAge: 0`). |
| **User Storage** | `users/${uid}/*`, `custom-design/${uid}/*` | **DELETE** | Avatars and custom design concept uploads deleted from Cloud Storage. |
| **Personal Coupons** | `coupons` where `userId == uid` | **DELETE** | User-specific reward and promo codes deleted. |
| **Reviews & Ratings** | `reviews` where `userId == uid` | **ANONYMIZE** | `userId: 'deleted_account'`, `userName: 'Former Customer'`, `userEmailMasked: null`, `accountDeleted: true`. Ratings preserved for public catalog score integrity. |
| **Affiliate Referrals** | `referrals` where `affiliateUid == uid` | **ANONYMIZE** | `accountDeleted: true`, `anonymizedAt: timestamp()`. Status updated to `ineligible_account_deleted`. |
| **Affiliate Payouts** | `payout_requests` where `userId == uid` | **RETAIN AUDIT** | *Pending payouts strictly block deletion (HTTP 409 Conflict).* Processed payouts retain amounts; bank details wiped to `[REDACTED_ACCOUNT_DELETED]`. |
| **Orders & Payments** | `orders` where `userId == uid` | **RETAIN AUDIT** | Order total, items, sequence counter (#/500), payment IDs, and fulfillment state retained for tax compliance. `accountDeleted: true`, `userEmailMasked` set. |
| **Custom Design Records** | `customDesignRequests` where `userId == uid` | **RETAIN AUDIT** | Manufacturing history and prepayment amounts retained; personal contact email masked (`customerEmailMasked`). |
| **Email Logs** | `system_emails` where `to == email` | **ANONYMIZE** | Recipient email masked (`userEmailMasked`); dispatch timestamp and template retained for delivery verification. |

---

## 7. Global Network-Status Indicator & Offline Resilience Specification

The platform implements a global client-side network monitoring engine and visual indicator (`NetworkStatusProvider` and `NetworkStatusPill`) to ensure users recognize connection health and to protect mutating transactions during network interruptions:

### 7.1 Architecture & Detection Dual-Rail
1. **Local Connectivity:** Listens to window `online` and `offline` events with `navigator.onLine` initialization.
2. **Server Availability Probing:** Actively verifies true backend reachability via lightweight `GET /api/health` probes. Separates local WiFi connection from server responsiveness (status `degraded` / `reconnecting`).
3. **Heartbeat & Resync:** Automatic health checks trigger on tab reactivation (`document.visibilitychange`), window `focus`, and an un-intrusive 45-second fallback heartbeat.
4. **Transition Dynamics:** On reconnection, states pulse with `back_online` for 3.5 seconds before settling to normal minimal display.

### 7.2 Component Specification (`NetworkStatusPill`)
- **Desktop:** Pinned to `bottom: 1.5rem; left: 1.5rem; z-index: 99999;` (clears toast alerts at bottom-right).
- **Mobile:** Positioned at `bottom: calc(5rem + env(safe-area-inset-bottom)); left: 1rem;` (clears top sticky navbar and bottom checkout action bar).
- **Accessibility:** Built with `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`.
- **States:** 🟢 `ONLINE`, 🔴 `OFFLINE` (with interactive retry), 🟢 `BACK ONLINE`, 🟡 `RECONNECTING`.

### 7.3 Mutating Action Form Guards
When offline, server mutations are safely disabled while cached/loaded catalog browsing remains accessible:
- **Checkout (`/checkout`):** Address submission and free order creation disabled with offline banners.
- **PayPal & Cards (`PayPalMultiButton`):** Order creation blocked; buttons set to `pointer-events: none` with opacity reduction.
- **Customer Reviews (`WriteReviewModal`):** Review submission blocked; submit button disabled with reconnect prompt.
- **Atelier Custom Design (`/custom-design`):** Prepayment authorization blocked; step 3 displays offline alert.
- **Account Deletion (`DeleteAccountModal`):** Reauthentication and deletion blocked with offline warning.

