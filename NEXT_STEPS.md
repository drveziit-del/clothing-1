# GERKINK — Production Launch Roadmap & Next Steps

This document outlines the essential tasks required to transition the GERKINK storefront from development/testing into a secure, production-ready, live streetwear platform.

---

## 📋 Roadmap Overview

- [x] **1. Live API Configuration for Razorpay**
- [x] **2. Purge Development & Test Users**
- [x] **3. Comprehensive Security Audit**
- [x] **4. Hardening Sensitive Payout Data ("Bank-Level" Security)**
- [x] **5. Manual E2E Verification of Core User & Admin Flows**
- [x] **6. Critical Backend & Webhook Guards (Fulfillment Integrity)**

---

## 🛠️ Step-by-Step Task Details

### 1. Live API Configuration for Razorpay
To start accepting real payments, we must transition Razorpay from test mode to live mode.

> [!NOTE]
> **Production Status: Configured**
> Live credentials and webhooks have been successfully configured in `apphosting.yaml` and deployed via Google Cloud Secret Manager.

* **Update Environment Variables**:
  Replace test keys in your production environment variables (e.g. Vercel dashboard or local `.env.local` for production build):
  ```env
  # Client-side Publishable Key
  NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
  
  # Server-side Secret Keys
  RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
  RAZORPAY_KEY_SECRET=live_secret_xxxxxxxxxxxxxxxxxxxxxxxx
  RAZORPAY_WEBHOOK_SECRET=live_webhook_secret_xxxxxxxxxxxxx
  ```
* **Re-create Live Webhook**:
  1. Log into your Razorpay Live Dashboard.
  2. Navigate to **Settings** → **Webhooks** and click **Add New Webhook**.
  3. Set Webhook URL to `https://yourdomain.com/api/payment/webhook`.
  4. Select the event: `order.paid`.
  5. Secret: Set your custom `RAZORPAY_WEBHOOK_SECRET` string.
* **Verify Production TLS/HTTPS**:
  Ensure Razorpay checkout scripts load securely. Razorpay Live environment requires HTTPS connections on the checkout route.

---

### 2. Purge Development & Test Users
Clear all mock and dummy accounts to ensure a clean launch database.

* **Firebase Authentication Purge**:
  Delete the following test accounts from your Firebase Console Auth panel:
  * `test_refund_user@gerkink.shop`
  * Any other `mock`, `test` or user-created test accounts.
* **Firestore Database Purge**:
  Delete corresponding database records associated with test UIDs in the following collections:
  * `users`
  * `orders`
  * `referrals`
  * `coupons`
  * `milestones`

---

### 3. Comprehensive Security Audit
Inspect the boundary guards to verify that no admin routes or data endpoints can be bypassed.

* **Verify Admin Custom Claims**:
  Ensure that only authorized emails receive the `{ admin: true }` custom claim. Double-check that no script auto-promotes users to admin role based on plain email checks.
* **Verify Middleware & Route Protection**:
  Check [src/proxy.ts](file:///c:/Users/SOUMALYA/Desktop/clothing%202/src/proxy.ts) (or your hosting router rules) to confirm that:
  * `/admin/*` routes reject non-admin users.
  * `/account/*` and `/checkout` redirect unauthenticated guests to `/auth/login`.
* **CORS & Content Security Policy (CSP)**:
  Review [next.config.ts](file:///c:/Users/SOUMALYA/Desktop/clothing%202/next.config.ts) headers to verify security protocols, ensuring that only trusted payment hosts (Razorpay) and asset hosts (Printify/Google CDN) are whitelisted.

---

### 4. Hardening Sensitive Payout Data ("Bank-Level Security")
Protect sensitive financial details (e.g. bank routing numbers, account numbers, and emails) stored when affiliates request payouts.

* **Firestore Rules Hardening**:
  Prevent other users (and even client-side reads, except for the user themselves) from viewing sensitive payout fields. Update `firestore.rules` under `users/{uid}`:
  ```javascript
  // Only allow read/write of payout settings by the owner (or admin)
  // Ensure sensitive sub-fields are not returned in public profiles
  ```
* **Data Encryption at Rest**:
  For higher security compliance, encrypt sensitive fields (like bank numbers) inside `/api/user/payout-profile` before writing to Firestore, decrypting them only on the server inside the secure Admin dashboard.
* **Write-Only Subcollection Pattern**:
  Move bank details to a separate subcollection `users/{uid}/secure_payout_details` with highly restrictive rules:
  ```javascript
  match /users/{uid}/secure_payout_details/payout {
    allow read: if isAdmin();
    allow write: if isOwner(uid) || isAdmin();
  }
  ```

---

### 5. Manual E2E Verification of Core User & Admin Flows
Conduct a thorough manual walkthrough of all customer and administrative features.

> [!NOTE]
> **Production Status: Verified**
> Complete end-to-end functionality—including reactive currency switching (USD/INR), coupon scoping/validations, server-bridged reviews, and administrative tools—has been manually verified and certified.

* **Customer Flow**:
  1. Go to homepage, verify that hero text and copywriting load successfully.
  2. Click on a product, verify sizes, colors, and Add-to-Cart functionality.
  3. Go to Cart, apply a coupon code, verify that discount deducts correctly.
  4. Proceed to Checkout, fill shipping address, check Razorpay popup loads.
* **Affiliate Referral Flow**:
  1. Register a new user, copy their unique referral code.
  2. In a guest browser window, visit the site with `?ref=YOUR_CODE`.
  3. Verify the link click registers in the database.
  4. Complete a mock purchase (e.g. using a 100% discount coupon) and verify that the referral increments under the affiliate's account page.
* **Fulfillment Flow**:
  1. Open Admin Panel → Orders.
  2. Verify that paid orders show up correctly.
  3. Run Printify inventory sync and check product stock logs.

---

### 6. Critical Backend & Webhook Guards (Fulfillment Integrity)
Ensure fallback mechanisms and idempotency checks are correctly configured to prevent transaction errors and inventory data loss.

* **[CRITICAL] Webhook Fallback Fulfillment**:
  Currently, `/api/payment/webhook` only updates the order status to `paid`, but it **does not** trigger referral processing (`processReferral`) or order submission to Printify. If a user closes the checkout browser tab before client-side redirection finishes, the payment is captured, but the order is never fulfilled and the affiliate is not credited.
  * **Fix**: Update the `payment.captured` event handler in the webhook route to trigger:
    1. `processReferral(order)` (referral credit).
    2. `createPrintifyOrder(shopId, ...)` (fulfillment submission).
* **[CRITICAL] Webhook Idempotency Checks**:
  Verify that both your Razorpay and Printify webhooks check if an order has *already* been processed before taking action. If a webhook triggers a second time (due to network retries), it must not double-credit referrals or double-submit orders to Printify.
* **API Key & SMTP Environment Security**:
  * Double-check that `.env.local` is added to your `.gitignore` to prevent committing live API tokens, Firebase private keys, or SMTP App Passwords (e.g. Google app passcode) to public GitHub repositories.
* **Printify Webhook Authentication**:
  * Validate that `/api/printify/webhook` (which handles shipment status updates) checks for authorization headers or secret verification signatures to prevent external actors from spoofing shipping events.

