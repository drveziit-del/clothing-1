# GERKINK API & Route Documentation

This document specifies all application API endpoints, request/response payload schemas, HTTP verbs, and security protection requirements across the GERKINK codebase.

---

## 1. Authentication Endpoints

### `POST /api/auth/session`
Creates an HttpOnly server-side session cookie after successful client-side Firebase Auth sign-in.
* **Auth:** None (Public)
* **Request Body:**
  ```json
  { "idToken": "string (Firebase ID Token)" }
  ```
* **Response (200 OK):**
  ```json
  { "status": "success", "uid": "string" }
  ```
  *Sets Cookie:* `session=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1209600`

### `DELETE /api/auth/session`
Revokes user session tokens server-side and clears session cookie.
* **Auth:** Required (`session` cookie)
* **Response (200 OK):** `{ "status": "logged_out" }`

---

## 2. Checkout & Payment API Routes

### `POST /api/payment/create-order`
Validates product availability and canonical pricing server-side, creates a pending order in Firestore, and generates a Razorpay order token.
* **Auth:** Required (Session user or guest session)
* **Rate Limit:** 10 requests / 15 mins per IP
* **Request Body:**
  ```json
  {
    "items": [
      { "productId": "string", "variantId": "string", "quantity": 1 }
    ],
    "referralCode": "GK-89A12 (optional)",
    "couponCode": "SUMMER20 (optional)",
    "shippingAddress": {
      "name": "Jane Smith",
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "MH",
      "zip": "400001",
      "country": "IN",
      "phone": "+91 9876543210"
    }
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "orderId": "firestore_doc_id",
    "razorpayOrderId": "order_Kj98aX12",
    "amount": 499900,
    "currency": "INR",
    "total": 4999,
    "discount": 0
  }
  ```

### `POST /api/payment/verify`
Verifies Razorpay payment signature post-checkout and triggers background order fulfillment worker.
* **Auth:** Required
* **Request Body:**
  ```json
  {
    "razorpayOrderId": "order_Kj98aX12",
    "razorpayPaymentId": "pay_Lj98aX13",
    "razorpaySignature": "string (HMAC-SHA256 hex)",
    "firestoreOrderId": "firestore_doc_id"
  }
  ```
* **Response (200 OK):** `{ "status": "success", "orderId": "firestore_doc_id" }`

### `POST /api/payment/webhook`
Razorpay webhook endpoint processing payment events (`payment.captured`, `payment.failed`).
* **Auth:** Signature Check (`x-razorpay-signature` verified via `crypto.timingSafeEqual`)
* **Response (200 OK):** `{ "received": true }`

---

## 3. PayPal International Payment Routes

### `POST /api/paypal/create-order`
Creates an atomic Firestore stock reservation transaction and returns a PayPal REST v2 order token.
* **Auth:** Session or Guest
* **Rate Limit:** 10 requests / 15 mins per IP
* **Response (200 OK):**
  ```json
  {
    "orderId": "firestore_doc_id",
    "paypalOrderId": "PAYPAL_TOKEN_123",
    "amount": 79.99,
    "currency": "USD",
    "total": 79.99,
    "discount": 0
  }
  ```

### `POST /api/paypal/verify`
Captures PayPal payment token on server and marks order `paid`.
* **Request Body:** `{ "paypalOrderId": "string", "firestoreOrderId": "string" }`
* **Response (200 OK):** `{ "status": "success", "captureId": "string" }`

---

## 4. User Account & Payout Routes

### `POST /api/user/bank`
Encrypts and updates affiliate payout details using AES-256-GCM.
* **Auth:** Required (Session cookie)
* **Request Body:**
  ```json
  {
    "accountHolder": "Jane Smith",
    "bankName": "HDFC Bank",
    "accountNumber": "50100123456789",
    "ifscCode": "HDFC0001234",
    "upiId": "jane@upi",
    "paypalEmail": "jane@example.com"
  }
  ```
* **Response (200 OK):** `{ "status": "payout_details_encrypted_and_saved" }`

### `GET /api/user/bank`
Decrypts and returns user payout details server-side.
* **Auth:** Required (Session user owner only)
* **Response (200 OK):** `{ "payoutDetails": { ...decryptedFields } }`

### `DELETE /api/user/delete`
Permanently deletes user account, encrypted payout subcollection, Firestore user doc, and revokes Firebase Auth record.
* **Auth:** Required (Session user owner only)
* **Response (200 OK):** `{ "status": "account_and_data_deleted" }`

### `POST /api/referral/claim`
Submits a $100 payout claim request for eligible 10-referral milestones.
* **Auth:** Required (Session cookie)
* **Response (200 OK):** `{ "status": "claim_submitted", "claimId": "string" }`

---

## 5. Admin Control API Routes

### `GET /api/admin/payouts`
Lists all pending and processed affiliate $100 payout claim requests.
* **Auth:** Admin Only (`decoded.admin === true`)
* **Response (200 OK):** `{ "claims": [ ...claimObjects ] }`

### `POST /api/admin/payouts`
Approves or rejects an affiliate payout claim.
* **Auth:** Admin Only
* **Request Body:** `{ "claimId": "string", "action": "approve" | "reject", "note": "string" }`
* **Response (200 OK):** `{ "status": "updated" }`

### `POST /api/admin/settings`
Updates dynamic ticker roast messages in Firestore `settings/global`.
* **Auth:** Admin Only
* **Request Body:** `{ "roastMessages": ["string", "string"] }`
* **Response (200 OK):** `{ "status": "ok" }`

---

## 6. Infrastructure & Health Routes

### `GET /api/health`
System health check returning database connectivity status and app uptime.
* **Auth:** Public
* **Response (200 OK):** `{ "status": "healthy", "timestamp": "2026-08-12T15:00:00Z" }`
