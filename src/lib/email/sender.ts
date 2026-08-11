import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/types';

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface PayoutAlertDetails {
  userName: string;
  userEmail: string;
  method: 'wise' | 'paypal' | 'bank';
  payoutDetails: string;
  amount: number;
}

/**
 * Sends an email notification to the administrator when a payout is requested.
 * Logs to Firestore fallback if SMTP details are missing or fail.
 */
export async function sendAdminPayoutAlert(details: PayoutAlertDetails): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'gerkinkofficial@gmail.com';
  const subject = `💸 [ACTION REQUIRED] New Affiliate Payout Request - $${details.amount.toFixed(2)} USD`;
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

  const escapedName = escapeHtml(details.userName);
  const escapedEmail = escapeHtml(details.userEmail);
  const escapedPayoutDetails = escapeHtml(details.payoutDetails);

  const htmlBody = `
    <div style="font-family: 'Inter', sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <h2 style="color: #ff6b6b; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 12px;">
        New Affiliate Payout Request
      </h2>
      
      <p style="font-size: 16px; line-height: 1.6;">
        A new affiliate commission payout has been requested and requires manual processing.
      </p>
 
      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">Affiliate Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e; width: 140px;">Name:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">${escapedName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Email:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">${escapedEmail}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Date Requested:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Amount:</td>
            <td style="padding: 6px 0; color: #238636; font-weight: bold;">$${details.amount.toFixed(2)} USD</td>
          </tr>
        </table>
      </div>
 
      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">Payout Preference</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e; width: 140px;">Method:</td>
            <td style="padding: 6px 0; color: #c9d1d9; text-transform: uppercase; font-weight: bold;">${details.method}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e; vertical-align: top;">Details:</td>
            <td style="padding: 6px 0; color: #c9d1d9; white-space: pre-wrap; font-family: monospace;">${escapedPayoutDetails}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #161b22; padding: 16px; border-radius: 8px; border-left: 4px solid #d29922; margin-top: 32px;">
        <p style="margin: 0; font-size: 14px; color: #c9d1d9;">
          <strong>Action Required:</strong> Log in to your <strong>Wise Business account</strong>, choose send money, select email or bank transfer, and process a transfer of exactly <strong>$100.00 USD</strong> using the details above. Under the user agreement, the transfer fees will be deducted from this balance.
        </p>
      </div>
      
      <p style="font-size: 12px; color: #8b949e; margin-top: 32px; text-align: center; border-top: 1px solid #1f2937; padding-top: 16px;">
        Sent automatically by GERKINK Referral System.
      </p>
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  // Symmetrical fallback if SMTP credentials are not set up or configured
  if (!user || !pass || !host) {
    console.warn('SMTP Credentials missing. Writing alert payload to Firestore "system_emails" collection...');
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'pending_smtp_config',
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"GERKINK Referrals" <${user}>`,
      to: adminEmail,
      subject,
      html: htmlBody,
    });

    console.log(`Alert email successfully sent to ${adminEmail}`);

    // Log to Firestore for audit purposes
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      status: 'sent',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Failed to send SMTP email. Writing to fallback log database:', err.message);
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'failed_smtp_delivery',
      errorMessage: err.message,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export interface PrebookAlertDetails {
  userName: string;
  userEmail: string;
  productTitle: string;
  prebookingPricePaid: number;
  message: string;
}

