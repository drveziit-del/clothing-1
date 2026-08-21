# GERKINK Brand Identity & Design Tokens

## 1. Brand Philosophy & Positioning
**GERKINK** is built on a single core truth: *"Fashion didn't die. It got boring."*

While traditional clothing brands attempt to flatter, uplift, or over-promise, GERKINK functions as an uncompromising mirror. We use dark luxury aesthetics, sharp brutalist typography, and self-deprecating satire to challenge uninspired wardrobe choices.

```
                  ┌─────────────────────────────────────────┐
                  │            GERKINK ETHOS                │
                  │   Cold Exterior × Violent Accent        │
                  │  (Dark Void Base + Coral Pink Highlight)│
                  └────────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
  SOCIETY FU*KERS                                       VALUELESS BI*CHES
(Pre-book / Limited drops / Luxury pricing)           (Everyday street streetwear / Instant POD)
```

---

## 2. Design System Tokens (`src/app/globals.css`)

### 2.1 Color Palette
The color architecture relies on a **60-30-10 distribution** to maintain dark-mode focus and direct user attention to primary call-to-action elements.

```css
:root {
  /* Surface Base (60%) */
  --void:        #07090E;  /* Main Page Background */
  --ash:         #111318;  /* Primary Card Surface */
  --fog:         #1C2028;  /* Secondary Input / Layer Surface */
  --fog-light:   #252932;  /* Borders & Dividers */

  /* Neutral Typography & Secondary Tones (30%) */
  --chalk:       #E8EBF0;  /* Primary High-Contrast Text */
  --smoke:       #8491A3;  /* Subtitles & Muted Metadata */
  --ghost:       #4A4E5C;  /* Tertiary Placeholders */
  --mist-100:    #B4C7D9;  /* Secondary Link Highlights */
  --mist-200:    #8FA8C2;  /* Interactive Hover Borders */

  /* Accent Highlight (10%) */
  --coral-100:   #FFB3B3;  /* Badge Glow Background */
  --coral-200:   #FF6B6B;  /* Primary Accent & CTA Button */
  --coral-300:   #E85555;  /* Button Hover Elevation */
  --coral-400:   #CC3D3D;  /* Active Press State */
}
```

### 2.2 Typography Hierarchy

| Role | Font Family | Usage | CSS Class / Selector |
| :--- | :--- | :--- | :--- |
| **Display / Headlines** | `Space Grotesk` (700/900) | Hero headlines, section titles, collection tags | `.font-display`, `h1, h2, h3` |
| **Body & UI Copy** | `Inter` (300/400/500/600) | Product descriptions, input forms, body text | `body`, `.input`, `p` |
| **Utility / Data** | `JetBrains Mono` (400/700) | Currency prices, SKU tags, order numbers | `.font-mono`, `.text-price` |

---

## 3. Brand Voice & Copywriting Tone

### 3.1 Principles of GERKINK Copywriting
1. **Unapologetic Honesty:** Never use corporate buzzwords ("empowering", "lifestyle", "eco-friendly"). Tell the user what the shirt actually is.
2. **Sharp Satire:** Treat wardrobe choices with humorous severity.
3. **Transparent Rules:** Anti-fraud rules state clearly: *"Self-referrals are completely allowed. We only need sales. However, if anyone attempts actual system fraud or malicious exploits, admin will beat their ass off."*

### 3.2 Ticker Roasts Engine (`src/lib/utils/roasts.ts`)
Rotating marquee text on the homepage hero and footer ticker:
* *"You dress like your personality — boring as f*ck."*
* *"Another black hoodie? Groundbreaking."*
* *"Your wardrobe is asking for a merciful ending."*
* *"Buy it or keep wearing your 2018 gym merch."*

---

## 4. Satirical Disclaimer Clause (`/disclaimer`)
To preserve legal compliance while maintaining brand voice:
> *"We have zero intention to cause harm, offend, or target any individual, group, or belief. GERKINK is an artistic fashion expression. All claims, product names, and copywriting are satire."*
