# GERKINK Production Deployment & Operational Runbook

This operational runbook provides step-by-step procedures for deploying, monitoring, maintaining, and responding to incidents on the **GERKINK** production platform (`gerkink.shop`).

---

## 1. Pre-Deployment Execution Standard

Before triggering any production build or pushing commits to `main`:

```bash
# 1. Run TypeScript Compilation Audit
npx tsc --noEmit

# 2. Run ESLint Code Quality Audit
npm run lint

# 3. Run Production Build Verification
npm run build
```

---

## 2. Deployment Instructions (Firebase App Hosting)

1. Ensure `apphosting.yaml` contains correct environment variable mapping and Cloud Secret Manager bindings:
   ```yaml
   env:
     - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
       value: gerkink.shop
     - variable: ENCRYPTION_KEY
       secret: ENCRYPTION_KEY
     - variable: PRINTIFY_ACCESS_TOKEN
       secret: PRINTIFY_ACCESS_TOKEN
   ```
2. Deploy updated Firestore security rules and composite indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
3. Commit and push to main GitHub branch:
   ```bash
   git add .
   git commit -m "feat: release deployment"
   git push origin main
   ```
4. Monitor build logs in Google Cloud Build / Firebase App Hosting console.

---

## 3. Database Indexing & Security Rules

Verify `firestore.indexes.json` includes all composite queries:
* `payout_requests`: `status` (ASC) + `createdAt` (ASC)
* `payout_requests`: `status` (ASC) + `updatedAt` (DESC)
* `reviews`: `productId` (ASC) + `rating` (DESC) + `createdAt` (DESC)
* `orders`: `userId` (ASC) + `createdAt` (DESC)
* `customDesignRequests`: `userId` (ASC) + `createdAt` (DESC)

Verify `firestore.rules` enforces restricted write permissions:
* `users/{uid}`: Read/update permitted only to authenticated owner; sensitive counters (`referralCount`, `totalEarnings`, `milestoneReward`, `customerNumber`) locked to server Admin SDK.
* `users/{uid}/secure_payout_details`: Read/write strictly blocked from client SDKs; managed exclusively by server Admin SDK with AES-256-GCM encryption.
* `orders/{orderId}`: Server-only mutations (`allow create, update, delete: if false`).
* `payout_requests/{requestId}`: Server-only mutations with Admin read.
* `reviews/{reviewId}`: Public catalog read, server-only mutation via `/api/reviews`.
* `DELETE /api/account`: Verified customer self-deletion requiring fresh ID token reauthentication, typed confirmation, rate limiting (5 req / 15m), and financial ledger preservation.

---

## 4. Monitoring & Operational Alerting

### Key Health Metrics to Monitor:
1. **API Error Rates:** Monitor HTTP 5xx responses on `/api/order`, `/api/payment/*`, and `/api/paypal/*`.
2. **Printify Fulfillment Queue:** Check Firestore `orders` for status `paid` where `printifyOrderId` is missing for $> 15$ minutes.
3. **Webhook Response Times:** Ensure webhook endpoints respond in $< 500\text{ms}$.
4. **Email Dispatch Health:** Check `orders` collection for `emailSent: false` on paid orders.

---

## 5. Incident Response Runbook

### Incident A: Webhook Signature Verification Failures
* **Symptom:** Gateway returns `400 Invalid Signature`.
* **Action:**
  1. Inspect `RAZORPAY_WEBHOOK_SECRET` or `PAYPAL_CLIENT_SECRET` in environment variables.
  2. Verify webhook URL is set to `https://gerkink.shop/api/payment/webhook` (or `/paypal/webhook`).
  3. Verify payload format matches HMAC-SHA256 hex encoding.

### Incident B: Printify Order Submission Timeout
* **Symptom:** Order marked `paid` in Firestore but `printifyOrderId` is blank.
* **Action:**
  1. Log into Admin Panel at `/admin/orders/[orderId]`.
  2. Inspect timeline history for Printify API response code or stock mismatch.
  3. Click **Retry Printify Fulfillment** (`POST /api/admin/orders/retry-printify`).

### Incident C: Affiliate Payout Claim Fraud Alert
* **Symptom:** Multiple claim requests submitted with suspicious referral patterns.
* **Action:**
  1. Navigate to `/admin/payouts`.
  2. Inspect referral history (`referredOrderIds`) and linked buyer UIDs.
  3. To reject an improper claim, click **Reject Payout** with explanatory note. The Firestore transaction will atomically restore referral documents to `eligible_for_claim` for re-verification.

### Incident D: Bank Wire Pre-booking Confirmation
* **Symptom:** Tier 4 order awaiting bank wire confirmation.
* **Action:**
  1. Log into Treasury bank account to confirm receipt of funds.
  2. Open Admin Panel at `/admin/orders/[orderId]`.
  3. Click **Approve Bank Wire** (`POST /api/admin/orders/approve-wire`) to atomically transition status to `paid` and trigger Printify fulfillment.
