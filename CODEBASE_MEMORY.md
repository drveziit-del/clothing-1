# GERKINK — Codebase Memory File

> **Project**: GERKINK — Provocative Luxury Streetwear E-Commerce
> **Framework**: Next.js 16.2.9 (App Router) + React 19.2.4
> **Last Updated**: 2026-08-07

---

## Architecture Overview

GERKINK is a provocative luxury streetwear brand with an "ego-roast" personality baked into every UI interaction. The site features two product collections (**Society Fuckers** $1K–$10M tier and **Valueless Bitches** streetwear), a referral/affiliate system, Razorpay payments, and Printify fulfillment — all wrapped in a dark, brutalist design aesthetic.

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (providers, Navbar, Footer)
│   ├── page.tsx            # Home page ('use client') — hero, ego ticker, split panels
│   ├── globals.css         # Full design system (CSS custom properties, Tailwind 4 for utilities)
│   ├── page.module.css     # Home page styles (now includes local keyframe animations)
│   ├── account/            # User account dashboard + referral stats
│   ├── admin/              # Admin panel (products, orders, settings)
│   ├── api/                # API routes (auth, payment, contact, printify, admin)
│   │   ├── auth/           # Session cookie management + logout
│   │   ├── payment/        # Razorpay order creation, verification, free order verification, webhook
│   │   ├── printify/       # Printify webhook handler
│   │   ├── contact/        # Contact form submission
│   │   ├── referral/       # Referral claims (/claim) and click tracking (/click)
│   │   └── admin/          # Admin CRUD (products, orders, sync, settings, copywriting)
│   ├── auth/               # Login + Signup pages
│   ├── cart/               # Shopping cart
│   ├── checkout/           # Checkout flow
│   ├── contact/            # Contact page
│   ├── manifesto/          # Brand manifesto page
│   ├── owners/             # Anonymous owners page
│   └── shop/               # Shop pages (product listing, detail, collection pages)
├── components/
│   ├── admin/              # AdminSidebar, DataTable, MetricsCards
│   ├── checkout/           # RazorpayButton (loads Razorpay SDK dynamically)
│   ├── layout/             # Navbar, Footer, ThemeToggle
│   ├── shop/               # ProductFilters, ProductGrid, TierPyramid
│   └── ui/                 # Button, EgoTicker, LoadingScreen, Modal, PriceTag, ProductCard, RoastToast
├── context/
│   ├── AuthContext.tsx      # Firebase Auth state + Firestore user profile subscription
│   ├── CartContext.tsx      # Cart state with localStorage persistence (useReducer)
│   └── ThemeContext.tsx     # Dark/light theme toggle with localStorage
├── hooks/
│   ├── useAuth.ts           # Re-export of AuthContext
│   ├── useCart.ts           # Re-export of CartContext
│   ├── useRoast.ts          # Toast notification system for ego-roast messages
│   └── useTheme.ts          # Re-export of ThemeContext
├── lib/
│   ├── firebase/
│   │   ├── admin.ts         # Firebase Admin SDK (server-only, lazy Proxy pattern)
│   │   ├── auth.ts          # Client auth functions (signup, login, Google, signOut, session cookies)
│   │   └── config.ts        # Firebase client SDK initialization (lazy Proxy pattern for SSR safety)
│   ├── printify/
│   │   ├── client.ts        # Printify API client (server-only)
│   │   └── sync.ts          # Product sync from Printify → Firestore
│   ├── razorpay/
│   │   └── client.ts        # Razorpay server SDK client (server-only)
│   ├── referral/
│   │   └── engine.ts        # Referral commission engine ($50/10 referrals + $100K milestone)
│   └── utils/
│   │   ├── roasts.ts        # Curated ego-roast message pools (ticker, hover, cart, login, etc.)
│   │   └── validation.ts    # Zod schemas for auth, checkout, contact, admin
├── proxy.ts                 # Request proxy (auth guards, admin checks) — renamed from middleware.ts
└── types/
    └── index.ts             # All TypeScript interfaces (User, Product, Order, Cart, Referral, etc.)
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.2.9 | App Router, `proxy.ts` convention (not middleware) |
| UI | React 19.2.4 | Client components with `'use client'` directive |
| Styling | CSS Modules + globals.css | Custom design system, Tailwind 4 for utilities only |
| Auth | Firebase Auth + Admin SDK | Email/password + Google OAuth, session cookies |
| Database | Firestore | Users, products, orders, referrals, settings, milestones |
| Storage | Firebase Storage | Product images |
| Payments | Razorpay | Server-side order creation, client checkout, webhook verification |
| Fulfillment | Printify | Product sync, order forwarding, webhook tracking |
| Validation | Zod 4.4.3 | All input validation (auth, checkout, admin) |
| TypeScript | 5.x | Strict mode |

