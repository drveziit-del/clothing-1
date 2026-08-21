# GERKINK UI/UX Design System & Component Library

## 1. UX Design Architecture

### 1.1 Visual Hierarchy & Eyetracking Systems
* **Z-Pattern Layout (Homepage Hero):** Logo top-left → Navigation top-right → Hero headline center → Primary CTA button bottom-center.
* **F-Pattern Layout (Product Detail & Manifesto):** Key product attributes, title, rating summary, and price placed in the initial horizontal sweep; detailed accordion drawers below.

```
Desktop Mosaic Grid Layout (PDP):
┌─────────────────────────┬─────────────────────────┐
│ Image 1 (Primary Front) │ Image 2 (Back Detail)   │
├───────────┬─────────────┼────────────┬────────────┤
│ Image 3   │ Image 4     │ Image 5    │ MP4 Video  │
└───────────┴─────────────┴────────────┴────────────┘
```

---

## 2. Component Library Specifications

### 2.1 PriceTag (`src/components/ui/PriceTag.tsx`)
Renders localized prices based on active currency selection:
```tsx
<PriceTag 
  price={79.99}          // USD Base Price
  tier="exclusive"       // Tier styling badge
  size="xl"               // Font size scale
  animate={true}          // Price slap animation on currency change
/>
```

### 2.2 UgcVideoCard (`src/components/reviews/UgcVideoCard.tsx`)
Vertical short-form customer video player with star rating badge:
* Autoplays muted on scroll focus.
* Interactive tap toggles playback with custom overlay.

### 2.3 CartDrawer (`src/components/cart/CartDrawer.tsx`)
Slide-out drawer containing:
* Item list with quantity steppers (`−` / `+`).
* Free shipping progress indicator (`$100` threshold).
* Live subtotal calculation.
* Fast checkout button routing directly to `/checkout`.

---

## 3. Micro-Animations & CSS Keyframes (`src/app/globals.css`)

```css
/* Glitch Effect for Exclusive Drops */
@keyframes glitch {
  0%   { clip-path: polygon(0 2%,100% 2%,100% 5%,0 5%);    transform: translate(-3px,0); }
  20%  { clip-path: polygon(0 44%,100% 44%,100% 46%,0 46%); transform: translate(-2px,0); }
  65%  { clip-path: none; transform: translate(0); }
}

/* Price Slap Animation */
@keyframes priceSlap {
  0%   { transform: scale(4) rotate(-8deg); opacity: 0; }
  55%  { transform: scale(0.94) rotate(0.5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* Button Pulse Glow */
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,107,0); }
  50%      { box-shadow: 0 0 24px 4px rgba(255,107,107,0.28); }
}
```

---

## 4. Accessibility & Touch Standards
* **WCAG 2.1 AA Compliance:** Minimum text contrast ratio of 4.5:1 enforced globally.
* **Focus States:** High-visibility outline on all interactive buttons and inputs (`outline: 2px solid var(--accent); outline-offset: 3px;`).
* **Touch Targets:** Size picker chips and quantity buttons styled with a minimum hit area of $44 \times 44\text{px}$.
