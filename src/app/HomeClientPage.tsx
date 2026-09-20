'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import EgoTicker from '@/components/ui/EgoTicker';
import { BentoGrid, BentoCard } from '@/components/ui/BentoGrid';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import styles from './page.module.css';

// Dynamically import splash loading screen with ssr: false to guarantee zero hydration mismatch
const LoadingScreen = dynamic(() => import('@/components/ui/LoadingScreen'), {
  ssr: false,
});

// Dynamically import below-the-fold reviews section to reduce critical initial bundle
const ReviewsSection = dynamic(() => import('@/components/reviews/ReviewsSection'), {
  ssr: false,
});

const BASE_VISITOR_COUNT = 100;

export interface CopywritingData {
  heroLine1: string;
  heroLine2: string;
  heroAccent: string;
  heroSubtext: string;
  heroCta: string;
  footerTagline: string;
}

export default function HomeClientPage({ initialCopy }: { initialCopy: CopywritingData }) {
  const [loaded, setLoaded] = useState(false);
  const [shakeBtn, setShakeBtn] = useState(false);
  const [visitorCount, setVisitorCount] = useState(BASE_VISITOR_COUNT);
  const heroRef = useRef<HTMLDivElement>(null);

  // Initialize with server-fetched dynamic copy (zero flash of hardcoded text)
  const [copy, setCopy] = useState<CopywritingData>(initialCopy);

  useEffect(() => {
    setLoaded(true);
  }, []);

  // Real-time listener for live updates when admin edits copywriting
  useEffect(() => {
    let unsub: (() => void) | null = null;

    try {
      const db = getFirestoreDb();
      if (!db) return;
      const { doc, onSnapshot } = getFirestoreModule();
      unsub = onSnapshot(
        doc(db, 'settings', 'copywriting'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setCopy((prev) => {
              const next: CopywritingData = {
                heroLine1: data.heroLine1 ?? prev.heroLine1,
                heroLine2: data.heroLine2 ?? prev.heroLine2,
                heroAccent: data.heroAccent ?? prev.heroAccent,
                heroSubtext: data.heroSubtext ?? prev.heroSubtext,
                heroCta: data.heroCta ?? prev.heroCta,
                footerTagline: data.footerTagline ?? prev.footerTagline,
              };
              if (
                next.heroLine1 === prev.heroLine1 &&
                next.heroLine2 === prev.heroLine2 &&
                next.heroAccent === prev.heroAccent &&
                next.heroSubtext === prev.heroSubtext &&
                next.heroCta === prev.heroCta &&
                next.footerTagline === prev.footerTagline
              ) {
                return prev;
              }
              return next;
            });
          }
        },
        (error) => {
          console.warn('Copywriting settings snapshot error:', error);
        }
      );
    } catch (err) {
      console.warn('Copywriting settings effect error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Visitor counter listener
  useEffect(() => {
    let unsub: (() => void) | null = null;

    try {
      const db = getFirestoreDb();
      if (!db) return;
      const { doc, onSnapshot } = getFirestoreModule();
      unsub = onSnapshot(
        doc(db, 'settings', 'global'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const visits = data.siteVisits ?? 0;
            const nextCount = BASE_VISITOR_COUNT + visits;
            setVisitorCount((prev) => (prev === nextCount ? prev : nextCount));
          }
        },
        (error) => {
          console.warn('Global settings snapshot error:', error);
        }
      );
    } catch (err) {
      console.warn('Global settings effect error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleCTAShake = () => {
    setShakeBtn(true);
    setTimeout(() => setShakeBtn(false), 600);
  };

  return (
    <>
      <LoadingScreen />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className={styles.hero} ref={heroRef}>
        <div className={styles.ambientLeft} aria-hidden />
        <div className={styles.ambientRight} aria-hidden />

        <div className={styles.heroInner}>
          <div className={`${styles.heroText} ${loaded ? styles.loaded : ''}`}>
            <h1
              className={styles.headlineWrap}
              aria-label={`${copy.heroLine1} ${copy.heroLine2} ${copy.heroAccent}`}
            >
              <span className={styles.line1}>
                {copy.heroLine1}
              </span>
              <span className={styles.line2}>
                {copy.heroLine2}
              </span>
              <span className={`${styles.lineAccent} ${styles.noWrap}`}>
                {copy.heroAccent}
              </span>
            </h1>

            <p className={styles.subText} style={{ whiteSpace: 'pre-line' }}>
              {copy.heroSubtext}
            </p>

            <div className={styles.ctaRow}>
              <Link
                href="/shop"
                className={`btn btn-primary btn-lg ${shakeBtn ? 'animate-shake' : ''} ${styles.ctaBtn}`}
                onClick={handleCTAShake}
              >
                {copy.heroCta}
              </Link>
              <Link href="/manifesto" className={`btn btn-secondary ${styles.manifestoBtn}`}>
                Read the Manifesto
              </Link>
            </div>
          </div>

          <div className={styles.floatingTags} aria-hidden>
            <span className={`${styles.floatTag} ${styles.floatTag1}`}>$10,000,000</span>
            <span className={`${styles.floatTag} ${styles.floatTag2}`}>$1,000</span>
            <span className={`${styles.floatTag} ${styles.floatTag3}`}>$100,000</span>
          </div>
        </div>
      </section>

      {/* ── EGO TICKER ───────────────────────────────────────── */}
      <EgoTicker />

      {/* ── BENTO GRID SHOWCASE ─────────────────────────────── */}
      <section className={styles.bentoSection} aria-label="Collections and Features">
        <div className={styles.bentoSectionHeader}>
          <p className="text-label" style={{ color: 'var(--mist-100)' }}>CURATED CHAOS</p>
          <h2 className={styles.bentoHeaderTitle}>The GERKINK Ecosystem</h2>
          <p className={styles.bentoHeaderSub}>
            Two contrasting collections, an unapologetic referral engine, and heavyweight ethical craftsmanship.
          </p>
        </div>

        <BentoGrid columns={3}>
          {/* Card 1: Society Fu*kers (Featured 2x2) */}
          <BentoCard
            title="Society Fu*kers"
            description="Five escalating tiers of absurdist luxury streetwear. Designed for those with more capital than shame."
            badge="Tier-Based Luxury"
            badgeType="mist"
            href="/shop/society-fuckers"
            ctaText="Enter the Hierarchy →"
            colSpan={2}
            rowSpan={2}
            variant="mist"
          >
            <div className={styles.tierPreviewList}>
              {[
                { name: 'Tier 1: Peasant Premium', price: '$1,000' },
                { name: 'Tier 2: Wannabe', price: '$10,000' },
                { name: 'Tier 3: Delusional', price: '$100,000' },
                { name: 'Tier 4: Obscene', price: '$1,000,000' },
                { name: 'Tier 5: God Tier', price: '$10,000,000' },
              ].map((tier) => (
                <div key={tier.name} className={styles.tierPreviewItem}>
                  <span className={styles.tierPreviewName}>{tier.name}</span>
                  <span className={styles.tierPreviewPrice}>{tier.price}</span>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Card 2: Valueless Bi*ches (Tall 1x2) */}
          <BentoCard
            title="Valueless Bi*ches"
            description="Heavyweight everyday streetwear. Provocative graphics, zero apologies, and instant print-on-demand fulfillment."
            badge="Everyday Apparel"
            badgeType="coral"
            href="/shop/valueless-bitches"
            ctaText="Explore Streetwear →"
            colSpan={1}
            rowSpan={2}
            variant="coral"
          >
            <div className={styles.categoryTagList}>
              {['Heavyweight Tees', 'Oversized Hoodies', 'Accessories', 'Limited Drops'].map((tag) => (
                <span key={tag} className="tag tag-coral">{tag}</span>
              ))}
            </div>
          </BentoCard>

          {/* Card 3: $100 Referral Engine (1x1) */}
          <BentoCard
            title="Viral Affiliate Engine"
            description="Earn $100 for every 10 client sales completed with your link. Reach 10,000 sales to trigger the $100,000 milestone."
            badge="$100 / 10 Sales"
            badgeType="coral"
            href="/referral"
            ctaText="Claim Your Code →"
            colSpan={1}
            variant="coral"
          >
            <div className={styles.referralStatWrap}>
              <span className={styles.referralBigStat}>$100</span>
              <span className={styles.referralStatLabel}>Cash Payout per 10 Sales</span>
            </div>
          </BentoCard>

          {/* Card 4: Heavyweight Fabric Specs (1x1) */}
          <BentoCard
            title="240GSM Heavyweight"
            description="Double-needle stitching at stress points, zero-crack ink injection, and WRAP-certified ethical knitwear."
            badge="Material Craft"
            badgeType="mist"
            colSpan={1}
            variant="mist"
          >
            <div className={styles.specBadgeList}>
              <div className={styles.specBadgeItem}>
                <span>WEIGHT</span>
                <strong>240 GSM</strong>
              </div>
              <div className={styles.specBadgeItem}>
                <span>COLLAR</span>
                <strong>Ribbed Lock</strong>
              </div>
              <div className={styles.specBadgeItem}>
                <span>DYE</span>
                <strong>Zero-Fade Ink</strong>
              </div>
              <div className={styles.specBadgeItem}>
                <span>ETHICS</span>
                <strong>WRAP-Certified</strong>
              </div>
            </div>
          </BentoCard>

          {/* Card 5: Brand Manifesto (1x1) */}
          <BentoCard
            title="The Anti-Conformist Manifesto"
            description="We sell a mirror to modern fashion vanity. No corporate jargon. No fake discounts."
            badge="Philosophy"
            badgeType="default"
            href="/manifesto"
            ctaText="Read Manifesto →"
            colSpan={1}
          />
        </BentoGrid>
      </section>

      {/* ── SOCIAL PROOF ─────────────────────────────────────── */}
      <div className={styles.socialProof}>
        <div className={styles.proofInner}>
          <span className={styles.proofNumber}>{visitorCount.toLocaleString()}</span>
          <span className={styles.proofText}>people got roasted by admin</span>
          <div className={styles.proofDots} aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className={styles.proofDot} style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── REVIEWS ───────────────────────────────────────────── */}
      <ReviewsSection />

      {/* ── BRAND STATEMENT ──────────────────────────────────── */}
      <section className={styles.statement}>
        <div className="container">
          <div className={styles.statementInner}>
            <h2 className={styles.statementTitle} style={{ whiteSpace: 'pre-line' }}>
              {copy.footerTagline}
            </h2>
            <div className={styles.statementRight}>
              <p className={styles.statementBody}>
                Anonymous owners. Brutal honesty. Two collections that exist
                at opposite ends of luxury — because your wardrobe shouldn&#39;t
                be as forgettable as your personality.
              </p>
              <Link href="/owners" className="btn btn-secondary">Meet Nobody →</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
