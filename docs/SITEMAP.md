# GERKINK Sitemap & Navigation Architecture

## 1. Complete Website Route Hierarchy

```
gerkink.shop/
├── (Public Storefront)
│   ├── /                         [Static Prerender]  Homepage (Hero, Ticker, Features, Manifesto)
│   ├── /shop                     [Static Prerender]  All Streetwear Collections Grid
│   ├── /shop/society-fuckers     [Static Prerender]  Society Fu*kers Collection Tier
│   ├── /shop/valueless-bitches   [Static Prerender]  Valueless Bi*ches Collection Tier
│   ├── /shop/[productId]         [Dynamic SSR/ISR]   Product Detail Page (Gallery, Size Guide, UGC Video Reviews)
│   ├── /cart                     [Client Component]  Slide-Out Cart Drawer & Full Cart View
│   └── /checkout                 [Client Component]  2-Step Shipping & Payment Checkout (Guest Allowed)
│
├── (Brand & Legal Information)
│   ├── /manifesto                [Static Prerender]  Brand Manifesto & Philosophy
│   ├── /owners                   [Static Prerender]  The Owners Profile & Philosophy
│   ├── /disclaimer               [Static Prerender]  Satirical Disclaimer & Liability Limits
│   ├── /referral                 [Static Prerender]  $100 Affiliate Program Rules & Claim Details
│   ├── /shipping                 [Static Prerender]  Worldwide Express Delivery Policy
│   ├── /refund                   [Static Prerender]  Returns & Replacement Policy
│   ├── /terms                    [Static Prerender]  Terms of Service
│   ├── /contact                  [Static Prerender]  Customer Support Form
│   └── /disclaimer               [Static Prerender]  No Intention to Harm Clause
│
├── (User Account & Payouts)
│   ├── /auth/login               [Client Component]  Email/Password & Google OAuth Login
│   ├── /auth/register            [Client Component]  New User & Affiliate Registration
│   └── /account                  [Protected Auth]    Customer Dashboard (Orders, Referral Link, Bank Encrypted Form)
│
└── (Admin Control Panel)
    ├── /admin                    [Protected Admin]   Executive Overview & Sales Metrics
    ├── /admin/products           [Protected Admin]   Catalog Management
    ├── /admin/products/new       [Protected Admin]   Create New Product & Variant
    ├── /admin/orders             [Protected Admin]   Order Fulfillment & Printify Status
    ├── /admin/payouts            [Protected Admin]   Affiliate $100 Claim Request Approvals
    └── /admin/settings           [Protected Admin]   Dynamic Ticker Roasts & Copywriting Editor
```

---

## 2. Navigation Architecture & Component Mapping

### 2.1 Header / Navbar (`src/components/layout/Navbar.tsx`)
* **Brand Logo:** `GERKINK` (Links to `/`)
* **Primary Navigation Links:**
  * `Shop` → `/shop`
  * `Society Fu*kers` → `/shop/society-fuckers`
  * `Valueless Bi*ches` → `/shop/valueless-bitches`
  * `Referral ($100)` → `/referral`
* **Right Utility Items:**
  * **Currency Switcher Dropdown:** USD ($), INR (₹), EUR (€), GBP (£), CAD ($), AUD ($)
  * **Account Icon:** Links to `/account` (or `/auth/login` if unauthenticated)
  * **Bag Icon:** Opens slide-out cart drawer with live item badge count

### 2.2 Footer (`src/components/layout/Footer.tsx`)
* **Column 1 — Brand:** Logo, Satirical Tagline, `/manifesto`, `/owners`, `/referral`
* **Column 2 — Collections:** `/shop`, `/shop/society-fuckers`, `/shop/valueless-bitches`
* **Column 3 — Customer Care:** `/shipping`, `/refund`, `/contact`
* **Column 4 — Legal:** `/terms`, `/disclaimer`
* **Bottom Bar:** Copyright Notice, Currency indicator, SSL Trust Badge

---

## 3. Automated Sitemap & Search Engine Generators

### 3.1 Sitemap Generator (`src/app/sitemap.ts`)
Generates dynamic XML sitemap located at `https://gerkink.shop/sitemap.xml`:
* Static routes (`/`, `/shop`, `/manifesto`, `/disclaimer`, `/referral`, etc.) indexed with `changefrequency: 'daily'` and `priority: 1.0` to `0.8`.
* Dynamically fetches active product IDs from Firestore `products` collection and appends `/shop/[productId]` URLs with `priority: 0.9`.

### 3.2 Robots.txt Generator (`src/app/robots.ts`)
Located at `https://gerkink.shop/robots.txt`:
```txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://gerkink.shop/sitemap.xml
```
