import AdminOrdersClient from './AdminOrdersClient';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

async function getOrders() {
  try {
    const snapshot = await adminDb.collection('orders').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '—';
      
      const itemsSummary = data.items
        ?.map((item: any) => `${item.title} × ${item.quantity}`)
        .join(', ') || '—';

      return {
        id: doc.id,
        customer: data.shippingAddress?.name || data.userEmail || 'Anonymous',
        items: itemsSummary,
        totalRaw: Number(data.total || 0),
        status: data.status,
        date,
        printifyOrderId: data.printifyOrderId || null,
      };
    });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    return [];
  }
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return <AdminOrdersClient orders={orders} />;
}
