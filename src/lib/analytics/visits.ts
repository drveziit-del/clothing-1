import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const SHARD_COUNT = 10;
export const ROLLUP_PROBABILITY = 0.02;

/**
 * Rolls up sharded visit counters while strictly preserving the pre-existing
 * historical baseline visits from settings/global so traffic is never reset or double-counted.
 */
export async function rollupVisitCounts(): Promise<{ baseline: number; shardTotal: number; total: number }> {
  const globalRef = adminDb.collection('settings').doc('global');

  // 1. Read existing global document to determine baseline
  const globalDoc = await globalRef.get();
  const globalData = globalDoc.data() || {};

  let baseline = 0;
  if (typeof globalData.historicalBaseVisits === 'number') {
    baseline = globalData.historicalBaseVisits;
  } else if (typeof globalData.siteVisits === 'number') {
    // First time migration: establish the existing siteVisits as the historical baseline
    baseline = globalData.siteVisits;
    await globalRef.set(
      { historicalBaseVisits: baseline },
      { merge: true }
    );
  }

  // 2. Sum shards
  const snaps = await adminDb
    .collection('settings')
    .where('siteVisits', '>', -1)
    .get();

  let shardTotal = 0;
  snaps.forEach((s) => {
    if (/^visits_shard_\d+$/.test(s.id)) {
      shardTotal += Number(s.data()?.siteVisits ?? 0);
    }
  });

  const total = baseline + shardTotal;

  await globalRef.set(
    {
      siteVisits: total,
      historicalBaseVisits: baseline,
      lastRollupAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { baseline, shardTotal, total };
}
