export type AnnouncementCategory = 'drop' | 'restock' | 'shipping' | 'promo' | 'system';

export interface AnnouncementItem {
  id: string;
  category: AnnouncementCategory;
  categoryLabel?: string;
  title: string;
  highlight?: string;
  description: string;
  dateBadge?: string;
  urgent?: boolean;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  meta?: {
    tag?: string;
    stockStatus?: string;
    dispatchTimeline?: string;
    discountCode?: string;
  };
}

export const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'drop-autumn-2026',
    category: 'drop',
    categoryLabel: 'LIMITED DROP',
    title: 'Peasant Premium 2.0 & Heavyweight Fall Capsule',
    highlight: 'Limited 250 Units Worldwide',
    description:
      'Constructed from 240GSM ultra-dense cotton jersey with anti-crack micro-pigment injection. Once the current production run is exhausted, the vault seals permanently.',
    dateBadge: 'LIVE DROP',
    urgent: true,
    ctaText: 'Explore The Drop →',
    ctaLink: '/shop/valueless-bitches',
    secondaryCtaText: 'Read Fabric Specs',
    secondaryCtaLink: '/manifesto',
    meta: {
      tag: '240 GSM YARN',
      stockStatus: '84% Claimed',
    },
  },
  {
    id: 'restock-tier1-hoodies',
    category: 'restock',
    categoryLabel: 'RESTOCK ALERT',
    title: 'Society Fu*kers Tier 1 & Oversized Boxy Hoodies',
    highlight: 'Full Size Spectrum Restocked [S – 3XL]',
    description:
      'Heavyweight 380GSM fleece silhouettes with reinforced double-needle collar locking and pre-shrunk ring-spun cotton. Ready for on-demand precision printing.',
    dateBadge: 'IN STOCK',
    ctaText: 'Claim Before Sellout →',
    ctaLink: '/shop/society-fuckers',
    secondaryCtaText: 'View Hierarchy',
    secondaryCtaLink: '/shop',
    meta: {
      tag: 'BATCH RESTOCK 04',
      stockStatus: 'High Demand',
    },
  },
  {
    id: 'shipping-global-dispatch',
    category: 'shipping',
    categoryLabel: 'SHIPPING NOTICE',
    title: 'Worldwide Tracked Air Dispatch & Production Timelines',
    highlight: 'Standard 21-Day Custom Print-On-Demand Protocol',
    description:
      'Every garment is printed on demand to eliminate waste. Orders automatically sync with global courier tracking accessible from your Account Dashboard.',
    dateBadge: 'GLOBAL AIR',
    ctaText: 'View Shipping Policy →',
    ctaLink: '/shipping',
    secondaryCtaText: 'Track Order',
    secondaryCtaLink: '/account',
    meta: {
      tag: 'WRAP-CERTIFIED',
      dispatchTimeline: '100% Tracked Air Courier',
    },
  },
  {
    id: 'promo-referral-engine',
    category: 'promo',
    categoryLabel: 'REWARD PROGRAM',
    title: 'Viral Affiliate Engine: $100 Cash Payout per 10 Sales',
    highlight: 'Direct Wire & PayPal Cash Transfers',
    description:
      'Share your unique referral link with your network. Every 10 client purchases trigger an instant $100 payout credited directly to your bank account.',
    dateBadge: '$100 / 10 SALES',
    ctaText: 'Get Your Referral Link →',
    ctaLink: '/referral',
    secondaryCtaText: 'Check Dashboard',
    secondaryCtaLink: '/account',
    meta: {
      tag: 'CASH REWARDS',
      discountCode: 'AUTO REWARD SYNC',
    },
  },
];
