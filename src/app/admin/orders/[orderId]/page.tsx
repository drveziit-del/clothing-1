import { adminDb } from '@/lib/firebase/admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import WireApprovalActions from '@/components/admin/WireApprovalActions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params;

  const orderDoc = await adminDb.collection('orders').doc(orderId).get();
  if (!orderDoc.exists) {
    notFound();
  }

  const data = orderDoc.data()!;
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : '—';
  const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleString() : '—';

  // Fetch associated order_jobs
  const jobsSnap = await adminDb
    .collection('order_jobs')
    .where('orderId', '==', orderId)
    .get();

  const jobs = jobsSnap.docs
    .map((d) => {
      const jData = d.data();
      const rawDate = jData.createdAt?.toDate ? jData.createdAt.toDate() : new Date(0);
      return {
        id: d.id,
        ...jData,
        rawDate,
        createdAt: jData.createdAt?.toDate ? jData.createdAt.toDate().toLocaleString() : '—',
      };
    })
    .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  const history = (data.history || []).sort((a: any, b: any) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#fff', fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: 'var(--coral-200, #ff4757)', margin: 0 }}>
            ORDER: {orderId}
          </h1>
          <p suppressHydrationWarning style={{ color: '#888', margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Created: {createdAt} | Last Updated: {updatedAt}
          </p>
        </div>
        <div>
          <span
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '4px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '0.85rem',
              backgroundColor: data.status === 'paid' || data.status === 'in_production' ? '#2ed573' : data.status === 'awaiting_wire_confirmation' ? '#ffa502' : '#747d8c',
              color: '#000',
            }}
          >
            {data.status === 'awaiting_wire_confirmation' ? '⏳ Awaiting Wire Approval' : data.status}
          </span>
        </div>
      </div>

      {/* Wire Transfer Approval Action Block (if awaiting confirmation) */}
      <WireApprovalActions
        orderId={orderId}
        currentStatus={data.status}
        wireDetails={data.wireDetails}
      />

      {/* Society Fuckers Pre-booking / Bespoke Allocation Card */}
      {data.isPrebooking && (
        <div style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(20,20,20,0.95))', padding: '1.75rem', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.4)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,215,0,0.2)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#FFD700', margin: 0 }}>
              👑 Society Fu*kers Bespoke Allocation Application
            </h2>
            <span style={{ background: '#FFD700', color: '#000', fontWeight: 900, padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
              LUXURY PRE-BOOKING
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.9rem' }}>
            <div>
              <p style={{ margin: '0.35rem 0' }}><span style={{ color: '#aaa' }}>Client Name:</span> <strong>{data.prebookName || data.shippingAddress?.name || 'Anonymous'}</strong></p>
              <p style={{ margin: '0.35rem 0' }}><span style={{ color: '#aaa' }}>Contact Email:</span> <a href={`mailto:${data.prebookEmail || data.userEmail}`} style={{ color: '#FFD700', textDecoration: 'underline' }}>{data.prebookEmail || data.userEmail}</a></p>
              <p style={{ margin: '0.35rem 0' }}><span style={{ color: '#aaa' }}>Payment Method:</span> <strong style={{ color: '#FFD700' }}>{data.paymentGateway === 'wise_bank_transfer' ? '🏦 Wise / Wire Transfer' : data.paymentGateway?.toUpperCase() || 'PAYPAL'}</strong></p>
              <p style={{ margin: '0.35rem 0' }}><span style={{ color: '#aaa' }}>Deposit Amount:</span> <strong style={{ color: '#2ed573' }}>${data.total?.toFixed(2) || '500.00'}</strong></p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#FFD700', fontWeight: 800, marginBottom: '0.35rem' }}>CLIENT BESPOKE CUSTOMIZATION &amp; SIZING NOTES:</div>
              <p style={{ margin: 0, color: '#eee', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                {data.prebookMessage ? `"${data.prebookMessage}"` : 'No custom notes provided by client.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Buyer & User Info */}
        <div style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--coral-200, #ff4757)', marginTop: 0, borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
            👤 Buyer & Customer Intelligence
          </h2>
          <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ padding: '0.4rem 0', color: '#888' }}>Full Name:</td><td><strong>{data.shippingAddress?.name || 'Anonymous'}</strong></td></tr>
              <tr><td style={{ padding: '0.4rem 0', color: '#888' }}>Email:</td><td><a href={`mailto:${data.userEmail}`} style={{ color: '#70a1ff' }}>{data.userEmail || 'N/A'}</a></td></tr>
              <tr><td style={{ padding: '0.4rem 0', color: '#888' }}>User ID:</td><td><code style={{ background: '#222', padding: '2px 6px', borderRadius: '4px' }}>{data.userId || 'Guest'}</code></td></tr>
              <tr><td style={{ padding: '0.4rem 0', color: '#888' }}>Phone:</td><td>{data.shippingAddress?.phone || 'N/A'}</td></tr>
              <tr><td style={{ padding: '0.4rem 0', color: '#888' }}>Referral Code Used:</td><td>{data.referralCode || 'None'}</td></tr>
              <tr><td style={{ padding: '0.4rem 0', color: '#888' }}>Coupon Code Used:</td><td>{data.couponCode || 'None'}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Shipping Address */}
        <div style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--coral-200, #ff4757)', marginTop: 0, borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
            📍 Shipping Address
          </h2>
          {data.shippingAddress ? (
            <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{data.shippingAddress.name}</p>
              <p style={{ margin: 0 }}>{data.shippingAddress.street}</p>
              <p style={{ margin: 0 }}>{data.shippingAddress.city}, {data.shippingAddress.state} {data.shippingAddress.zip}</p>
              <p style={{ margin: 0, color: '#2ed573', fontWeight: 'bold' }}>{data.shippingAddress.country} (ISO Code)</p>
            </div>
          ) : (
            <p style={{ color: '#888' }}>No shipping address on file</p>
          )}
        </div>
      </div>

      {/* Payment Gateway & Financial Breakdown */}
      <div style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--coral-200, #ff4757)', marginTop: 0, borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
          💳 Payment Gateway & Financial Breakdown
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', fontSize: '0.9rem' }}>
          <div>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>Gateway Engine:</span> <strong>{data.paymentGateway ? data.paymentGateway.toUpperCase() : 'UNKNOWN'}</strong></p>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>Payment Captured:</span> <strong style={{ color: data.paymentCaptured ? '#2ed573' : '#ff4757' }}>{data.paymentCaptured ? 'TRUE' : 'FALSE'}</strong></p>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>PayPal Order ID:</span> <code>{data.paypalOrderId || 'N/A'}</code></p>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>PayPal Capture ID:</span> <code>{data.paypalCaptureId || 'N/A'}</code></p>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>Razorpay Order ID:</span> <code>{data.razorpayOrderId || 'N/A'}</code></p>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>Razorpay Payment ID:</span> <code>{data.razorpayPaymentId || 'N/A'}</code></p>
          </div>
          <div style={{ borderLeft: '1px solid #222', paddingLeft: '1.5rem' }}>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>Subtotal:</span> ${data.subtotal?.toFixed(2) || '0.00'}</p>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>Tax (8%):</span> ${data.tax?.toFixed(2) || '0.00'}</p>
            <p style={{ margin: '0.4rem 0' }}><span style={{ color: '#888' }}>Discount:</span> -${data.discount?.toFixed(2) || '0.00'}</p>
            <hr style={{ borderColor: '#222', margin: '0.5rem 0' }} />
            <p style={{ margin: '0.4rem 0', fontSize: '1.1rem', color: '#2ed573' }}><span style={{ color: '#888' }}>Grand Total Paid:</span> <strong>${data.total?.toFixed(2) || '0.00'}</strong></p>
          </div>
        </div>
      </div>

      {/* Ordered Items */}
      <div style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--coral-200, #ff4757)', marginTop: 0, borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
          👕 Purchased Line Items
        </h2>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #222', color: '#888' }}>
              <th style={{ padding: '0.5rem 0' }}>Product</th>
              <th>Variant</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Printify Product ID</th>
            </tr>
          </thead>
          <tbody>
            {(data.items || []).map((item: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '0.6rem 0' }}><strong>{item.title}</strong></td>
                <td>{item.variant?.title || item.variant?.id}</td>
                <td>{item.quantity}</td>
                <td>${item.price?.toFixed(2)}</td>
                <td><code>{item.printifyProductId || 'N/A'}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Audit Timeline & Jobs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* History Events */}
        <div style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--coral-200, #ff4757)', marginTop: 0, borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
            📜 Order Audit History
          </h2>
          {history.length > 0 ? (
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((ev: any, idx: number) => (
                <div key={idx} style={{ borderLeft: '2px solid var(--coral-200, #ff4757)', paddingLeft: '0.75rem' }}>
                  <div suppressHydrationWarning style={{ color: '#888' }}>{new Date(ev.timestamp).toLocaleString()} [{ev.actor}]</div>
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>{ev.event}</div>
                  {ev.metadata && <pre style={{ background: '#000', padding: '0.25rem', borderRadius: '4px', margin: '0.25rem 0 0', overflowX: 'auto', fontSize: '0.75rem' }}>{JSON.stringify(ev.metadata, null, 2)}</pre>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#888', fontSize: '0.85rem' }}>No history events recorded yet</p>
          )}
        </div>

        {/* Background Jobs */}
        <div style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--coral-200, #ff4757)', marginTop: 0, borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
            ⚙️ Orchestrator Background Jobs
          </h2>
          {jobs.length > 0 ? (
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {jobs.map((j: any) => (
                <div key={j.id} style={{ background: '#000', padding: '0.75rem', borderRadius: '4px', border: '1px solid #222' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#2ed573' }}>Job #{j.id.slice(-6)}</span>
                    <span style={{ color: j.status === 'completed' ? '#2ed573' : '#ff4757' }}>{j.status.toUpperCase()}</span>
                  </div>
                  <div style={{ color: '#888', marginTop: '0.25rem' }}>Created: {j.createdAt} | Attempts: {j.attemptCount}</div>
                  {j.lastError && <div style={{ color: '#ff4757', marginTop: '0.25rem' }}>Error: {j.lastError}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#888', fontSize: '0.85rem' }}>No background jobs enqueued yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
