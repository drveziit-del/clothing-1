# GERKINK — Codebase Memory & Master Architectural Reference

> **Project**: GERKINK — Provocative Luxury Streetwear E-Commerce
> **Framework**: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
> **Last Updated**: 2026-08-12

---

## 1. Architecture Overview & Design Philosophy

**GERKINK** (`gerkink.shop`) is an anti-conformist, provocative luxury streetwear brand featuring an "ego-roast" brand personality built into every UI interaction. The site hosts two distinct collections (**Society Fu*kers** pre-book luxury tier and **Valueless Bi*ches** streetwear), an automated Print-on-Demand (Printify) fulfillment engine, dual payment routing (Razorpay for India/INR and PayPal REST v2 for International/USD), and a high-yield viral referral engine ($100 per 10 client referrals + $100k milestone reward).

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── layout.tsx          # Root layout (Providers, Navbar, Footer, EgoTicker)
│   ├── page.tsx            # Home page — Hero, Ego Ticker, Collection Grid, Manifesto
│   ├── globals.css         # Design system tokens (CSS variables, Tailwind 4 utilities)
│   ├── page.module.css     # Homepage CSS module & animations
│   ├── account/            # User account dashboard & encrypted bank payout form
│   ├── admin/              # Admin control panel (orders, products, payouts, settings)
│   ├── api/                # 14 Backend API modules (auth, payment, paypal, user, etc.)
│   ├── auth/               # Login & Register views
│   ├── cart/               # Shopping cart page
│   ├── checkout/           # 2-Step Shipping & Payment Checkout (Guest checkout supported)
│   ├── contact/            # Customer support form
│   ├── disclaimer/         # Satirical legal disclaimer ("No intention to harm")
│   ├── manifesto/          # Brand manifesto page
│   ├── owners/             # Anonymous owners page
│   ├── referral/           # $100 Referral Program page & anti-fraud rules
│   ├── refund/             # Returns & Replacement Policy
│   ├── shipping/           # Worldwide Express Shipping Policy
│   ├── shop/               # Catalog, Tier Pyramids, and Product Detail Pages (PDP)
│   ├── sitemap.ts          # Dynamic XML Sitemap generator
│   └── terms/              # Terms of Service page
├── components/
│   ├── admin/              # AdminSidebar, DataTable, MetricsCards
│   ├── checkout/           # RazorpayButton & PayPalMultiButton
│   ├── layout/             # Navbar, Footer, Mobile Drawer
│   ├── reviews/            # Star rating section, review modal & UGC video cards
│   ├── shop/               # ProductFilters, ProductGrid, TierPyramid
│   └── ui/                 # PriceTag, ProductCard, RoastToast, EgoTicker
├── context/
│   ├── AuthContext.tsx     # Firebase Auth state & user profile listener
│   ├── CartContext.tsx     # Cart state with localStorage persistence (useReducer)
│   └── CurrencyContext.tsx # Multi-currency state (USD, INR, EUR, GBP, CAD, AUD)
├── hooks/
│   ├── useAuth.ts          # Re-export of AuthContext
│   ├── useCart.ts          # Re-export of CartContext
│   ├── useCurrency.ts      # Re-export of CurrencyContext
│   └── useRoast.ts         # Ego-roast toast notification hook
├── lib/
│   ├── email/              # Nodemailer / Resend order confirmation email dispatch
│   ├── firebase/           # Client SDK config & Admin SDK (Lazy Proxy pattern)
│   ├── orchestrator/       # Printify fulfillment background worker (orderProcessor.ts)
│   ├── payment/            # Webhook signature verification helpers
│   ├── paypal/             # PayPal REST SDK v2 wrapper
│   ├── printify/           # Printify REST client & product sync
│   ├── razorpay/           # Razorpay SDK client (server-only)
│   ├── referral/           # ACID Firestore transaction referral processing engine
│   └── utils/              # AES-256 encryption, rate limiting, validation schemas
├── proxy.ts                # App route proxy (auth guards, admin checks)
└── types/
    └── index.ts            # TypeScript data models (User, Product, Order, Referral, etc.)
