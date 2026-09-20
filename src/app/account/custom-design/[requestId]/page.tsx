import { Metadata } from 'next';
import AccountCustomDesignClient from './AccountCustomDesignClient';

export const metadata: Metadata = {
  title: 'My Custom Request — GERKINK',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountCustomDesignDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <AccountCustomDesignClient requestId={requestId} />;
}
