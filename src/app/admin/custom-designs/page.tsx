import { Metadata } from 'next';
import AdminCustomDesignsClient from './AdminCustomDesignsClient';

export const metadata: Metadata = {
  title: 'Custom Designs — GERKINK Admin',
};

export default function AdminCustomDesignsPage() {
  return <AdminCustomDesignsClient />;
}
