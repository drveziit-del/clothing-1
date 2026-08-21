import { redirect } from 'next/navigation';

export default function AccountOrdersRedirectPage() {
  redirect('/account?tab=orders');
}
