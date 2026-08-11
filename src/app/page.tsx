'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import EgoTicker from '@/components/ui/EgoTicker';
import LoadingScreen from '@/components/ui/LoadingScreen';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import styles from './page.module.css';

const BASE_VISITOR_COUNT = 100;

export default function HomePage() {
  const [loaded, setLoaded] = useState(false);
  const [shakeBtn, setShakeBtn] = useState(false);
  const [visitorCount, setVisitorCount] = useState(BASE_VISITOR_COUNT);
  const heroRef = useRef<HTMLDivElement>(null);

  // Site Copy State
  const [copy, setCopy] = useState({
    heroLine1: 'YOU DRESS LIKE',
    heroLine2: 'YOUR PERSONALITY—',
    heroAccent: 'boring as f*ck.',
    heroSubtext: 'Fix it. Or don\'t. We don\'t care.\nBut you should.',
    heroCta: 'PROVE ME WRONG →',
    footerTagline: 'We are nobody.\nOur clothes speak louder.'
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const db = getFirestoreDb();
      if (!db) return;
      const { doc, onSnapshot } = getFirestoreModule();
      const unsub = onSnapshot(
        doc(db, 'settings', 'copywriting'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setCopy(prev => ({
              heroLine1: data.heroLine1 ?? prev.heroLine1,
              heroLine2: data.heroLine2 ?? prev.heroLine2,
              heroAccent: data.heroAccent ?? prev.heroAccent,
              heroSubtext: data.heroSubtext ?? prev.heroSubtext,
              heroCta: data.heroCta ?? prev.heroCta,
              footerTagline: data.footerTagline ?? prev.footerTagline,
            }));
          }
        },
        (error) => {
          console.warn('Copywriting settings snapshot error:', error);
        }
      );
      return () => unsub();
    } catch (err) {
      console.warn('Copywriting settings effect error:', err);
    }
  }, []);

  useEffect(() => {
    try {
      const db = getFirestoreDb();
      if (!db) return;
      const { doc, onSnapshot } = getFirestoreModule();
      const unsub = onSnapshot(
        doc(db, 'settings', 'global'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const visits = data.siteVisits ?? 0;
            setVisitorCount(BASE_VISITOR_COUNT + visits);
          }
        },
        (error) => {
          console.warn('Global settings snapshot error:', error);
        }
      );
      return () => unsub();
    } catch (err) {
      console.warn('Global settings effect error:', err);
    }
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
              <span className={`${styles.line1} animate-fadeUp`}>
                {copy.heroLine1}
              </span>
              <span className={`${styles.line2} animate-fadeUp delay-200`}>
                {copy.heroLine2}
              </span>
              <span className={`${styles.lineAccent} ${styles.noWrap} animate-fadeUp delay-500`}>
                {copy.heroAccent}
              </span>
            </h1>

            <p className={`${styles.subText} animate-fadeUp delay-700`} style={{ whiteSpace: 'pre-line' }}>
              {copy.heroSubtext}
            </p>

            <div className={`${styles.ctaRow} animate-fadeUp delay-900`}>
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

      {/* ── SECTION SPLIT ────────────────────────────────────── */}
      <section className={styles.split} aria-label="Shop sections">
        <Link href="/shop/society-fuckers" className={`${styles.splitPanel} ${styles.splitLeft}`}>
          <div className={styles.splitContent}>
            <span className="tag tag-mist">Est. for the delusional</span>
            <h2 className={styles.splitTitle}>Society<br />Fu*kers</h2>
            <p className={styles.splitDesc}>
              $1,000 – $10,000,000<br />
              For those with more money than shame.
            </p>
            <span className={styles.splitCta}>Enter →</span>
          </div>
          <div className={styles.splitOverlay} aria-hidden />
        </Link>

        <Link href="/shop/valueless-bitches" className={`${styles.splitPanel} ${styles.splitRight}`}>
          <div className={styles.splitContent}>
            <span className="tag tag-coral">For the unapologetic</span>
            <h2 className={styles.splitTitle}>Valueless<br />Bi*ches</h2>
            <p className={styles.splitDesc}>
              Streetwear with a statement.<br />
              No apologies included.
            </p>
            <span className={styles.splitCta}>Enter →</span>
          </div>
          <div className={styles.splitOverlay} aria-hidden />
        </Link>
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