```

---

## 2. Tech Stack & Versioning Matrix

| Layer | Technology | Version | Rationale / Notes |
|:---|:---|:---|:---|
| **Framework** | Next.js | `16.x` | App Router, Turbopack, static pre-rendering (55 routes), Server Actions |
| **UI Library** | React | `19.x` | Client components with `'use client'`, concurrent rendering |
| **Styling** | Vanilla CSS + Tailwind v4 | Custom | CSS custom properties, glassmorphism, scoped animation keyframes |
| **Auth** | Firebase Auth + Admin SDK | `v13.x` | Email/password, Google OAuth, HttpOnly session cookies (14-day TTL) |
| **Database** | Firebase Firestore | Cloud | Real-time document DB, ACID transactions, subcollection security |
| **Storage** | Firebase Storage | Cloud | UGC video review clips, product imagery |
| **Payments** | Razorpay & PayPal REST v2 | SDK v2 | Domestic IN (INR) via Razorpay; International (USD) via PayPal |
| **Fulfillment** | Printify REST API | v1 | Automated print-on-demand submission & status sync |
| **Encryption** | Node.js `crypto` | Native | AES-256-GCM for affiliate bank & payout details |
| **Validation** | Zod | `v4.x` | Type-safe schema validation across API routes |

---

## 3. Core Subsystem Architecture Graphs

### 3.1 Authentication & Session Pipeline
```
[Client Sign-In (Firebase Auth)]
             │
             ▼
[ID Token Generated] ──POST /api/auth/session──► [Admin SDK: verifyIdToken]
                                                        │
                                                        ▼
[HttpOnly Cookie Issued] ◄──Set-Cookie: session=JWT ────┤
                                                        │
                                                        ▼