---

## Key Design Patterns

### 1. Lazy Proxy Pattern for SSR Safety
Both `lib/firebase/config.ts` (client) and `lib/firebase/admin.ts` (server) use JavaScript `Proxy` objects to lazily initialize Firebase SDKs. This prevents:
- **Client SDK**: `ReferenceError: location is not defined` during SSR (Firebase Auth SDK internally references `window.location`)
- **Admin SDK**: Crashes when env vars are absent during build-time static analysis

### 2. Server-Only Enforcement
All server-side modules (`lib/firebase/admin.ts`, `lib/printify/client.ts`, `lib/razorpay/client.ts`, `lib/referral/engine.ts`) import `'server-only'` to prevent accidental client-side bundling.

### 3. Proxy (formerly Middleware) Auth Flow
`src/proxy.ts` handles route protection:
- **Public routes**: `/`, `/shop`, `/manifesto`, `/contact`, `/owners`, `/shop/*`, webhooks
- **Auth-gated**: `/cart`, `/checkout`, `/account`, `/referral` → redirect to login
- **Admin-gated**: `/admin/*` → requires session cookie + `is_admin` cookie flag
- Full cryptographic JWT verification is done inside the admin layout server component (proxy only does lightweight cookie checks)

### 4. CSS Design System (globals.css)
- Dark-mode-first with `data-theme` attribute switching
- Color tokens: Void Black → Ash → Fog → Smoke → Mist Blue → Coral Pink → Chalk
- Typography: Space Grotesk (display), Inter (body), JetBrains Mono (prices)
- CSS Module Animation Scoping: CSS Module files (e.g. `EgoTicker.module.css`, `Modal.module.css`, etc.) declare keyframes locally rather than globally to prevent Next.js scoping/hashing compiler mismatches.
- Utility classes: `.btn-*`, `.card`, `.card-glass`, `.tag-*`, `.input`, `.container`, `.section-pad`

### 5. Cart State Management
`CartContext.tsx` uses `useReducer` with localStorage hydration:
- Actions: ADD_ITEM, REMOVE_ITEM, UPDATE_QTY, SET_REFERRAL, CLEAR, HYDRATE
- Max quantity per item: 10
- Persists to `gerkink_cart` localStorage key
- SSR-safe with `typeof window` guard

### 6. Referral System
- Every user gets a unique code: `GERK-{uid_prefix}{random_6}`
- $50 commission per 10 referrals
- $100,000 milestone at 10,000th global customer
- Self-referral and duplicate-referral prevention
- Min order value: $100 USD

### 7. Reactive Multi-Currency System
- Supports dynamic switching between USD ($) and INR (₹).
- Pricing changes are reactive globally (headers, product listing/detail cards, and the entire admin analytics suite).

### 8. Atomic Order Locking & Confirmation
- Utilizes Firestore atomic locks via `order_email_locks/{orderId}`.
- Prevents race conditions and duplicate email dispatches from concurrent client redirects and webhooks.

---

## Environment Variables

### Client-side (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config (6 vars)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — Razorpay publishable key
- `NEXT_PUBLIC_BASE_URL` — Production URL for metadataBase (defaults to `https://gerkink.com`)

### Server-side
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Admin SDK
- `PRINTIFY_ACCESS_TOKEN`, `PRINTIFY_SHOP_ID` — Printify API
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — Razorpay

---

## Known Patterns & Gotchas

1. **Proxy vs Middleware**: Next.js 16 renamed `middleware.ts` → `proxy.ts` and `export function middleware()` → `export function proxy()`. The old convention is deprecated.

2. **CSS Import Order**: `@import url(...)` for Google Fonts MUST come before `@import "tailwindcss"` in `globals.css` per CSS spec.

