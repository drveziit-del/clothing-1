import { Metadata } from 'next';
import ConfirmationClient from './ConfirmationClient';

export const metadata: Metadata = {
  title: 'Custom Request Received — GERKINK',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CustomDesignConfirmationPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <ConfirmationClient requestId={requestId} />;
}
