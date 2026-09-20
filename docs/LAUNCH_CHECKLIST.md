# GERKINK Pre-Launch Readiness Checklist

This checklist verifies all security, operational, domain, and technical requirements before deploying **GERKINK** (`gerkink.shop`) to live production.

---

## 1. Environment & Secret Safety Checklist

- [x] **Zero Hardcoded Secrets in Source:** Confirmed zero secret literals, private key strings, or database credentials exist in tracked source code files.
- [x] **`server-only` Package Enforcement:** Verified all modules importing private secrets (`FIREBASE_SERVICE_ACCOUNT`, `ENCRYPTION_KEY`, `RAZORPAY_KEY_SECRET`, `PAYPAL_CLIENT_SECRET`, `PRINTIFY_ACCESS_TOKEN`) include `import 'server-only';`.
- [x] **Production `.env` / Cloud Secret Manager Variables Configured:**
  - [x] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gerkink.shop`
  - [x] `ENCRYPTION_KEY` (Strong secret string for scrypt AES-256-GCM derivation)
  - [x] `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`
  - [x] `RAZORPAY_WEBHOOK_SECRET`
  - [x] `NEXT_PUBLIC_PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`
  - [x] `PAYPAL_WEBHOOK_ID`
  - [x] `PRINTIFY_ACCESS_TOKEN` & `PRINTIFY_SHOP_ID`
  - [x] `PRINTIFY_WEBHOOK_SECRET`
  - [x] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  - [x] `ADMIN_EMAIL` & `CUSTOM_DESIGN_ALERT_EMAIL`

---

## 2. Domain & Authentication Configuration

- [x] **Google Cloud Console OAuth Setup:**
  - [x] App Name set to `GERKINK`.
  - [x] `gerkink.shop` added under **Authorized Domains**.
- [x] **Firebase Authentication Setup:**
  - [x] `gerkink.shop` added to **Authorized Domains** list in Firebase Auth Settings.
  - [x] OAuth redirect handlers configured for Google sign-in.
  - [x] HttpOnly `session` cookie verification tested server-side via `adminAuth.verifySessionCookie`.

---

## 3. Webhook & Payment Gateway Audits

- [x] **Razorpay Live Webhook Endpoint:** Pointed to `https://gerkink.shop/api/payment/webhook` with `payment.captured` event listener.
- [x] **PayPal REST Live Webhook Endpoint:** Pointed to `https://gerkink.shop/api/paypal/webhook` with `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` listeners.
- [x] **Printify Webhook Endpoint:** Pointed to `https://gerkink.shop/api/printify/webhook` with `x-pfy-signature` verification.
- [x] **Timing-Safe Signature Comparison:** Webhooks utilize `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

---

## 4. Security Headers & CSP Validation

- [x] **Security Headers Configured (`next.config.ts`):**
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] **Content Security Policy (CSP):** Strict CSP configured with domain whitelists for Razorpay, PayPal, Google Fonts, Firebase Storage, and Printify CDN. `'unsafe-eval'` conditionally omitted in production.

---

## 5. Master Phase Audit Status

- [x] **Phase 1 — Project Foundation & Architecture:** Certified ✅
- [x] **Phase 2 — Payment Gateway Integrity (Razorpay + PayPal):** Certified ✅
- [x] **Phase 3 — Inventory & Concurrency Locking:** Certified ✅
- [x] **Phase 4 — Bespoke Luxury Custom Design Atelier:** Certified ✅
- [x] **Phase 5 — Customer Reviews & UGC System:** Certified ✅
- [x] **Phase 6 — Referral Engine & Milestone Payouts:** Certified ✅
- [x] **Phase 7 — Coupons & Discount Engine:** Certified ✅
- [x] **Phase 8 — Email Notification Infrastructure:** Certified ✅
- [x] **Phase 9 — End-to-End Cart & Checkout Loop:** Certified ✅
- [x] **Phase 10 — UI & Accessibility (CDP Network Loop Closed):** Certified ✅
- [x] **Phase 11 — Admin Reliability (RBAC & ACID Payouts):** Certified ✅
- [x] **Phase 12 — Documentation & Sensitive Artifacts:** Certified ✅
- [x] **Pre-Phase 14 Hardening — Account Deletion & Global Network-Status:** PASS ✅
- [x] **Phase 14 — Production Smoke Testing (https://gerkink.shop):** Certified PASS ✅ (24/24 assertion units across 22 production checkpoints passed; live cryptographic webhooks, TLS, headers, payment input gates, and zero sandbox leakage confirmed)
- [x] **Phase 15 — Final Production Certification & Transactional Audit:** Certified PASS ✅ (11/11 live audit assertions passed; live settlement, Printify queue lease, account-deletion lifecycle purge, financial record retention, and empirical latency benchmarks verified on https://gerkink.shop)

---

## 6. Build & Compilation Verification

- [x] **TypeScript Check:** Executed `npx tsc --noEmit` — 0 errors.
- [x] **ESLint Audit:** Executed `npm run lint` — 0 errors, 0 warnings.
- [x] **Next.js Production Build:** Clean build with all routes compiled and prerendered.