3. **Firebase SSR**: The Firebase client SDK references `location` internally. The config module uses Proxy objects to defer initialization until client-side access.

4. **`'use client'` doesn't prevent SSR**: Client components are still server-rendered for the initial HTML. Any browser API access must be inside `useEffect` or guarded with `typeof window !== 'undefined'`.

5. **Firestore Security Rules**: Defined in `firestore.rules` at project root. Covers users, products, orders, referrals, milestones, settings, and contact_messages collections.

6. **Content Content Security Policy**: Configured in `next.config.ts` headers — allows Razorpay checkout, Google Auth, Firebase, Printify image domains.

7. **Product Sections**: Two collections — `society_fuckers` (tiered luxury $1K–$10M) and `valueless_bitches` (streetwear). The tier system (1-5) only applies to Society Fuckers.

---

## Firestore Collections

| Collection | Purpose | Key Fields |
|-----------|---------|------------|
| `users` | User profiles | uid, email, role, referralCode, referralCount, totalEarnings, linkClicks |
| `products` | Product catalog | printifyId, section, price, tier, variants[], images[] |
| `orders` | Order records | userId, items[], status, razorpayOrderId, shippingAddress, couponCode |
| `referrals` | Referral events | affiliateUid, referredUid, orderId, commission, status, claimedAt, payoutMethod |
| `coupons` | Affiliate discount codes | id, code, affiliateUid, value, isUsed, createdAt, usedAt |
| `milestones` | $100K milestone records | affiliateUid, reward, status |
| `settings` | Global settings & copy | (doc `global`): siteActive, etc. (doc `copywriting`): homepage hero lines, manifesto grid list, owners details, footer tagline |
| `contact_messages` | Contact form submissions | name, email, message |
| `reviews` | Live customer reviews & ratings | userId, userName, userPhoto, rating, text, createdAt |

---

## Build & Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

---

## Recent Fixes & Deployments (July & August 2026)

| Fix / Feature | Component / File | Change |
| ----- | ------ | -------- |
| **Multi-Currency System** | `src/components/*`, `src/app/admin/*` | Implemented reactive storefront and admin panel currency conversion (USD/INR) for analytics, product pricing, and referrals tracking. |
| **Server Coupon Validation** | `src/app/api/coupons/validate/*` | Created a dedicated server API endpoint for secure coupon application, checking validation rules and scope configurations (Subtotal Only vs Grand Total). |
| **Address & ISO Standardization** | `src/lib/printify/*`, `src/app/admin/*` | Added full country/state normalization to 2-letter ISO 3166-1 alpha-2 codes for Printify API compliance, with an admin "1-click punch to Printify" manual trigger. |
| **Email Dispatch De-duplication** | `src/lib/email/*` | Integrated atomic `order_email_locks` to guarantee order confirmation emails are sent exactly once under concurrent redirection and webhook invocations. |
| **Reviews Endpoint Routing** | `src/app/api/reviews/*`, `src/components/reviews/*` | Routed reviews creation and deletions through a secure server-side bridge API to prevent Firestore security rule permission errors. |
| **Firebase App Hosting Configuration** | `apphosting.yaml` | Created and configured `apphosting.yaml` to specify serverless parameters (CPU/Memory) and bind production client variables alongside Secret Manager bindings. |
| **UI Aesthetics & Light Theme Refinements** | `src/app/globals.css`, `src/components/*` | Added light-theme contrast overrides, fixed filled star rating button specificity, and set up official Instagram and Twitter/X handles. |

---

## Historical Fixes (June 2026)

