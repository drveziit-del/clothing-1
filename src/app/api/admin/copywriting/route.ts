import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// Whitelist mirrors the admin settings editor (src/app/admin/settings/page.tsx).
// Anything outside this schema is rejected instead of being spread into the
// public settings/copywriting document.
const copywritingSchema = z
  .object({
    heroLine1: z.string().max(200),
    heroLine2: z.string().max(200),
    heroAccent: z.string().max(200),
    heroSubtext: z.string().max(500),
    heroCta: z.string().max(120),
    manifestoHeroPull: z.string().max(300),
    manifestoSections: z
      .array(
        z.object({
          label: z.string().max(80),
          title: z.string().max(200),
          body: z.string().max(2000),
        })
      )
      .max(20),
    manifestoCtaText: z.string().max(500),
    manifestoCtaButton: z.string().max(120),
    ownersTitle: z.string().max(300),
    ownersDesc: z.string().max(500),
    ownersQuote: z.string().max(500),
    ownersAttribution: z.string().max(300),
    ownersList: z
      .array(
        z.object({
          alias: z.string().max(80),
          role: z.string().max(120),
          bio: z.string().max(1000),
        })
      )
      .max(10),
    footerTagline: z.string().max(300),
  })
  .strict();

export async function POST(request: NextRequest) {
  // 1. Admin only
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Parse & validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = copywritingSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Invalid input${issue?.path?.length ? ` at ${issue.path.join('.')}` : ''}` },
      { status: 400 }
    );
  }

  // 3. Save to database (settings/copywriting document)
  try {
    await adminDb.collection('settings').doc('copywriting').set(
      {
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Error saving copywriting:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
