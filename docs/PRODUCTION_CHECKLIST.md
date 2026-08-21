# GERKINK Production Deployment & Operational Runbook

This operational runbook provides step-by-step procedures for deploying, monitoring, maintaining, and responding to incidents on the **GERKINK** production platform (`gerkink.shop`).

---

## 1. Pre-Deployment Execution Standard

Before triggering any production build or pushing commits to `main`:

```bash
# 1. Run TypeScript Compilation Audit
npx tsc --noEmit

# 2. Run Production Build Verification
npx next build

# 3. Run Referral Transaction Engine Unit Tests
node scripts/test-ten-referrals.js
node scripts/test-process-referral.js
```

---

## 2. Deployment Instructions (Firebase App Hosting)

1. Ensure `apphosting.yaml` contains correct environment variable mapping:
   ```yaml
   env:
     - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
       value: gerkink.shop
     - variable: ENCRYPTION_SECRET_KEY
       secret: ENCRYPTION_SECRET_KEY
   ```
2. Commit and push to main GitHub branch:
   ```bash
   git add .
   git commit -m "feat: production deployment release"
   git push origin main
   ```
3. Monitor build logs in Google Cloud Build / Firebase App Hosting dashboard.

---

## 3. Database Indexing & Security Rules Deployment

Deploy updated Firestore security rules using Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

Verify `firestore.rules` enforces restricted write permissions:
* `users/{uid}`: Read/write permitted only to authenticated owner (`request.auth.uid == uid`).
* `users/{uid}/secure_payout_details`: Read/write strictly blocked from client SDKs; managed exclusively by Admin SDK.
* `orders/{orderId}`: Creation permitted; updates restricted to server endpoints.

---

## 4. Monitoring & Operational Alerting

### Key Health Metrics to Monitor:
1. **API Error Rates:** Monitor HTTP 5xx responses on `/api/payment/*` and `/api/paypal/*`.
2. **Printify Fulfillment Queue:** Check Firestore `orders` for status `paid` where `printifyOrderId` is missing for $> 15$ minutes.
3. **Webhook Response Times:** Ensure webhook endpoints respond in $< 500\text{ms}$.

---

## 5. Incident Response Runbook

### Incident A: Webhook Signature Verification Failures
* **Symptom:** Gateway returns `400 Invalid Signature`.
* **Action:**
  1. Inspect `RAZORPAY_WEBHOOK_SECRET` or `PAYPAL_CLIENT_SECRET` in environment variables.
  2. Verify webhook URL is set to `https://gerkink.shop/api/payment/webhook` (or `/paypal/webhook`).
  3. Re-run `node scripts/test-process-referral.js` to confirm local signature computation.

### Incident B: Printify Order Submission Timeout
* **Symptom:** Order marked `paid` in Firestore but `printifyOrderId` is blank.
* **Action:**
  1. Log into Admin Panel at `/admin/orders`.
  2. Locate target order ID and click **Retry Printify Fulfillment**.
  3. Inspect server logs for Printify API blueprint ID or stock mismatch error messages.

### Incident C: Affiliate Payout Claim Fraud Alert
* **Symptom:** Multiple claim requests submitted from single IP or suspicious referral patterns.
* **Action:**
  1. Navigate to `/admin/payouts`.
  2. Inspect referral history (`referredOrderIds`).
  3. If automated fraud or exploit is detected, click **Ban User & Reject Claim**.
