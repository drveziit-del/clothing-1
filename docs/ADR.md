# GERKINK Architecture Decision Records (ADRs)

This document records the key architectural decisions, rationale, context, and consequences across the GERKINK codebase.

---

## ADR 001: Next.js 16 App Router as Full-Stack Framework

* **Status:** Accepted
* **Context:** The application requires high SEO visibility, server-rendered product detail pages, fast initial LCP load speeds, and secure server-side API route handlers.
* **Decision:** Standardize on **Next.js 16 App Router** with Turbopack compilation.
* **Consequences:** Enables static pre-rendering of 55 routes, native API handlers, and React Server Components (RSC) for product galleries.

---

## ADR 002: HttpOnly Session Cookies over LocalStorage JWT Tokens

* **Status:** Accepted
* **Context:** Storing JWT tokens in client `localStorage` exposes them to XSS attacks and unauthorized script theft.
* **Decision:** Authenticate clients via Firebase Auth, then exchange ID tokens at `/api/auth/session` for a server-issued **HttpOnly, Secure, SameSite=Strict** session cookie (14-day TTL).
* **Consequences:** Prevents client-side token exposure. Requires server-side verification using `adminAuth.verifySessionCookie`.

---

## ADR 003: AES-256-GCM Encryption for Affiliate Payout Data

* **Status:** Accepted
* **Context:** Affiliates submit sensitive bank account numbers, IFSC codes, UPI IDs, and PayPal emails to claim $100 referral rewards. Storing raw financial PII in plain text violates privacy rules.
* **Decision:** Encrypt payout payloads server-side using Node.js `crypto` **AES-256-GCM** with random 12-byte IVs and 16-byte authentication tags before writing to Firestore `users/{uid}/secure_payout_details/payout`.
* **Consequences:** Ensures PII is encrypted at rest. Decryption occurs exclusively in memory when an authorized user or admin accesses the data.

---

## ADR 004: Firestore ACID Transactions for Referral Milestone Engine

* **Status:** Accepted
* **Context:** Concurrently completed referral orders could cause race conditions, resulting in inaccurate referral counts or double $100 milestone payouts.
* **Decision:** Wrap referral processing inside `adminDb.runTransaction`. The transaction reads current referral counts, increments count by 1, and on every 10th sale (`count % 10 === 0`), awards $100 `totalEarnings` and marks the doc `eligible_for_claim`.
* **Consequences:** Guarantees strict transactional integrity under high concurrent order volume.

---

## ADR 005: Dual Payment Gateway Routing (Razorpay & PayPal)

* **Status:** Accepted
* **Context:** Domestic Indian customers expect UPI, NetBanking, and local cards via INR (Razorpay), while international customers expect USD payment via PayPal and international credit cards.
* **Decision:** Route orders automatically based on the shipping address country:
  * `Country === 'IN'` → Razorpay API (INR)
  * `Country !== 'IN'` → PayPal REST SDK v2 (USD)
* **Consequences:** Maximizes checkout conversion rates globally while minimizing cross-border processing fees.

---

## ADR 006: Asynchronous Background Printify Fulfillment Orchestration

* **Status:** Accepted
* **Context:** Direct API calls to Printify during the customer checkout webhook response can fail or time out, causing failed orders.
* **Decision:** Decouple fulfillment into an asynchronous background worker module (`src/lib/orchestrator/orderProcessor.ts`). Webhook marks order `paid` immediately, then invokes `processOrderFulfillment` with exponential retry fallback.
* **Consequences:** Fast webhook response times (`< 200ms`) and resilient print-on-demand submission.

---

## ADR 007: Server-Side Canonical Price Calculation

* **Status:** Accepted
* **Context:** Intercepted HTTP request payloads could attempt price or quantity tampering (e.g. setting `price: 0.01`).
* **Decision:** Ignore client-submitted prices completely. The server fetches canonical product prices directly from Firestore (`product.variants.find(...).price`) and calculates subtotal, 8% tax, and valid coupon discounts server-side.
* **Consequences:** Completely prevents price manipulation exploits.

---

## ADR 008: CSP Header Tuning with `'unsafe-inline'` for Client Hydration

* **Status:** Accepted
* **Context:** Strict Content Security Policy headers without `'unsafe-inline'` blocked Next.js client hydration scripts and inline JSON-LD schemas, causing React Hydration Error #412.
* **Decision:** Add `'unsafe-inline'` to `scriptCSP` in `next.config.ts` alongside whitelisted payment domains (`checkout.razorpay.com`, `paypal.com`, `apis.google.com`).
* **Consequences:** Eliminates hydration crashes while enforcing strict script domain origin boundaries.
