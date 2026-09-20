import { Metadata } from 'next';
import AdminCustomDesignDetailClient from './AdminCustomDesignDetailClient';

export const metadata: Metadata = {
  title: 'Manage Custom Design — GERKINK Admin',
};

export default async function AdminCustomDesignDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <AdminCustomDesignDetailClient requestId={requestId} />;
}
