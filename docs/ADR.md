# GERKINK Architecture Decision Records (ADRs)

This document records the key architectural decisions, rationale, context, and consequences across the GERKINK codebase.

---

## ADR 001: Next.js 16 App Router as Full-Stack Framework

* **Status:** Accepted
* **Context:** The application requires high SEO visibility, server-rendered product detail pages, fast initial LCP load speeds, and secure server-side API route handlers.
* **Decision:** Standardize on **Next.js 16 App Router** with Turbopack compilation.
* **Consequences:** Enables static pre-rendering of 55+ routes, native API route handlers, and React Server Components (RSC) for product galleries.

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
* **Decision:** Encrypt payout payloads server-side using Node.js `crypto` **AES-256-GCM** with scrypt-derived 32-byte key from `ENCRYPTION_KEY`, random 12-byte IVs, and 16-byte authentication tags before writing to Firestore `users/{uid}/secure_payout_details/payout`.
* **Consequences:** Ensures financial PII is encrypted at rest. Decryption occurs exclusively in memory when an authorized user or admin accesses the data.

---

## ADR 004: Firestore ACID Transactions for Referral Milestone Engine

* **Status:** Accepted
* **Context:** Concurrently completed referral orders could cause race conditions, resulting in inaccurate referral counts or double $100 milestone payouts.
* **Decision:** Wrap referral processing inside `adminDb.runTransaction`. The transaction reads current referral counts, increments count by 1, and on every 10th qualifying sale (`count % 10 === 0`), awards $100 `totalEarnings` and marks the doc `eligible_for_claim`.
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
* **Context:** Direct API calls to Printify during customer checkout webhook response can fail or time out, causing failed orders.
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
* **Decision:** Add `'unsafe-inline'` to `scriptCSP` in `next.config.ts` alongside whitelisted payment domains (`checkout.razorpay.com`, `paypal.com`, `apis.google.com`). Conditionally strip `'unsafe-eval'` in production builds.
* **Consequences:** Eliminates hydration crashes while enforcing strict script domain origin boundaries.

---

## ADR 009: Bespoke Luxury Custom Design Finite State Machine (FSM)

* **Status:** Accepted
* **Context:** Custom luxury atelier commissions involve consultations, sketches, quotes, approvals, and manufacturing phases. Arbitrary status skipping can cause commissions to enter production without payment or design approval.
* **Decision:** Enforce an immutable finite state machine in `src/lib/custom-design/stateMachine.ts` where status updates are validated transactionally. Skips (e.g. `SUBMITTED` -> `IN_PRODUCTION`) return HTTP 400 Bad Request. Every transition appends an audit record to `statusHistory`.
* **Consequences:** Guarantees strict procedural control over couture garment manufacturing and customer sign-offs.

---

## ADR 010: Cryptographically Signed Single-Use Review Tokens

* **Status:** Accepted
* **Context:** Public product reviews are susceptible to spam and fabricated reviews, while requiring all users to sign in reduces review conversion rates.
* **Decision:** Generate HMAC-SHA256 signed review tokens upon order delivery containing `{ orderId, productId, email, exp }`. Submitting a review with a valid token automatically grants an immutable **Verified Purchase** badge without forcing manual account creation.
* **Consequences:** High review authenticity and frictionless customer UGC collection.

---

## ADR 011: Strict Read-Before-Write Firestore Transaction Discipline

* **Status:** Accepted
* **Context:** In Firestore transactions, invoking `transaction.update` prior to `transaction.get` triggers a fatal error: `Firestore transactions require all reads to be executed before all writes`.
* **Decision:** Refactor all transactional administrative operations (e.g. `/api/admin/payouts` rejection with linked referral restoration) so all queries and `transaction.get` calls are evaluated prior to executing state updates.
* **Consequences:** Eliminates transactional 500 errors and ensures atomic balance restorations on payout rejections.

---

## ADR 012: Comprehensive Account Deletion, Privacy Control & Financial Record Retention Discipline

* **Status:** Accepted
* **Context:** Customer account deletion requests must balance privacy rights against legal requirements for financial accounting, order fulfillment auditability, and anti-fraud protections. Uncontrolled cascade deletion would destroy tax and order ledgers, while retaining full personal profiles violates user privacy.
* **Decision:** Implement a multi-tiered data classification policy executed via `DELETE /api/account`:
  1. **Strict Reauthentication:** Requires fresh Firebase ID token authentication (`auth_time` < 5 min) and explicit typed confirmation (`DELETE`).
  2. **Pending Payout Guard:** Blocks deletion with HTTP 409 Conflict if an unresolved payout request is pending review.
  3. **Targeted Erasure:** Deletes profile documents (`users/{uid}`), encrypted bank credentials (`secure_payout_details`), user-owned coupons, and cloud storage concept files/avatars.
  4. **Review & Referral Anonymization:** Detaches user identity from product reviews and referral records while preserving rating averages and commission integrity.
  5. **Inviolable Financial Ledgers:** Retains historical orders, payment capture tokens, sequence numbers, and fulfillment status with direct personal email masked (`userEmailMasked`).
  6. **Complete Session Revocation:** Revokes all Firebase refresh tokens and clears HTTP-only session cookies.
* **Consequences:** Provides structured, privacy-preserving technical account erasure while safeguarding financial, tax, and order ledger integrity.

---

## ADR 013: Global Network-Status Monitoring & Selective Offline Mutation Protection

* **Status:** Accepted
* **Context:** Sudden network disconnections during financial submissions, checkout, custom design requests, or review submissions can produce ambiguous client states, double charges, or unhandled exceptions. Completely disabling the application offline degrades user experience by preventing users from reading cached product catalog data and terms.
* **Decision:** Implement a dual-layer client monitoring engine (`NetworkStatusContext`) and minimal luxury status pill (`NetworkStatusPill`):
  1. **Dual-Layer Health Detection:** Combine browser `navigator.onLine` with active `/api/health` probes to detect backend unresponsiveness (`degraded`) separate from local network disconnects (`offline`).
  2. **Selective Action Gating:** Disable mutating action triggers (payment submissions, address validation, review publishing, custom design orders, account deletion) with clear, explanatory notices while allowing cached static pages and product browsing to remain usable.
  3. **Visual Aesthetics & Clearance:** Deliver a compact glassmorphic indicator using monospace tracking that floats above mobile sticky checkout bars and desktop notifications without covering navigation.
* **Consequences:** Eliminates incomplete or corrupted mutations during connectivity drops, informs users immediately of network state, and preserves offline catalog usability.