export async function sendAdminPrebookNotification(details: PrebookAlertDetails): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'gerkinkofficial@gmail.com';
  const escapedProductTitle = escapeHtml(details.productTitle);
  const subject = `🔥 [PRE-BOOKING PAID] Custom Request for ${escapedProductTitle}`;
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

  const escapedName = escapeHtml(details.userName);
  const escapedEmail = escapeHtml(details.userEmail);
  const escapedMessage = escapeHtml(details.message);

  const htmlBody = `
    <div style="font-family: 'Inter', sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <h2 style="color: #ff6b6b; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 12px;">
        Luxury Product Pre-booking Paid
      </h2>
      
      <p style="font-size: 16px; line-height: 1.6;">
        A user has paid the non-refundable pre-booking fee for a luxury product and wants to discuss it with you.
      </p>

      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">Pre-booking Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e; width: 140px;">Product:</td>
            <td style="padding: 6px 0; color: #c9d1d9; font-weight: bold;">${escapedProductTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Amount Paid:</td>
            <td style="padding: 6px 0; color: #238636; font-weight: bold;">$${details.prebookingPricePaid.toFixed(2)} USD (Non-refundable)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Date Paid:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">${dateStr}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">Customer Contact</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e; width: 140px;">Name:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">${escapedName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Email:</td>
            <td style="padding: 6px 0; color: #c9d1d9;"><a href="mailto:${escapedEmail}" style="color: #58a6ff; text-decoration: none;">${escapedEmail}</a></td>
          </tr>
        </table>
      </div>

      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">User Inquiry / Message</h3>
        <p style="margin: 0; padding: 6px 0; color: #c9d1d9; white-space: pre-wrap; font-style: italic; line-height: 1.6;">"${escapedMessage || 'No message provided.'}"</p>
      </div>

      <div style="background-color: #161b22; padding: 16px; border-radius: 8px; border-left: 4px solid #d29922; margin-top: 32px;">
        <p style="margin: 0; font-size: 14px; color: #c9d1d9;">
          <strong>Action Required:</strong> Reach out to the customer at <strong>${escapedEmail}</strong> within 24 hours to discuss their design preferences, customization options, and finalize their order.
        </p>
      </div>
      
      <p style="font-size: 12px; color: #8b949e; margin-top: 32px; text-align: center; border-top: 1px solid #1f2937; padding-top: 16px;">
        Sent automatically by GERKINK Prebooking System.
      </p>
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  // Symmetrical fallback if SMTP credentials are not set up or configured
  if (!user || !pass || !host) {
    console.warn('SMTP Credentials missing. Writing alert payload to Firestore "system_emails" collection...');
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'pending_smtp_config',
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"GERKINK Prebookings" <${user}>`,
      to: adminEmail,
      subject,
      html: htmlBody,
    });

    console.log(`Prebook email successfully sent to ${adminEmail}`);

    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      status: 'sent',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Failed to send SMTP prebook email. Writing to fallback log database:', err.message);
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'failed_smtp_delivery',
      errorMessage: err.message,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function sendOrderConfirmationEmail(order: Order): Promise<void> {
  const customerEmail = order.userEmail;
  const subject = `🛒 Order Confirmed - GERKINK #${order.id.slice(0, 8).toUpperCase()}`;

  const itemsHtml = order.items.map((item) => {
    const escapedTitle = escapeHtml(item.title);
    const escapedSize = escapeHtml(item.variant.size);
    const escapedColor = escapeHtml(item.variant.color);
    return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937; color: #c9d1d9;">
          <span style="font-weight: bold; color: #f3f4f6;">${escapedTitle}</span><br />
          <span style="font-size: 12px; color: #8b949e;">Size: ${escapedSize} | Color: ${escapedColor}</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937; text-align: center; color: #c9d1d9;">
          × ${item.quantity}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937; text-align: right; color: #238636; font-weight: bold;">
          $${(item.price * item.quantity).toFixed(2)} USD
        </td>
      </tr>
    `;
  }).join('');

  let shippingHtml = '';
  if (order.shippingAddress) {
    const escapedName = escapeHtml(order.shippingAddress.name);
    const escapedStreet = escapeHtml(order.shippingAddress.street);
    const escapedCity = escapeHtml(order.shippingAddress.city);
    const escapedState = escapeHtml(order.shippingAddress.state);
    const escapedZip = escapeHtml(order.shippingAddress.zip);
    const escapedCountry = escapeHtml(order.shippingAddress.country);
    const escapedPhone = order.shippingAddress.phone ? escapeHtml(order.shippingAddress.phone) : '';

    shippingHtml = `
      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">Shipping Address</h3>
        <p style="margin: 0; color: #c9d1d9; line-height: 1.6;">
          <strong>${escapedName}</strong><br />
          ${escapedStreet}<br />
          ${escapedCity}, ${escapedState} ${escapedZip}<br />
          ${escapedCountry}<br />
          ${escapedPhone ? `Phone: ${escapedPhone}` : ''}
        </p>
      </div>
    `;
  }

  const htmlBody = `
    <div style="font-family: 'Inter', sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <h2 style="color: #ff6b6b; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 12px; text-align: center;">
        Your Order is Confirmed!
      </h2>
      
      <p style="font-size: 16px; line-height: 1.6; text-align: center;">
        Thank you for shopping with <strong>GERKINK</strong>. We've received your order and are processing it.
      </p>

      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px; border-bottom: 1px solid #21262d; padding-bottom: 8px;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; padding-bottom: 8px; color: #8b949e; font-size: 12px; text-transform: uppercase;">Item</th>
              <th style="text-align: center; padding-bottom: 8px; color: #8b949e; font-size: 12px; text-transform: uppercase;">Qty</th>
              <th style="text-align: right; padding-bottom: 8px; color: #8b949e; font-size: 12px; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <table style="width: 100%; margin-top: 16px; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #8b949e;">Subtotal:</td>
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${order.subtotal.toFixed(2)} USD</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8b949e;">Tax:</td>
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${order.tax.toFixed(2)} USD</td>
          </tr>
          ${order.discount ? `
          <tr>
            <td style="padding: 4px 0; color: #ff6b6b;">Discount:</td>
            <td style="padding: 4px 0; text-align: right; color: #ff6b6b;">-$${order.discount.toFixed(2)} USD</td>
          </tr>` : ''}
          <tr style="font-size: 16px; font-weight: bold;">
            <td style="padding: 12px 0 0; color: #f3f4f6; border-top: 1px solid #21262d;">Grand Total:</td>
            <td style="padding: 12px 0 0; text-align: right; color: #238636; border-top: 1px solid #21262d;">$${order.total.toFixed(2)} USD</td>
          </tr>
        </table>
      </div>

      ${shippingHtml}

      <div style="background-color: #161b22; padding: 16px; border-radius: 8px; border-left: 4px solid #d29922; margin-top: 32px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #c9d1d9;">
          You can track your order status in your <a href="https://gerkink.shop/account" style="color: #58a6ff; text-decoration: none; font-weight: bold;">Account Dashboard</a>.
        </p>
      </div>
      
      <p style="font-size: 12px; color: #8b949e; margin-top: 32px; text-align: center; border-top: 1px solid #1f2937; padding-top: 16px;">
        Thank you for your business. GERKINK.
      </p>
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  // Symmetrical fallback if SMTP credentials are not set up or configured
  if (!user || !pass || !host) {
    console.warn('SMTP Credentials missing. Writing alert payload to Firestore "system_emails" collection...');
    await adminDb.collection('system_emails').add({
      to: customerEmail,
      subject,
      html: htmlBody,
      status: 'pending_smtp_config',
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"GERKINK" <${user}>`,
      to: customerEmail,
      subject,
      html: htmlBody,
    });

    console.log(`Order confirmation email successfully sent to [REDACTED]`);

    await adminDb.collection('system_emails').add({
      to: customerEmail,
      subject,
      status: 'sent',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Failed to send SMTP order confirmation email:', err.message);
    await adminDb.collection('system_emails').add({
      to: customerEmail,
      subject,
      html: htmlBody,
      status: 'failed_smtp_delivery',
      errorMessage: err.message,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function sendAdminOrderNotification(order: Order): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'gerkinkofficial@gmail.com';
  const subject = `🔔 NEW ORDER - GERKINK #${order.id.slice(0, 8).toUpperCase()}`;

  const itemsHtml = order.items.map((item) => {
    const escapedTitle = escapeHtml(item.title);
    const escapedSize = escapeHtml(item.variant.size);
    const escapedColor = escapeHtml(item.variant.color);
    return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937; color: #c9d1d9;">
          <span style="font-weight: bold; color: #f3f4f6;">${escapedTitle}</span><br />
          <span style="font-size: 12px; color: #8b949e;">Size: ${escapedSize} | Color: ${escapedColor}</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937; text-align: center; color: #c9d1d9;">
          × ${item.quantity}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937; text-align: right; color: #238636; font-weight: bold;">
          $${(item.price * item.quantity).toFixed(2)} USD
        </td>
      </tr>
    `;
  }).join('');

  let shippingHtml = '';
  if (order.shippingAddress) {
    const escapedName = escapeHtml(order.shippingAddress.name);
    const escapedStreet = escapeHtml(order.shippingAddress.street);
    const escapedCity = escapeHtml(order.shippingAddress.city);
    const escapedState = escapeHtml(order.shippingAddress.state);
    const escapedZip = escapeHtml(order.shippingAddress.zip);
    const escapedCountry = escapeHtml(order.shippingAddress.country);
    const escapedPhone = order.shippingAddress.phone ? escapeHtml(order.shippingAddress.phone) : '';

    shippingHtml = `
      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #ff6b6b; font-size: 18px;">Shipping Address</h3>
        <p style="margin: 0; color: #c9d1d9; line-height: 1.6;">
          <strong>${escapedName}</strong><br />
          ${escapedStreet}<br />
          ${escapedCity}, ${escapedState} ${escapedZip}<br />
          ${escapedCountry}<br />
          ${escapedPhone ? `Phone: ${escapedPhone}` : ''}
        </p>
      </div>
    `;
  }

  const escapedOrderId = escapeHtml(order.id);
  const escapedUserEmail = escapeHtml(order.userEmail);
  const escapedPaypalCaptureId = escapeHtml(order.paypalCaptureId || 'N/A');
  const escapedRazorpayPaymentId = escapeHtml(order.razorpayPaymentId || 'N/A');

  const htmlBody = `
    <div style="font-family: 'Inter', sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <h2 style="color: #ff6b6b; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 12px; text-align: center;">
        New Order Placed & Paid!
      </h2>
      
      <p style="font-size: 16px; line-height: 1.6; text-align: center;">
        A new order has been paid. Details are below:
      </p>

      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px; border-bottom: 1px solid #21262d; padding-bottom: 8px;">Order Details</h3>
        <p style="margin: 0 0 12px; font-size: 14px; color: #8b949e;">
          <strong>Order ID:</strong> #${escapedOrderId}<br />
          <strong>Customer Email:</strong> ${escapedUserEmail}<br />
          <strong>Transaction ID:</strong> ${order.paypalCaptureId ? escapedPaypalCaptureId : escapedRazorpayPaymentId}
        </p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; padding-bottom: 8px; color: #8b949e; font-size: 12px; text-transform: uppercase;">Item</th>
              <th style="text-align: center; padding-bottom: 8px; color: #8b949e; font-size: 12px; text-transform: uppercase;">Qty</th>
              <th style="text-align: right; padding-bottom: 8px; color: #8b949e; font-size: 12px; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <table style="width: 100%; margin-top: 16px; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #8b949e;">Subtotal:</td>
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${order.subtotal.toFixed(2)} USD</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8b949e;">Tax:</td>
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${order.tax.toFixed(2)} USD</td>
          </tr>
          ${order.discount ? `
          <tr>
            <td style="padding: 4px 0; color: #ff6b6b;">Discount:</td>
            <td style="padding: 4px 0; text-align: right; color: #ff6b6b;">-$${order.discount.toFixed(2)} USD</td>
          </tr>` : ''}
          <tr style="font-size: 16px; font-weight: bold;">
            <td style="padding: 12px 0 0; color: #f3f4f6; border-top: 1px solid #21262d;">Grand Total:</td>
            <td style="padding: 12px 0 0; text-align: right; color: #238636; border-top: 1px solid #21262d;">$${order.total.toFixed(2)} USD</td>
          </tr>
        </table>
      </div>

      ${shippingHtml}
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass || !host) {
    console.warn('SMTP Credentials missing. Writing alert payload to Firestore "system_emails" collection...');
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'pending_smtp_config',
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"GERKINK Order Alerts" <${user}>`,
      to: adminEmail,
      subject,
      html: htmlBody,
    });

    console.log(`Admin order notification email successfully sent to ${adminEmail}`);

    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      status: 'sent',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Failed to send SMTP admin order notification email:', err.message);
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'failed_smtp_delivery',
      errorMessage: err.message,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Ensures order confirmation & admin alert emails are sent AT MOST ONCE per order.
 * Uses atomic Firestore `.create()` on `order_email_locks/{orderId}` to prevent duplicate emails from concurrent webhook & client verify calls.
 */
export async function sendOrderConfirmationEmailsOnce(orderId: string, order: Order): Promise<boolean> {
  if (!orderId) {
    console.warn('[EMAIL-LOCK] Missing orderId, skipping email dispatch.');
    return false;
  }

  const lockRef = adminDb.collection('order_email_locks').doc(orderId);
  console.log(`[EMAIL-LOCK] Checking atomic lock for order: ${orderId}...`);

  try {
    // Atomically create lock document. Fails with ALREADY_EXISTS if already created.
    await lockRef.create({
      orderId,
      sentAt: FieldValue.serverTimestamp(),
    });
    console.log(`[EMAIL-LOCK] Lock acquired for order ${orderId}. Dispatching emails...`);
  } catch (err: any) {
    const errStr = String(err?.message || err?.details || err || '').toLowerCase();
    const isAlreadyExists =
      err?.code === 6 ||
      err?.code === '6' ||
      err?.code === 'already-exists' ||
      errStr.includes('already') ||
      errStr.includes('exists');

    if (isAlreadyExists) {
      console.log(`[EMAIL-LOCK] 🛑 BLOCKED duplicate email request for order ${orderId} (Lock already exists).`);
      return false;
    }
    console.error(`[EMAIL-LOCK] Error creating email lock for order ${orderId}:`, err);
    return false;
  }

  const results = await Promise.allSettled([
    sendOrderConfirmationEmail(order),
    sendAdminOrderNotification(order),
  ]);
  
  const confirmationSent = results[0].status === 'fulfilled';
  if (confirmationSent) {
    adminDb.collection('orders').doc(orderId).update({ emailSent: true }).catch((err) => {
      console.error(`[EMAIL-LOCK] Failed to set emailSent flag for order ${orderId}:`, err);
    });
  }
  console.log(`[EMAIL-LOCK] ✅ Confirmation & admin emails dispatched for order ${orderId}.`);
  return true;
}

export interface ContactMessageDetails {
  name: string;
  email: string;
  message: string;
}

/**
 * Sends an email notification to the administrator when a contact form is submitted.
 * Logs to Firestore fallback if SMTP details are missing or fail.
 */
export async function sendAdminContactMessage(details: ContactMessageDetails): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'gerkinkofficial@gmail.com';
  const escapedName = escapeHtml(details.name);
  const escapedEmail = escapeHtml(details.email);
  const escapedMessage = escapeHtml(details.message);
  const subject = `📥 New Contact Form Submission from ${escapedName}`;
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

  const htmlBody = `
    <div style="font-family: 'Inter', sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <h2 style="color: #ff6b6b; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 12px;">
        New Contact Message
      </h2>
      
      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">Sender Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e; width: 120px;">Name:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">${escapedName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Email:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">
              <a href="mailto:${escapedEmail}" style="color: #58a6ff; text-decoration: none;">${escapedEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Date:</td>
            <td style="padding: 6px 0; color: #c9d1d9;">${dateStr}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #58a6ff; font-size: 18px;">Message Content</h3>
        <div style="color: #c9d1d9; white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${escapedMessage}</div>
      </div>
      
      <p style="font-size: 12px; color: #8b949e; margin-top: 32px; text-align: center; border-top: 1px solid #1f2937; padding-top: 16px;">
        Sent automatically by GERKINK Storefront.
      </p>
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass || !host) {
    console.warn('SMTP Credentials missing. Writing contact email alert payload to Firestore "system_emails" collection...');
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'pending_smtp_config',
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"GERKINK Contact Form" <${user}>`,
      to: adminEmail,
      subject,
      html: htmlBody,
      replyTo: details.email
    });

    console.log(`Contact alert email successfully sent to ${adminEmail}`);

    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      status: 'sent',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Failed to send contact alert SMTP email. Writing to fallback log database:', err.message);
    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
      status: 'failed_smtp_delivery',
      errorMessage: err.message,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
