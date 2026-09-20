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

## 2. Checkout, Orders & Payment Processing

### `POST /api/order`
Validates product availability and canonical pricing server-side, creates a pending order in Firestore, and generates a Razorpay order token.
* **Auth:** Session user or guest session
* **Rate Limit:** 10 requests / 15 mins per IP
* **Request Body:**
  ```json
  {
    "items": [
      { "productId": "string", "variantId": "string", "quantity": 1 }
    ],
    "referralCode": "GK-89A12 (optional)",
    "couponCode": "VIP20 (optional)",
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
* **Auth:** Public / Session
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

### `POST /api/payment/verify-free`
Processes 100% discounted orders (e.g. 100% coupon codes), verifying validity before marking order `paid`.
* **Auth:** Required (`session` cookie)
* **Request Body:** `{ "firestoreOrderId": "string" }`
* **Response (200 OK):** `{ "status": "success", "orderId": "string" }`

### `POST /api/payment/confirm-wire-prebook`
Records customer bank wire deposit confirmation for Tier 4 Society Fu*kers pre-booking allocations.
* **Auth:** Required (`session` cookie)
* **Request Body:**
  ```json
  {
    "orderId": "string",
    "referenceNumber": "WIRE-REF-9921",
    "senderName": "Jane Smith",
    "bankName": "Wise / JPMorgan"
  }
  ```
* **Response (200 OK):** `{ "success": true, "status": "awaiting_wire_confirmation" }`

### `POST /api/payment/webhook`
Razorpay webhook endpoint processing payment events (`payment.captured`, `payment.failed`).
* **Auth:** Signature Check (`x-razorpay-signature` verified via `crypto.timingSafeEqual`)
* **Response (200 OK):** `{ "received": true }`

---

## 3. PayPal REST v2 Gateway

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

### `POST /api/paypal/capture-order`
Server-side captures PayPal payment token, verifies captured amount, and triggers fulfillment worker.
* **Request Body:** `{ "paypalOrderId": "string", "firestoreOrderId": "string" }`
* **Response (200 OK):** `{ "status": "success", "captureId": "string" }`

### `POST /api/paypal/webhook`
PayPal webhook endpoint processing capture events (`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`).
* **Auth:** Signature verified via PayPal REST API Transmission Verification
* **Response (200 OK):** `{ "received": true }`

---

## 4. Custom Design Atelier API

### `POST /api/custom-design/create-request`
Submits a bespoke custom garment request with idea description, silhouette specs, and optional design deposit.
* **Auth:** Required (`session` cookie)
* **Rate Limit:** 20 requests / 15 mins
* **Request Body:**
  ```json
  {
    "ideaDescription": "Heavyweight French Terry hoodie with tonal embroidery",
    "productType": "hoodie",
    "size": "L",
    "color": "Washed Charcoal",
    "budgetTier": "couture"
  }
  ```
* **Response (200 OK):** `{ "success": true, "requestId": "string", "status": "SUBMITTED" }`

### `POST /api/custom-design/capture-payment`
Processes custom design initial consultation or final balance payments via PayPal / Razorpay.
* **Auth:** Required (`session` cookie)
* **Response (200 OK):** `{ "success": true, "paymentCaptured": true }`

### `GET /api/custom-design/my-requests`
Lists all bespoke requests belonging to the authenticated customer.
* **Auth:** Required (`session` cookie)
* **Response (200 OK):** `{ "requests": [...] }`

### `GET /api/custom-design/[requestId]` & `PATCH /api/custom-design/[requestId]`
Retrieves custom commission detail or updates status (including customer cancellation).
* **Auth:** Required (Request Owner only)
* **Response (200 OK):** `{ "request": { ... } }`

### `POST /api/custom-design/upload` & `GET /api/custom-design/media`
Uploads and serves design sketches, moodboards, and reference mockups.
* **Auth:** Authenticated Client / Studio Team

---

## 5. Customer Reviews System

### `GET /api/reviews`
Fetches approved product or global reviews with sorting, rating filter, and pagination.
* **Auth:** Public
* **Query Parameters:** `productId` (optional), `sort` ('recent' | 'highest' | 'lowest' | 'helpful'), `rating` (1-5), `page` (1..N), `limit` (default 6)
* **Response (200 OK):**
  ```json
  {
    "reviews": [ ...reviewObjects ],
    "total": 42,
    "stats": { "averageRating": 4.8, "totalReviews": 42 }
  }
  ```

### `POST /api/reviews`
Submits a new customer review. Validates signed single-use review tokens for automatic **Verified Purchase** badges.
* **Auth:** Public with signed token OR Authenticated session
* **Request Body:**
  ```json
  {
    "productId": "string",
    "rating": 5,
    "reviewText": "Impeccable heavyweight cotton and embroidery detail.",
    "authorName": "Jane S.",
    "token": "signed_hmac_token (optional)",
    "mediaUrls": ["https://..."]
  }
  ```
* **Response (201 Created):** `{ "success": true, "reviewId": "string", "verifiedPurchase": true }`

### `POST /api/reviews/upload`
Uploads customer review images or videos directly to Firebase Storage with size validation and MIME checking.
* **Auth:** Session or valid review token
* **Max Payload:** 15MB for images, 50MB for video MP4/WebM

### `POST /api/reviews/vote`
Increments helpfulness counter on a customer review with IP/cookie deduplication.
* **Request Body:** `{ "reviewId": "string", "vote": "helpful" }`
* **Response (200 OK):** `{ "success": true, "helpfulCount": 14 }`

### `PATCH /api/reviews`
Admin moderation endpoint to approve, feature, or reject customer reviews.
* **Auth:** Admin Only (`decoded.admin === true`)
* **Request Body:** `{ "reviewId": "string", "status": "approved" | "rejected", "featured": boolean }`
* **Response (200 OK):** `{ "success": true }`

---

## 6. Coupons & Discounts

### `POST /api/coupons/validate`
Validates coupon code, min spend threshold, per-user limits, and expiry dates against current cart subtotal.
* **Auth:** Session or Guest
* **Request Body:** `{ "code": "VIP20", "subtotal": 150.00 }`
* **Response (200 OK):**
  ```json
  {
    "valid": true,
    "code": "VIP20",
    "discountType": "percentage",
    "discountValue": 20,
    "discountAmount": 30.00
  }
  ```

---

## 7. Affiliate & Referral System

### `POST /api/referral/click`
Tracks inbound affiliate link clicks, setting a 30-day attribution cookie.
* **Request Body:** `{ "code": "GK-89A12" }`
* **Response (200 OK):** `{ "tracked": true }`

### `GET /api/referral/validate`
Verifies validity of affiliate code during cart or checkout initialization.
* **Query Parameters:** `code=GK-89A12`
* **Response (200 OK):** `{ "valid": true, "affiliateName": "Jane" }`

### `POST /api/referral/claim`
Submits an affiliate claim request for unlocked $100 milestones (10 qualified client purchases).
* **Auth:** Required (`session` cookie)
* **Response (200 OK):** `{ "success": true, "claimId": "string" }`

---

## 8. User Account & Encrypted Payouts

### `POST /api/user/bank`
Encrypts and stores affiliate payout credentials using AES-256-GCM.
* **Auth:** Required (`session` cookie)
* **Request Body:** `{ "accountHolder": "Jane", "bankName": "HDFC", "accountNumber": "...", "ifscCode": "..." }`
* **Response (200 OK):** `{ "status": "payout_details_encrypted_and_saved" }`

### `GET /api/user/bank`
Decrypts and returns user payout credentials server-side.
* **Auth:** Required (Account Owner only)
* **Response (200 OK):** `{ "payoutDetails": { ...decryptedFields } }`

### `DELETE /api/account`
Secure customer account self-deletion endpoint with cryptographic reauthentication verification, typed confirmation (`DELETE`), rate limiting (5 req / 15m), storage cleanup, review anonymization, and financial audit record preservation.
* **Auth:** Required (Session Cookie + Fresh Firebase ID Token reauthentication)
* **Rate Limit:** 5 requests / 15 minutes per IP
* **Request Body:** `{ "confirmation": "DELETE", "idToken": "<fresh_firebase_id_token>" }`
* **Response (200 OK):** `{ "status": "ok", "message": "Your account and personal data have been permanently deleted." }`
* **Response (400 Bad Request):** Missing/invalid confirmation or malformed JSON payload.
* **Response (401 Unauthorized):** Missing/invalid session cookie or missing reauthentication ID token.
* **Response (403 Forbidden):** Cross-UID mismatch or expired reauthentication token (> 5 min).
* **Response (409 Conflict):** User has a pending affiliate payout request under review.
* **Response (429 Too Many Requests):** Rate limit exceeded.

### `DELETE /api/user/delete`
Legacy route alias forwarding directly to the hardened account deletion engine, ensuring full backward compatibility.
* **Auth:** Required (Account Owner only)
* **Response (200 OK):** `{ "status": "account_and_data_deleted", "message": "..." }`

---

## 9. Admin Control API Endpoints

### `GET /api/admin/payouts`
Lists pending and processed affiliate $100 payout claim requests.
* **Auth:** Admin Only (`decoded.admin === true`)
* **Response (200 OK):** `{ "pending": [...], "processed": [...] }`

### `POST /api/admin/payouts`
Approves or rejects an affiliate payout claim. On rejection, atomically restores referral documents to `eligible_for_claim`.
* **Auth:** Admin Only
* **Request Body:** `{ "requestId": "string", "action": "approve" | "reject", "adminNote": "string" }`
* **Response (200 OK):** `{ "success": true, "status": "paid_manual" | "rejected", "restoredBalance": boolean }`

### `POST /api/admin/orders/approve-wire`
Approves a pending wire prebooking deposit and unlocks Printify fulfillment pipeline.
* **Auth:** Admin Only
* **Request Body:** `{ "orderId": "string", "action": "approve" }`
* **Response (200 OK):** `{ "success": true, "idempotent": boolean }`

### `POST /api/admin/orders/retry-printify`
Retries background Printify order fulfillment for failed jobs.
* **Auth:** Admin Only
* **Request Body:** `{ "orderId": "string" }`
* **Response (200 OK):** `{ "success": true, "printifyOrderId": "string" }`

### `POST /api/admin/custom-designs/[requestId]/status`
Transitions bespoke custom design request through finite state machine (FSM).
* **Auth:** Admin Only
* **Request Body:** `{ "status": "UNDER_REVIEW" | "DESIGN_IN_PROGRESS" | "APPROVED", "adminNotes": "string", "finalPrice": 650 }`
* **Response (200 OK):** `{ "success": true, "status": "string" }`

### `GET /api/admin/products` & `POST /api/admin/products`
Retrieves and creates products in the catalog.
* **Auth:** Admin Only

### `POST /api/admin/products/sync`
Synchronizes active product blueprints from Printify API into Firestore.
* **Auth:** Admin Only
* **Response (200 OK):** `{ "synced": 5, "errors": [] }`

### `GET /api/admin/coupons` & `POST /api/admin/coupons`
Lists and creates promotional coupons with custom discount values and usage caps.
* **Auth:** Admin Only

### `POST /api/admin/settings` & `POST /api/admin/settings/bank-details`
Updates global homepage roast messages and admin bank wire instructions.
* **Auth:** Admin Only

---

## 10. Fulfillment & Third-Party Webhooks

### `POST /api/printify/webhook`
Receives Printify fulfillment callbacks (`order:created`, `order:sent-to-production`, `order:shipment:created`).
* **Auth:** Signature Check (`x-pfy-signature` verified via `crypto.timingSafeEqual`)
* **Response (200 OK):** `{ "received": true }`

---

## 11. Public Utilities & Analytics

### `POST /api/analytics/visit`
Records website visitor analytics using atomic sharded counters with probabilistic global rollup.
* **Auth:** Public
* **Response (200 OK):** `{ "success": true }`

### `POST /api/contact`
Receives customer contact messages, records ticket in Firestore, and sends notification email.
* **Auth:** Public (Rate limited)
* **Response (200 OK):** `{ "success": true }`

### `GET /api/currency`
Returns real-time fiat currency exchange rates cached at edge.
* **Auth:** Public
* **Response (200 OK):** `{ "rates": { "USD": 1, "INR": 86.5, ... } }`
