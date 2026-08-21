# GERKINK Pre-Launch Readiness Checklist

This checklist verifies all security, operational, domain, and technical requirements before deploying **GERKINK** (`gerkink.shop`) to live production.

---

## 1. Environment & Secret Safety Checklist

- [x] **Zero Hardcoded Secrets in Source:** Confirmed zero secret literals, API key strings, or database credentials exist in source code files.
- [x] **`server-only` Package Enforcement:** Verified all modules importing private secrets (`FIREBASE_SERVICE_ACCOUNT`, `ENCRYPTION_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, `PAYPAL_CLIENT_SECRET`, `PRINTIFY_API_TOKEN`) include `import 'server-only';`.
- [x] **Production `.env` Variables Set:**
  - [x] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gerkink.shop`
  - [x] `ENCRYPTION_SECRET_KEY` (32-byte hex string set)
  - [x] `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`
  - [x] `RAZORPAY_WEBHOOK_SECRET`
  - [x] `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`
  - [x] `PRINTIFY_API_TOKEN` & `PRINTIFY_SHOP_ID`

---

## 2. Domain & Authentication Configuration

- [x] **Google Cloud Console OAuth Setup:**
  - [x] App Name set to `GERKINK`.
  - [x] `gerkink.shop` added under **Authorized Domains**.
- [x] **Firebase Authentication Setup:**
  - [x] `gerkink.shop` added to **Authorized Domains** list in Firebase Auth Settings.
  - [x] OAuth redirect handlers configured for Google sign-in.

---

## 3. Webhook & Payment Gateway Audits

- [x] **Razorpay Live Webhook Endpoint:** Pointed to `https://gerkink.shop/api/payment/webhook` with `payment.captured` event listener.
- [x] **PayPal REST Live Webhook Endpoint:** Pointed to `https://gerkink.shop/api/paypal/webhook` with `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` listeners.
- [x] **Timing-Safe Signature Comparison:** Webhooks utilize `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

---

## 4. Security Headers & CSP Validation

- [x] **Security Headers Configured (`next.config.ts`):**
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [x] **Content Security Policy (CSP):** `script-src` includes `'unsafe-inline'` to support Next.js client hydration and dynamic schema scripts without triggering browser CSP errors or React Error #412.

---

## 5. Verification Scripts & Integration Tests

- [x] **10-Referral Transaction Engine Test:** Executed `node scripts/test-ten-referrals.js` — verified 10 client orders unlock $100 `totalEarnings` and flag referral doc `eligible_for_claim`.
- [x] **Single Referral Engine Test:** Executed `node scripts/test-process-referral.js` — verified Firestore transactions update order count cleanly.
- [x] **Account Deletion Test:** Verified `DELETE /api/user/delete` removes user record, payout details subcollection, clears cookies, and revokes refresh tokens.

---

## 6. Build & Compilation Verification

- [x] **TypeScript Check:** Executed `npx tsc --noEmit` — 0 errors.
- [x] **Next.js Production Build:** Executed `npx next build` — **55/55 routes** successfully compiled and static-prerendered.
