import { adminDb } from '@/lib/firebase/admin';
import HomeClientPage, { type CopywritingData } from './HomeClientPage';

export const revalidate = 60;

const DEFAULT_COPY: CopywritingData = {
  heroLine1: 'YOU DRESS LIKE',
  heroLine2: 'YOUR PERSONALITY',
  heroAccent: 'boring as f*ck.',
  heroSubtext: "Fix it. Or don't. We don't care.\nBut you should.",
  heroCta: 'PROVE ME WRONG →',
  footerTagline: 'We are nobody.\nOur clothes speak louder.',
};

async function getCopywriting(): Promise<CopywritingData> {
  try {
    const snap = await adminDb.collection('settings').doc('copywriting').get();
    if (snap.exists) {
      const data = snap.data() || {};
      return {
        heroLine1: data.heroLine1 ?? DEFAULT_COPY.heroLine1,
        heroLine2: data.heroLine2 ?? DEFAULT_COPY.heroLine2,
        heroAccent: data.heroAccent ?? DEFAULT_COPY.heroAccent,
        heroSubtext: data.heroSubtext ?? DEFAULT_COPY.heroSubtext,
        heroCta: data.heroCta ?? DEFAULT_COPY.heroCta,
        footerTagline: data.footerTagline ?? DEFAULT_COPY.footerTagline,
      };
    }
  } catch (err) {
    console.error('Error fetching copywriting settings for homepage:', err);
  }
  return DEFAULT_COPY;
}

export default async function HomePage() {
  const initialCopy = await getCopywriting();
  return <HomeClientPage initialCopy={initialCopy} />;
}
