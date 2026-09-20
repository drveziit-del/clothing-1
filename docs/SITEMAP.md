# GERKINK Sitemap & Navigation Architecture

## 1. Complete Website Route Hierarchy

```
gerkink.shop/
├── (Public Storefront & Catalog)
│   ├── /                             [Static Prerender]  Homepage (Hero, Continuous Ticker, Features, Manifesto)
│   ├── /shop                         [Static Prerender]  All Streetwear Collections Grid (Sorting, Filtering)
│   ├── /shop/society-fuckers         [Static Prerender]  Society Fu*kers Collection Tier (Founding 500 Allocation)
│   ├── /shop/valueless-bitches       [Static Prerender]  Valueless Bi*ches Collection Tier (Ego-Pricing Display)
│   ├── /shop/[productId]             [Dynamic SSR/ISR]   Product Detail Page (Gallery, Size Selector, Customer Reviews)
│   ├── /shop/[productId]/prebook     [Client Component]  Tier 4 Wise Wire Pre-booking Allocation Flow
│   ├── /custom-design                [Client Component]  Bespoke Luxury 3-Step Atelier Configurator
│   ├── /review                       [Dynamic SSR]       Dedicated Customer Reviews Showcase & Verification Hub
│   ├── /cart                         [Client Component]  Slide-Out Cart Drawer & Full Cart View
│   ├── /checkout                     [Client Component]  2-Step Shipping & Multi-Gateway Payment (Guest Allowed)
│   ├── /thank-you                    [Dynamic SSR]       Order Confirmation & Live Wire Instructions
│   ├── /receipt                      [Client Component]  Interactive Thermal Receipt Printing Animation
│   └── /r/[code]                     [Route Handler]     Short Affiliate Referral Click Tracker & Forwarder
│
├── (Brand & Legal Information)
│   ├── /manifesto                    [Static Prerender]  Brand Manifesto & Counter-Culture Philosophy
│   ├── /owners                       [Static Prerender]  The Owners Profile & Philosophy
│   ├── /disclaimer                   [Static Prerender]  Satirical Disclaimer & Liability Limits
│   ├── /referral                     [Static Prerender]  $100 Affiliate Program Rules & Claim Details
│   ├── /contact                      [Static Prerender]  Customer Support Form & Contact Desk
│   ├── /shipping                     [Static Prerender]  Worldwide Express Delivery Policy
│   ├── /refund                       [Static Prerender]  Returns & Replacement Policy
│   └── /privacy                      [Static Prerender]  Privacy Policy & Data Security
│
├── (User Account & Payouts)
│   ├── /auth/login                   [Client Component]  Email/Password & Google OAuth Login
│   ├── /auth/signup                  [Client Component]  New User & Affiliate Registration
│   ├── /account                      [Protected Auth]    Customer Dashboard (Orders, Referral Link, Bank Encrypted Form)
│   └── /account/custom-design/[requestId] [Protected Auth] Customer Bespoke Order Status & Artisan Approval Portal
│
└── (Admin Control Panel)
    ├── /admin                        [Protected Admin]   Executive Overview & Sales Metrics
    ├── /admin/products               [Protected Admin]   Catalog Management
    ├── /admin/products/new           [Protected Admin]   Create New Product & Variant
    ├── /admin/products/edit          [Protected Admin]   Update Existing Product & Variant
    ├── /admin/orders                 [Protected Admin]   Order Fulfillment & Printify Status
    ├── /admin/orders/[orderId]       [Protected Admin]   Detailed Order Inspector & Fulfillment Actions
    ├── /admin/custom-designs         [Protected Admin]   Atelier Request Queue, Specs & FSM Status Transitions
    ├── /admin/reviews                [Protected Admin]   UGC Review Moderation Queue (Approve, Feature, Reject)
    ├── /admin/referrals              [Protected Admin]   Affiliate $100 Claim Request Approvals & Balance Restoration
    ├── /admin/users                  [Protected Admin]   User Directory & Customer Profile Inspector
    ├── /admin/coupons                [Protected Admin]   Coupon Generator, Usage Limits & Global Discounts
    └── /admin/settings               [Protected Admin]   Dynamic Ticker Roasts, Copywriting & Bank Wire Defaults
```

---

## 2. Navigation Architecture & Component Mapping

### 2.1 Header / Navbar (`src/components/layout/Navbar.tsx`)
* **Brand Logo:** `GERKINK` (Links to `/`)
* **Announcement Bar:** Dynamic top banner with rotating marketing highlights
* **Primary Navigation Links:**
  * `Shop` → `/shop`
  * `Society Fu*kers` → `/shop/society-fuckers`
  * `Valueless Bi*ches` → `/shop/valueless-bitches`
  * `Custom Atelier` → `/custom-design`
  * `Reviews` → `/review`
  * `Referral ($100)` → `/referral`
* **Right Utility Items:**
  * **Currency Switcher Dropdown:** USD ($), INR (₹), EUR (€), GBP (£), CAD ($), AUD ($)
  * **Account Icon:** Links to `/account` (or `/auth/login` if unauthenticated)
  * **Bag Icon:** Opens slide-out cart drawer with live item badge count

### 2.2 Footer (`src/components/layout/Footer.tsx`)
* **Column 1 — Brand:** Logo, Satirical Tagline, `/manifesto`, `/owners`, `/referral`
* **Column 2 — Collections:** `/shop`, `/shop/society-fuckers`, `/shop/valueless-bitches`, `/custom-design`
* **Column 3 — Community & Social:** `/review`, `/r/[code]`
* **Column 4 — Customer Care:** `/shipping`, `/refund`, `/contact`
* **Column 5 — Legal:** `/privacy`, `/disclaimer`
* **Bottom Bar:** Copyright Notice, Currency indicator, SSL Trust Badge

---

## 3. Automated Sitemap & Search Engine Generators

### 3.1 Sitemap Generator (`src/app/sitemap.ts`)
Generates dynamic XML sitemap located at `https://gerkink.shop/sitemap.xml`:
* Static routes (`/`, `/shop`, `/custom-design`, `/shop/society-fuckers`, `/shop/valueless-bitches`, `/review`, `/manifesto`, `/owners`, `/referral`, `/contact`, `/shipping`, `/refund`, `/privacy`, `/disclaimer`) indexed with `changeFrequency: 'daily'` and `priority: 1.0` to `0.7`.
* Dynamically fetches active product IDs from Firestore `products` collection and appends `/shop/[productId]` URLs with `changeFrequency: 'daily'` and `priority: 0.9`.

### 3.2 Robots.txt Generator (`src/app/robots.ts`)
Located at `https://gerkink.shop/robots.txt`:
```txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /account/
Disallow: /api/
Sitemap: https://gerkink.shop/sitemap.xml
```
