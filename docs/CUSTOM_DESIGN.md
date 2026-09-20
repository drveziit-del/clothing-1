# GERKINK Custom Design System Architecture & Specifications

## 1. Overview
The GERKINK Custom Design workflow enables clients to submit custom apparel ideas, upload artwork/reference files, choose a non-refundable prepayment tier ($15 Basic / $20 Priority), pay securely via PayPal REST v2, track design progress, converse directly with the studio team, and approve final design proofs prior to production.

---

## 2. Non-Negotiable Business Policy
- The **$15 USD (Basic)** and **$20 USD (Priority)** Custom Design prepayment is **STRICTLY NON-REFUNDABLE**.
- It is **not** a refundable deposit, not escrow, and not a temporary reservation fee.
- The client must explicitly check:
  > *"I understand that the $15/$20 Custom Design prepayment is non-refundable."*
- Policy version (`v1_non_refundable_prepayment`) and acceptance timestamp are cryptographically stored on the server.
- The client UI has no refund button for this prepayment.

---

## 3. Payment Provider: PayPal REST v2
- **Provider Selected:** PayPal REST v2 (`src/lib/paypal/client.ts`).
- **Rationale:** Prepayment tiers are strictly USD ($15 / $20). PayPal handles USD natively without foreign exchange rate fluctuations, currency conversions, or domestic card restrictions associated with Razorpay INR fallbacks.
- **Idempotency & Reusability:**
  - Requests are initialized in `DRAFT` / `PAYMENT_PENDING` with an idempotency key.
  - If a user refreshes or retries payment, the existing request is reused with the same PayPal order (or a refreshed order if expired), preventing duplicate request creation.
- **Verification:** Payment capture is authoritatively verified via the PayPal REST API (`COMPLETED` status) with exact cross-checking against the server-authoritative prepayment amount before transitioning to `SUBMITTED`.

---

## 4. Database Schema: `customDesignRequests/{requestId}`
- Document ID: Secure UUID (`crypto.randomUUID()`).
- Human Request ID: `GK-CUS-XXXX` (e.g. `GK-CUS-4921`).
- Fields:
  - `requestId`: string (Human-friendly e.g. `GK-CUS-XXXX`)
  - `userId`: string (Customer Firebase Auth UID)
  - `customerEmail`: string
  - `customerName`: string
  - `productType`: `'T-Shirt' | 'Hoodie' | 'Sweatshirt' | 'Accessory' | 'Other'`
  - `preferredSize`: string (optional)
  - `preferredColor`: string (optional)
  - `productPreference`: string (optional)
  - `description`: string
  - `additionalNotes`: string (optional)
  - `uploads`: array of `{ fileId, originalName, mimeType, size, storagePath, uploadedAt }`
  - `plan`: `'basic' | 'priority'`
  - `prepaymentAmount`: number (15 or 20 authoritative USD)
  - `currency`: `'USD'`
  - `paymentProvider`: `'paypal'`
  - `paymentStatus`: `'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'`
  - `paymentReference`: string (PayPal Capture ID)
  - `paypalOrderId`: string
  - `idempotencyKey`: string
  - `paymentPolicyVersion`: `'v1_non_refundable_prepayment'`
  - `paymentPolicyAccepted`: boolean (true)
  - `paymentPolicyAcceptedAt`: Timestamp
  - `status`: CustomDesignStatus
  - `statusHistory`: array of `{ from, to, actor, actorId, timestamp, reason }`
  - `customerMessages`: array of `{ id, sender, senderName, senderUid, message, timestamp }`
  - `adminNotes`: string (optional)
  - `finalPrice`: number (optional)
  - `finalPaymentStatus`: string (optional)
  - `createdAt`: Timestamp / ISO string
  - `updatedAt`: Timestamp / ISO string

---

## 5. Controlled State Machine
```
DRAFT
  ↓
PAYMENT_PENDING ──(Payment fails)──→ PAYMENT_FAILED (Recoverable via retry)
  ↓                                        │
PAYMENT_PROCESSING                         └──(Retry payment)──┐
  ↓                                                            │
PAYMENT_PAID                                                   │
  ↓                                                            │
SUBMITTED ←────────────────────────────────────────────────────┘
  ↓
UNDER_REVIEW ◄───(Customer replies)───┐
  │                                   │
  ├───(Studio inquiry)──→ NEEDS_INFORMATION
  ↓
DESIGN_IN_PROGRESS
  ↓
DESIGN_READY
  ↓
CUSTOMER_APPROVAL_REQUIRED
  ↓ (Customer signs off)
APPROVED
  ↓
FINAL_PAYMENT_PENDING (if balance due) → READY_FOR_PRODUCTION
  ↓
IN_PRODUCTION
  ↓
FULFILLED
```

---

## 6. Secure Uploads & Media Streaming
- **File Types Allowed:** PNG, JPG, JPEG, WEBP, PDF, SVG.
- **Maximum File Size:** 25MB per file; maximum 5 files per request.
- **Server-Side Validation:**
  - Magic byte checking (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WEBP `RIFF...WEBP`, PDF `%PDF`).
  - SVG sanitization (prohibiting `<script>`, event handlers `on*`, active objects).
- **Private Storage:** Uploaded files are stored in private Firebase Storage buckets under `custom-design/${uid}/${fileId}.${ext}`. `makePublic()` is strictly NOT called.
- **Media Streaming Proxy:** `/api/custom-design/media?path=...` verifies user session and enforces IDOR checks: only the request owner (`userId === uid`) or verified admins (`decoded.admin === true`) may stream or download files. Path traversal (`..`) is blocked.

---

## 7. Webhook & Idempotency
- Route: `/api/custom-design/paypal-webhook`
- Verifies PayPal webhook signature via PayPal REST API.
- Idempotency check: Records processed `eventId` in Firestore `webhook_events` collection.
- Processes `PAYMENT.CAPTURE.COMPLETED` events, updating `customDesignRequests` transactionally without creating duplicate entries.

---

## 8. Customer & Admin Interfaces
- **Customer Pages:**
  - `/custom-design`: Public landing page & request form with PayPal integration.
  - `/custom-design/confirmation/[requestId]`: Immediate confirmation & status timeline.
  - `/account?tab=custom_designs`: "My Custom Requests" tab in customer dashboard.
  - `/account/custom-design/[requestId]`: Detailed tracking, in-app messaging, and design approval.
- **Admin Pages:**
  - `/admin/custom-designs`: Filterable list of all custom requests by status.
  - `/admin/custom-designs/[requestId]`: Full detail view, artwork downloader, state machine transitions, customer messaging, internal notes, and final pricing controls.