[Protected Endpoint] ◄──Session Verification ───────────┘
```

### 3.2 Payment, Referral & Printify Fulfillment Pipeline
```
[Customer Checkout]
        │
        ├──► INR (India) ──────► Razorpay Order API ──► Webhook (/api/payment/webhook)
        │                                                     │
        └──► USD (Int'l) ──────► PayPal REST API v2 ──► Webhook (/api/paypal/webhook)
                                                              │
                                                              ▼
                                               [Firestore ACID Transaction]
                                                              │
                                    ┌─────────────────────────┴─────────────────────────┐
                                    ▼                                                   ▼
                         [Referral Engine]                                   [Background Worker]
                     (referral/engine.ts)                                  (orderProcessor.ts)
                            │                                                           │
              (On every 10th sale: +$100)                                               ▼
                            │                                                 [Printify REST API]
                            ▼                                               (Submit Order Payload)
             [Mark Eligible for Claim]
```

### 3.3 Payout Detail Encryption Pipeline
```
[User Bank Input (Account / IFSC / PayPal / UPI)]
                       │
                       ▼
          [POST /api/user/bank Handler]
                       │
                       ▼
      [Node.js crypto: AES-256-GCM Cipher]
  (Key: ENCRYPTION_SECRET_KEY, random 12-byte IV)
                       │
                       ▼
  [Firestore Write: users/{uid}/secure_payout_details/payout]
  { encryptedData: "...", iv: "...", authTag: "..." }
```

---

## 4. Key Design Patterns & Engineering Directives

### 1. Lazy Proxy Pattern for SSR Safety
Both `lib/firebase/config.ts` (client) and `lib/firebase/admin.ts` (server) use JavaScript `Proxy` objects to lazily initialize Firebase SDKs. This prevents:
* **Client SDK**: `ReferenceError: location is not defined` during SSR (Firebase Auth SDK internally references `window.location`).
* **Admin SDK**: Crashes when environment variables are absent during build-time static page analysis.

### 2. Server-Only Enforcement
All server-side modules (`lib/firebase/admin.ts`, `lib/printify/client.ts`, `lib/razorpay/client.ts`, `lib/referral/engine.ts`) include `import 'server-only';` at the top to prevent accidental client-side JavaScript bundling.

### 3. Proxy (`src/proxy.ts`) Route Protection
Handles high-level route protection:
* **Public routes**: `/`, `/shop`, `/manifesto`, `/contact`, `/owners`, `/disclaimer`, `/referral`, `/shipping`, `/refund`, `/terms`, webhooks.
* **Auth-gated**: `/cart`, `/checkout`, `/account` → redirect to login if session is missing.
* **Admin-gated**: `/admin/*` → requires valid session cookie + `is_admin` cookie claim. Cryptographic verification is enforced inside `src/app/admin/layout.tsx`.

### 4. AES-256-GCM Payout Encryption
Bank account details, IFSC codes, PayPal emails, and UPI IDs submitted by affiliates are encrypted server-side using AES-256-GCM before writing to Firestore `users/{uid}/secure_payout_details/payout`.

### 5. Cart State Management
`CartContext.tsx` uses `useReducer` with localStorage hydration:
* Actions: `ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QTY`, `SET_REFERRAL`, `CLEAR`, `HYDRATE`.
* Persists to `gerkink_cart` localStorage key with `typeof window !== 'undefined'` SSR guards.

### 6. Referral Commission & Milestone Engine
* Every registered user gets a unique code: `GK-{hash}`.
* **$100 Commission:** On every 10th referred purchase (`newCount % 10 === 0`), awards $100 `totalEarnings` to affiliate and flags doc as `eligible_for_claim`.
* **$100,000 Milestone:** Unlocked at 10,000 client sales.
* **Anti-Fraud Rules:** Self-referrals permitted ("We only need sales"). Bot manipulation or fraud results in immediate account ban.

### 7. Reactive Multi-Currency System
Supports dynamic switching across USD ($), INR (₹), EUR (€), GBP (£), CAD ($), and AUD ($). Exchange rates are fetched from API with fallback local caching.

### 8. Atomic Order Locking & Confirmation
Utilizes Firestore atomic locks via `order_email_locks/{orderId}` to prevent race conditions and duplicate confirmation email dispatches from concurrent client redirects and webhooks.

---

## 5. Environment Variables Reference

### Client-side (`NEXT_PUBLIC_*`)
* `NEXT_PUBLIC_FIREBASE_*` — Firebase client configuration (API Key, Auth Domain, Project ID, Storage Bucket, Messaging Sender ID, App ID).
* `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gerkink.shop` — Authorized Auth Domain.
* `NEXT_PUBLIC_RAZORPAY_KEY_ID` — Razorpay client publishable key.
* `NEXT_PUBLIC_PAYPAL_CLIENT_ID` — PayPal REST client ID.

### Server-side (`server-only`)
* `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firebase Admin SDK.
* `ENCRYPTION_SECRET_KEY` — 32-byte hex secret key for AES-256-GCM payout detail encryption.
* `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — Razorpay server credentials.
* `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` — PayPal REST server credentials.
* `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID` — Printify API credentials.

---

## 6. Firestore Collections Reference Table

| Collection | Subcollection / Document | Purpose | Access Control |
|:---|:---|:---|:---|
| `users` | `{uid}` | User profiles, role, referral code, earnings | Owner read/write; Admin full |
| `users/{uid}` | `secure_payout_details/payout` | AES-256-GCM encrypted bank details | Admin SDK server-only |
| `products` | `{productId}` | Catalog items, tier, variants, images, Printify ID | Public read; Admin write |
| `orders` | `{orderId}` | Order records, line items, address, status | Owner/Guest read; Server write |
| `referrals` | `{referralId}` | Affiliate counters, order IDs, milestone status | Owner read; Server write |
| `coupons` | `{couponId}` | Store discount codes and affiliate rewards | Public validate; Admin write |
| `settings` | `global` / `copywriting` | Ticker roasts, site text, shipping charges | Public read; Admin write |
| `reviews` | `{reviewId}` | Live customer reviews & ratings | Public read; Authenticated write |

---

## 7. Development & Verification Commands

```bash
# Start development server (Turbopack)
npm run dev

# Run TypeScript compilation check
npx tsc --noEmit

# Run Next.js production build (55 routes)
npx next build

# Run 10-Referral Transaction Unit Test
node scripts/test-ten-referrals.js

# Run Single Referral Engine Unit Test
node scripts/test-process-referral.js
```

---

## 8. Historical Fix & Deployment Log (June – August 2026)

| Date | Subsystem | Description of Fix / Implementation |
|:---|:---|:---|
| **2026-08-11** | **Disclaimer Page** | Created `/disclaimer` page with satirical clauses ("No intention to harm"). |
| **2026-08-11** | **Referral Program** | Created `/referral` page with $100 per 10 sales & updated Anti-Fraud Rules text. |
| **2026-08-11** | **Privacy API** | Implemented `DELETE /api/user/delete` for PII and account deletion. |
| **2026-08-11** | **Security & CSP** | Added `'unsafe-inline'` to CSP `script-src` header in `next.config.ts`, fixing React Error #412. |
| **2026-08-10** | **PayPal REST v2** | Added PayPal REST v2 integration for international USD orders. |
| **2026-08-08** | **AES-256 Encryption** | Implemented AES-256-GCM encryption for bank details in `/api/user/bank`. |
| **2026-08-05** | **Multi-Currency** | Added reactive currency switcher (USD, INR, EUR, GBP, CAD, AUD). |
| **2026-08-01** | **Printify Worker** | Created `orderProcessor.ts` for automated print-on-demand order submission. |