| Fix | File | Change |
|-----|------|--------|
| CSS Module Animations | `*.module.css` | Localized keyframe definitions inside CSS Modules to prevent scoped/unscoped name mismatches (fixed Ego Ticker scroll, modals, loading bars, float, and glitch effects). |
| Settings In-Place Editing | `src/app/admin/settings/*` | Added text inputs to allow administrators to edit existing roasts directly in-place, and resolved dashboard clipping using scrolling layout boundaries. |
| Admin Auth Hardening | `src/app/admin/layout.tsx` | Restrained admin routing through Firebase auth custom claims (`{ admin: true }`), resolving security concerns by not hardcoding admin emails inside codebase files. |
| Proxy rename | `src/middleware.ts` → `src/proxy.ts` | Function renamed `middleware()` → `proxy()` |
| CSS import order | `src/app/globals.css` | Google Fonts `@import` moved before `@import "tailwindcss"` |
| SSR location guard | `src/lib/firebase/config.ts` | Lazy Proxy pattern defers Firebase init to prevent SSR `location` error |
| metadataBase | `src/app/layout.tsx` | Added `metadataBase: new URL(...)` for OG/Twitter image resolution |
| Manual Claims | `src/app/api/referral/claim/*` | Added manual claim flow enabling affiliates to select order refunds or store discount coupons. |
| Checkout Coupons | `src/app/checkout/*` | Added coupon validation, summaries, and $0 free checkouts bypassing Razorpay. |
| Dashboard Analytics | `src/app/account/*`, `src/app/admin/*` | Added clicks tracking, leaderboards, revenue contributions, and progress gauges. |
| Copywriting Editor | `src/app/admin/settings/*` | Moved all static headlines, manifesto texts, and footer taglines to Firestore, making them editable in settings tabs. |
| Referral Query Index Fix | `src/app/api/referral/claim/route.ts` | Removed `orderBy` in Firestore referrals claim queries to bypass composite index requirement and resolve FAILED_PRECONDITION 500 crashes. Verified successfully with E2E test runner. |
| Firestore Rules Deployment | `firestore.rules`, `firebase.json` | Deployed correct Firestore rules that permit public reads to Settings and Products collections, resolving client permission-denied errors. |
| Snapshot Listener Error Isolation | `src/app/page.tsx`, `src/components/layout/Footer.tsx` | Added proper error callbacks to `onSnapshot` listeners to prevent uncaught console exceptions for unauthenticated homepage queries. |
| Dashboard Date & Sort Fix | `src/app/account/page.tsx` | Implemented `formatFirestoreDate()` and `getTimestampTime()` helpers to parse Firestore `Timestamp` objects correctly, fixing "Invalid Date" text and sorting in payout history. |
| Checkout SSR Redirect Fix | `src/app/checkout/page.tsx`, `src/lib/firebase/config.ts` | Wrapped empty-cart redirect in client-only `useEffect` on mount. Hardened `createLazyProxy()` to ignore framework property access checks (e.g. `$$typeof`, `then`), preventing `ReferenceError: location is not defined` during SSR page prerendering. |
| Webhook Fallback & Idempotency | `src/app/api/payment/webhook/route.ts` | Implemented full Printify submission and referral processing inside the Razorpay Webhook to capture offline redirection states, guarded by status idempotency checks. |
| Printify Webhook HMAC | `src/app/api/printify/webhook/*` | Hardened printify webhook with HMAC-SHA256 signature verification and created a CLI helper script (`scripts/register-printify-webhook.js`) to programmatically register subscriptions. |
| Product & Card Sizing Layouts | `src/app/shop/*`, `src/components/*` | Capped product gallery image layout at 1:1 aspect ratio and `object-fit: contain` to prevent viewport overflow, and adjusted product grid/cards. |
| Live Reviews System | `src/app/page.tsx`, `src/components/reviews/*` | Integrated live reviews section with interactive star selector, add/edit modal forms, real-time Firestore synchronization, and rules allowing users edit access and admins deletion rights. |
| Profile settings Hub | `src/app/account/*`, `src/app/page.module.css` | Created a Profile settings tab inside the account dashboard to support profile image upload to Firebase Storage, name updates, and password changes, leaving email read-only. |
| Legal & Support Pages | `src/app/terms/*`, `src/app/refund/*`, `src/app/shipping/*`, `src/components/layout/Footer.tsx` | Added Terms & Conditions, Refund & Replace Policy (no refunds, replacements via email), and Shipping Info (14 business days delivery) pages, with footer links and a responsive 4-column footer layout. |
| Custom Product Variants Manager | `src/app/admin/products/new/*`, `src/app/api/admin/products/*` | Added Variants Manager supporting custom colors (with name + hex), sizes, pricing, and availability matrix. |
| Unlimited Referrals | `src/lib/referral/*` | Removed duplicate referral purchase checks so repeat orders can generate affiliate commissions. |


