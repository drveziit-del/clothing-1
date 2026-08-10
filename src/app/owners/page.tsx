import { adminDb } from '@/lib/firebase/admin';
import styles from './page.module.css';

export const metadata = {
  title: 'Owners — GERKINK',
  description: 'Anonymous. Unverifiable. Real. Meet the creative minds, designers, and visionaries operating behind the scenes of provocative luxury streetwear brand GERKINK.',
  openGraph: {
    title: 'Owners — GERKINK',
    description: 'Anonymous. Unverifiable. Real. Meet the creative minds, designers, and visionaries operating behind the scenes of provocative luxury streetwear brand GERKINK.',
    url: '/owners',
  },
  twitter: {
    title: 'Owners — GERKINK',
    description: 'Anonymous. Unverifiable. Real. Meet the creative minds, designers, and visionaries operating behind the scenes of provocative luxury streetwear brand GERKINK.',
  },
  alternates: {
    canonical: '/owners',
  },
};

const DEFAULT_OWNERS = [
  {
    alias: 'THE ARCHITECT',
    bio: 'Designed the brand. Refuses to be photographed. Allegedly has 14 t-shirts — all black. May or may not be a former hedge fund manager who had a spiritual crisis.',
    role: 'Design + Vision',
  },
  {
    alias: 'THE OPERATOR',
    bio: 'Runs everything. Known only by initials. Has been described as "frighteningly competent" and "the kind of person who reads terms of service." Probably enjoys this.',
    role: 'Operations + Strategy',
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

export default async function OwnersPage() {
  const copyData = await getCopywriting();

  const ownersTitle = copyData?.ownersTitle ?? 'We are\nnobody.';
  const ownersDesc = copyData?.ownersDesc ?? 'Our names are not important. Our clothes are.\nEverything you need to know about us is already on your back.';
  const ownersQuote = copyData?.ownersQuote ?? 'The brand is the work. The work speaks. We don’t need to.';
  const ownersAttribution = copyData?.ownersAttribution ?? '— GERKINK Owners, in the only interview they’ve ever agreed to';
  const ownersList = copyData?.ownersList ?? DEFAULT_OWNERS;

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.scanline} aria-hidden />
        <div className={styles.heroInner}>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>Behind the brand</span>
          <h1 className={styles.heroTitle} style={{ whiteSpace: 'pre-line' }}>{ownersTitle}</h1>
          <p className={styles.heroDesc} style={{ whiteSpace: 'pre-line' }}>
            {ownersDesc}
          </p>
        </div>
      </div>

      {/* Owner Cards */}
      <div className={styles.owners}>
        {ownersList.map((owner: any, i: number) => (
          <div key={owner.alias + i} className={styles.ownerCard}>
            {/* Silhouette — CSS only, no images */}
            <div className={styles.silhouette} aria-label={`${owner.alias} silhouette`}>
              <div className={styles.silhouetteHead} />
              <div className={styles.silhouetteBody} />
              <div className={styles.glitchLayer1} aria-hidden />
              <div className={styles.glitchLayer2} aria-hidden />
            </div>
            <div className={styles.ownerInfo}>
              <span className="tag">{owner.role}</span>
              <h2 className={styles.ownerAlias}>{owner.alias}</h2>
              <p className={styles.ownerBio}>{owner.bio}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Statement */}
      <div className={styles.statement}>
        <blockquote className={styles.quote}>
          &ldquo;{ownersQuote}&rdquo;
        </blockquote>
        <p className={styles.attribution}>{ownersAttribution}</p>
      </div>
    </div>
  );
}
