import { adminDb } from '@/lib/firebase/admin';
import styles from './page.module.css';
import Link from 'next/link';

export const metadata = {
  title: 'Manifesto — GERKINK',
  description: 'Why we exist. Why you need us. Read the GERKINK Manifesto on provocative luxury streetwear, anonymous fashion statements, and breaking basic apparel rules.',
  openGraph: {
    title: 'Manifesto — GERKINK',
    description: 'Why we exist. Why you need us. Read the GERKINK Manifesto on provocative luxury streetwear, anonymous fashion statements, and breaking basic apparel rules.',
    url: '/manifesto',
  },
  twitter: {
    title: 'Manifesto — GERKINK',
    description: 'Why we exist. Why you need us. Read the GERKINK Manifesto on provocative luxury streetwear, anonymous fashion statements, and breaking basic apparel rules.',
  },
  alternates: {
    canonical: '/manifesto',
  },
};

const DEFAULT_MANIFESTO_SECTIONS = [
  {
    label: 'Origin',
    title: "Fashion didn't die. It got boring.",
    body: `Every brand wants to inspire you. Every campaign wants to uplift, empower, 
    celebrate you. What a pathetic lie. You don't need inspiration. You need a mirror 
    that tells the truth. That's what GERKINK is: the mirror your wardrobe was too 
    afraid to be.`,
  },
  {
    label: 'Philosophy',
    title: 'We roast you because we respect you.',
    body: `Your best friend doesn't sugarcoat. They tell you that shirt makes you look 
    like you work at a middle school. They tell you that you've been wearing the same 
    style since 2018. That's love. That's GERKINK. We're not here to validate your 
    mediocrity — we're here to end it.`,
  },
  {
    label: 'The Collections',
    title: 'Two worlds. No in-between.',
    body: `Society Fu*kers is for the delusional rich — people who have run out of 
    meaningful ways to spend money and have arrived, finally, at a t-shirt that costs 
    more than a small country's GDP. Valueless Bi*ches is for everyone else who knows 
    their worth even when the price tag doesn't reflect it yet.`,
  },
  {
    label: 'The Owners',
    title: 'We are nobody.',
    body: `Our names are not on the label. Our faces are not on the campaign. 
    Our egos are not attached to the outcome. We created GERKINK because the fashion 
    industry needed a brand that doesn't pretend. The clothes speak. We don't need to.`,
  },
  {
    label: 'The Promise',
    title: 'You will be roasted. You will be better for it.',
    body: `Every interaction with GERKINK — from the homepage that calls you boring to 
    the checkout confirmation that says "finally" — is designed to make you slightly 
    uncomfortable. That discomfort is intentional. That discomfort is the point. 
    Comfort is the enemy of style.`,
  },
];

async function getCopywriting() {
  try {
    const doc = await adminDb.collection('settings').doc('copywriting').get();
    if (doc.exists) {
      return doc.data();
    }
  } catch (err) {
    console.error('Error fetching copywriting in server component:', err);
  }
  return null;
}

export default async function ManifestoPage() {
  const copyData = await getCopywriting();

  const heroPull = copyData?.manifestoHeroPull ?? 'Fashion is a mirror. Ours tells the truth.';
  const ctaText = copyData?.manifestoCtaText ?? "You read the whole thing. Either you're genuinely curious or you're procrastinating fixing your wardrobe. Either way —";
  const ctaButton = copyData?.manifestoCtaButton ?? 'Stop Procrastinating →';
  const sections = copyData?.manifestoSections ?? DEFAULT_MANIFESTO_SECTIONS;

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>The GERKINK</span>
          <h1 className={styles.heroTitle}>Manifesto</h1>
          <p className={styles.heroPull}>
            {heroPull}
          </p>
          <p className={styles.brandDefinition}>
            GERKINK is a provocative luxury streetwear brand that creates limited-edition clothing statements through its Society Fuckers and Valueless Bitches apparel collections.
          </p>
        </div>
        <div className={styles.heroLine} aria-hidden />
      </div>

      {/* Sections */}
      <div className={styles.sections}>
        {sections.map((section: any, i: number) => (
          <div key={section.label + i} className={styles.section}>
            <div className={styles.sectionMeta}>
              <span className="tag">{section.label}</span>
            </div>
            <div className={styles.sectionContent}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <p className={styles.sectionBody}>{section.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <p className={styles.ctaText}>
          {ctaText}
        </p>
        <Link href="/shop" className="btn btn-primary btn-lg">{ctaButton}</Link>
      </div>
    </div>
  );
}
