# GERKINK Product Requirements Document (PRD)

## 1. Product Vision & Positioning
**GERKINK** (`gerkink.shop`) is an anti-conformist, premium streetwear e-commerce platform that combines luxury aesthetic storytelling, satirical self-deprecating copywriting ("The Mirror Fashion Brand"), automated Print-on-Demand (Printify) fulfillment, and a high-yield viral referral engine ($100 per 10 client referrals + $100k milestone rewards).

### Core Brand Philosophy
* **Cold Exterior × Violent Accent:** Dark mode default (`#07090E`), mist blue tones (`#B4C7D9`), and high-impact coral pink accents (`#FF6B6B`).
* **Satirical Transparency:** Satirical disclaimers ("No intention to harm"), zero-fluff policies, and an "Ego Ticker" roasting uninspired fashion choices.
* **Two Distinct Tiers:**
  1. **Society Fu*kers:** Limited-edition, high-margin, pre-book streetwear for ultra-niche buyers.
  2. **Valueless Bi*ches:** Everyday premium streetwear featuring instant checkout and immediate print-on-demand fulfillment.

---

## 2. User Personas & User Journeys

### Persona A: The Trend-Conscious Fashion Buyer ("The Shopper")
* **Goal:** Purchase unique, heavyweight streetwear with clean typography and distinctive satire.
* **Journey:** Homepage Hero → Collection Grid → Product Detail Page (PDP with UGC Video Reviews & Size Guide) → Guest Checkout via Razorpay (India/INR) or PayPal (International/USD) → Order Tracking in Account Dashboard.

### Persona B: The Affiliate / Ambassador ("The Referrer")
* **Goal:** Generate passive income by sharing referral links and tracking client conversions.
* **Journey:** Register Account → Claim Unique Referral Code → Share Code/Link → Monitor Referral Dashboard (Pending vs Eligible for Claim) → Enter Encrypted Bank/Payout Details → Receive $100 payout per 10 client purchases.

### Persona C: The Store Operator ("The Admin")
* **Goal:** Manage inventory, review orders, process affiliate payout requests, update homepage copywriting, and view sales analytics.
* **Journey:** Admin Auth → Sales & Order Overview → Printify Auto-Submit Status → Payout Request Approvals → Dynamic Copywriting & Roast Ticker Editor.

---

## 3. Core Functional Requirements

### 3.1 Catalog & Product Experience
* **Dynamic Multi-Format Media:** Support for high-res photo mosaic grids, mobile touch sliders, video loops, and customer UGC video cards.
* **Size & Fit Confidence:** Interactive size selector chips, on-model fit notices (`Model is 6'1" wearing size XL (Fits Oversized)`), and brand-specific size chart modals (inches + cm).
* **Multi-Currency Converter:** Instant currency switching across USD ($), INR (₹), EUR (€), GBP (£), CAD ($), and AUD ($) using real-time API exchange rates with local fallback cache.

### 3.2 Automated Printify Fulfillment Orchestration
* **Order Processing Pipeline:**
  1. Customer completes payment via Razorpay or PayPal.
  2. Payment webhook triggers background order worker (`orderProcessor.ts`).
  3. Worker automatically compiles line items, validates Printify product/blueprint IDs, and posts order payload to Printify REST API (`/v1/shops/{shop_id}/orders.json`).
  4. Order status transitions: `pending` → `processing` → `fulfilled` / `shipped` with tracking numbers synced back to Firestore.

### 3.3 Viral Referral & Payout Engine
* **$100 per 10 Client Purchases:** On every 10th referral order, the transaction engine unlocks $100 `totalEarnings` for the affiliate and flags the milestone doc as `eligible_for_claim`.
* **$100,000 Milestone Reward:** Affiliates reaching 10,000 client sales trigger the top-tier milestone reward.
* **Anti-Fraud Rules:** Self-referrals are explicitly permitted ("We only need sales"). Exploits, bot manipulation, or system fraud result in immediate account ban and forfeit of payout.

### 3.4 Encrypted Payout Handling
* Bank account details, IFSC codes, PayPal emails, and UPI IDs entered by affiliates are encrypted server-side using **AES-256-GCM** before writing to Firestore `users/{uid}/secure_payout_details/payout`.

### 3.5 Admin Operations Panel
* **Dashboard Metrics:** Gross Revenue, Active Orders, Pending Payouts, Total Affiliates.
* **Product Manager:** Create/Edit products, upload images, sync Printify IDs, toggle publishing status.
* **Payout Approvals:** Review affiliate claim requests, inspect decrypted payout details, approve/reject claims.
* **Dynamic Site Editor:** Update homepage headline copy, manifesto pullquotes, owner bios, and ticker roasts without code redeploy.

---

## 4. Success Metrics & KPIs
* **Cart Abandonment Rate:** $< 65\%$ (Targeted via guest checkout and transparent fee breakdown).
* **Page Load Speed (LCP):** $< 2.0\text{s}$ on mobile devices.
* **Referral Conversion Rate:** $> 12\%$ of registered users actively sharing referral links.
* **Fulfillment Automation Rate:** $> 98\%$ of paid orders automatically submitted to Printify without manual intervention.
