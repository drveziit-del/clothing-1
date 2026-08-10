import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { contactSchema } from '@/lib/utils/validation';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { sendAdminContactMessage } from '@/lib/email/sender';

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'contact', { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = contactSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const stripHtml = (text: string) => text.replace(/<[^>]*>/g, '');
  const sanitizedName = stripHtml(result.data.name);
  const sanitizedMessage = stripHtml(result.data.message);

  await adminDb.collection('contacts').add({
    name: sanitizedName,
    email: result.data.email,
    message: sanitizedMessage,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Send admin email notification (fire-and-forget)
  sendAdminContactMessage({
    name: sanitizedName,
    email: result.data.email,
    message: sanitizedMessage,
  }).catch((err) => console.error('Failed to send contact notification email:', err));

  return NextResponse.json({ status: 'ok' });
}
