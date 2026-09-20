import 'server-only';
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

function sanitizeErrorMessage(msg: unknown): string {
  if (!msg) return 'Unknown delivery error';
  const str = String(msg);
  return str
    .replace(/(password|pass|secret|token|key)=([^\s&;]+)/gi, '$1=[REDACTED]')
    .replace(/:([^\s@:]+)@/g, ':[REDACTED]@')
    .slice(0, 500);
}

function getFromEmail(): string {
  return process.env.SMTP_FROM || 'hello@gerkink.shop';
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
  const adminEmail = process.env.ADMIN_EMAIL || 'support@gerkink.shop';
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
          <strong>Action Required:</strong> Log in to your <strong>Wise Business account</strong>, choose send money, select email or bank transfer, and process a transfer of exactly <strong>$${typeof details.amount === 'number' ? details.amount.toFixed(2) : '0.00'} USD</strong> using the details above. Under the user agreement, the transfer fees will be deducted from this balance.
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
      from: `"GERKINK Referrals" <${getFromEmail()}>`,
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
      errorMessage: sanitizeErrorMessage(err.message),
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
  const adminEmail = process.env.ADMIN_EMAIL || 'support@gerkink.shop';
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
      from: `"GERKINK Prebookings" <${getFromEmail()}>`,
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
      errorMessage: sanitizeErrorMessage(err.message),
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
          $${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)} USD
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
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${(Number(order.subtotal) || 0).toFixed(2)} USD</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8b949e;">Tax:</td>
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${(Number(order.tax) || 0).toFixed(2)} USD</td>
          </tr>
          ${order.discount ? `
          <tr>
            <td style="padding: 4px 0; color: #ff6b6b;">Discount:</td>
            <td style="padding: 4px 0; text-align: right; color: #ff6b6b;">-$${(Number(order.discount) || 0).toFixed(2)} USD</td>
          </tr>` : ''}
          <tr style="font-size: 16px; font-weight: bold;">
            <td style="padding: 12px 0 0; color: #f3f4f6; border-top: 1px solid #21262d;">Grand Total:</td>
            <td style="padding: 12px 0 0; text-align: right; color: #238636; border-top: 1px solid #21262d;">$${(Number(order.total) || 0).toFixed(2)} USD</td>
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
      from: `"GERKINK" <${getFromEmail()}>`,
      to: customerEmail,
      subject,
      html: htmlBody,
    });

    console.log(`Order confirmation email successfully sent to [REDACTED]`);

    await adminDb.collection('system_emails').add({
      to: customerEmail,
      subject,
      html: htmlBody,
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
      errorMessage: sanitizeErrorMessage(err.message),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function sendAdminOrderNotification(order: Order): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'support@gerkink.shop';
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
          $${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)} USD
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
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${(Number(order.subtotal) || 0).toFixed(2)} USD</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8b949e;">Tax:</td>
            <td style="padding: 4px 0; text-align: right; color: #c9d1d9;">$${(Number(order.tax) || 0).toFixed(2)} USD</td>
          </tr>
          ${order.discount ? `
          <tr>
            <td style="padding: 4px 0; color: #ff6b6b;">Discount:</td>
            <td style="padding: 4px 0; text-align: right; color: #ff6b6b;">-$${(Number(order.discount) || 0).toFixed(2)} USD</td>
          </tr>` : ''}
          <tr style="font-size: 16px; font-weight: bold;">
            <td style="padding: 12px 0 0; color: #f3f4f6; border-top: 1px solid #21262d;">Grand Total:</td>
            <td style="padding: 12px 0 0; text-align: right; color: #238636; border-top: 1px solid #21262d;">$${(Number(order.total) || 0).toFixed(2)} USD</td>
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
      from: `"GERKINK Order Alerts" <${getFromEmail()}>`,
      to: adminEmail,
      subject,
      html: htmlBody,
    });

    console.log(`Admin order notification email successfully sent to ${adminEmail}`);

    await adminDb.collection('system_emails').add({
      to: adminEmail,
      subject,
      html: htmlBody,
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
      errorMessage: sanitizeErrorMessage(err.message),
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
    adminDb.collection('orders').doc(orderId).set({ emailSent: true }, { merge: true }).catch((err) => {
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
  const adminEmail = process.env.ADMIN_EMAIL || 'support@gerkink.shop';
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
      from: `"GERKINK Contact Form" <${getFromEmail()}>`,
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
      errorMessage: sanitizeErrorMessage(err.message),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export interface PayoutStatusDetails {
  userEmail: string;
  userName: string;
  amount: number;
  method: string;
  approved: boolean;
  adminNote?: string;
}

/**
 * Notifies an affiliate that their payout request was approved or rejected.
 * Uses the same SMTP-with-Firestore-fallback pattern as other transactional mail.
 */
export async function sendPayoutStatusEmail(details: PayoutStatusDetails): Promise<void> {
  const escapedName = escapeHtml(details.userName);
  const escapedNote = details.adminNote ? escapeHtml(details.adminNote) : '';
  const subject = details.approved
    ? `✅ Payout Approved — $${details.amount.toFixed(2)} USD on its way`
    : `❌ Payout Request Update — $${details.amount.toFixed(2)} USD`;

  const htmlBody = `
    <div style="font-family: 'Inter', sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <h2 style="color: ${details.approved ? '#238636' : '#ff6b6b'}; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 12px;">
        ${details.approved ? 'Payout Approved' : 'Payout Request Rejected'}
      </h2>
      <div style="background-color: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #21262d; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; font-weight: 600; color: #8b949e; width: 120px;">Affiliate:</td><td style="padding: 6px 0; color: #c9d1d9;">${escapedName}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Amount:</td><td style="padding: 6px 0; color: #238636; font-weight: bold;">$${typeof details.amount === 'number' ? details.amount.toFixed(2) : '0.00'} USD</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600; color: #8b949e;">Method:</td><td style="padding: 6px 0; color: #c9d1d9; text-transform: uppercase;">${escapeHtml(details.method)}</td></tr>
        </table>
      </div>
      ${!details.approved && escapedNote ? `
      <div style="background-color: #161b22; padding: 16px; border-radius: 8px; border-left: 4px solid #ff6b6b; margin-top: 16px;">
        <p style="margin: 0; font-size: 14px; color: #c9d1d9;"><strong>Admin Note:</strong> ${escapedNote}</p>
        <p style="margin: 12px 0 0; font-size: 14px; color: #8b949e;">The claimed amount has been returned to your available wallet balance. You may re-submit a claim with corrected payout details.</p>
      </div>` : ''}
      ${details.approved ? `
      <div style="background-color: #161b22; padding: 16px; border-radius: 8px; border-left: 4px solid #238636; margin-top: 16px;">
        <p style="margin: 0; font-size: 14px; color: #c9d1d9;">Your commission transfer is being processed manually by our treasury desk. Depending on your payout method, funds should arrive within 1–3 business days.</p>
      </div>` : ''}
      <p style="font-size: 12px; color: #8b949e; margin-top: 32px; text-align: center; border-top: 1px solid #1f2937; padding-top: 16px;">
        Sent automatically by GERKINK Referral System.
      </p>
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass || !host) {
    await adminDb.collection('system_emails').add({
      to: details.userEmail,
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
      from: `"GERKINK Referrals" <${getFromEmail()}>`,
      to: details.userEmail,
      subject,
      html: htmlBody,
    });
    await adminDb.collection('system_emails').add({
      to: details.userEmail,
      subject,
      html: htmlBody,
      status: 'sent',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Failed to send payout status email:', err.message);
    await adminDb.collection('system_emails').add({
      to: details.userEmail,
      subject,
      html: htmlBody,
      status: 'failed_smtp_delivery',
      errorMessage: sanitizeErrorMessage(err.message),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export interface ReviewRequestDetails {
  orderId: string;
  userEmail: string;
  userName?: string;
  productId: string;
  productTitle: string;
  reviewUrl: string;
}

/**
 * Sends a post-delivery review request email inviting the customer to leave verified feedback.
 */
export async function sendPostDeliveryReviewRequestEmail(details: ReviewRequestDetails): Promise<void> {
  const subject = `★ GERKINK Wants Your Verdict — ${details.productTitle}`;
  const escapedName = escapeHtml(details.userName || 'Customer');
  const escapedTitle = escapeHtml(details.productTitle);
  const reviewLink = details.reviewUrl;

  const htmlBody = `
    <div style="font-family: 'Inter', sans-serif; background-color: #07090e; color: #f3f4f6; padding: 36px 24px; border-radius: 12px; max-width: 580px; margin: 0 auto; border: 1px solid #1f2937;">
      <p style="font-family: monospace; color: #ff6b6b; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px;">
        VERIFIED CUSTOMER INVITATION
      </p>

      <h2 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 16px 0; letter-spacing: -0.03em;">
        How does it look in public, ${escapedName}?
      </h2>

      <p style="font-size: 15px; line-height: 1.6; color: #c9d1d9; margin-bottom: 24px;">
        You bought <strong>${escapedTitle}</strong>. You received it. Now tell us whether it deserved the space in your wardrobe.
      </p>

      <div style="background-color: #0d1117; padding: 24px; border-radius: 8px; border: 1px solid #21262d; text-align: center; margin: 28px 0;">
        <div style="color: #ff6b6b; font-size: 28px; letter-spacing: 4px; margin-bottom: 16px;">
          ★ ★ ★ ★ ★
        </div>
        <p style="font-size: 13px; color: #8b949e; margin-bottom: 20px;">
          Candid thoughts on fabric weight, collar lock, sizing, and reaction from strangers.
        </p>
        <a href="${reviewLink}" style="display: inline-block; background-color: #ff6b6b; color: #07090e; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;">
          Leave Your Verified Review →
        </a>
      </div>

      <p style="font-size: 12px; color: #8b949e; line-height: 1.5; text-align: center; border-top: 1px solid #1f2937; padding-top: 20px; margin-top: 32px;">
        This single-use link is cryptographically tied to Order #${details.orderId.slice(0, 8)}.<br/>
        GERKINK · Provocative Luxury Streetwear.
      </p>
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass || !host) {
    console.log('[sendPostDeliveryReviewRequestEmail] SMTP not configured. Storing in system_emails collection...');
    await adminDb.collection('system_emails').add({
      to: details.userEmail,
      subject,
      html: htmlBody,
      reviewUrl: reviewLink,
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
      from: `"GERKINK" <${getFromEmail()}>`,
      to: details.userEmail,
      subject,
      html: htmlBody,
    });
    await adminDb.collection('system_emails').add({
      to: details.userEmail,
      subject,
      html: htmlBody,
      reviewUrl: reviewLink,
      status: 'sent',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Failed to send review request email:', err.message);
    await adminDb.collection('system_emails').add({
      to: details.userEmail,
      subject,
      html: htmlBody,
      reviewUrl: reviewLink,
      status: 'failed_smtp_delivery',
      errorMessage: sanitizeErrorMessage(err.message),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Ensures a post-delivery review request email is sent AT MOST ONCE per order.
 * Uses atomic Firestore `.create()` on `review_email_locks/{orderId}` to prevent duplicate email spam.
 */
export async function sendPostDeliveryReviewRequestEmailOnce(details: ReviewRequestDetails): Promise<boolean> {
  if (!details.orderId) {
    console.warn('[REVIEW-EMAIL-LOCK] Missing orderId, skipping review invitation dispatch.');
    return false;
  }

  const lockRef = adminDb.collection('review_email_locks').doc(details.orderId);
  try {
    await lockRef.create({
      orderId: details.orderId,
      productId: details.productId,
      userEmail: details.userEmail,
      sentAt: FieldValue.serverTimestamp(),
    });
    console.log(`[REVIEW-EMAIL-LOCK] Lock acquired for order ${details.orderId}. Dispatching review invitation...`);
  } catch (err: any) {
    const errStr = String(err?.message || err?.details || err || '').toLowerCase();
    const isAlreadyExists =
      err?.code === 6 ||
      err?.code === '6' ||
      err?.code === 'already-exists' ||
      errStr.includes('already') ||
      errStr.includes('exists');

    if (isAlreadyExists) {
      console.log(`[REVIEW-EMAIL-LOCK] 🛑 BLOCKED duplicate review request for order ${details.orderId} (Lock already exists).`);
      return false;
    }
    console.error(`[REVIEW-EMAIL-LOCK] Error creating review email lock for order ${details.orderId}:`, err);
    return false;
  }

  await sendPostDeliveryReviewRequestEmail(details);
  return true;
}

export const CUSTOM_DESIGN_STUDIO_EMAIL = process.env.CUSTOM_DESIGN_ALERT_EMAIL || 'custom@gerkink.shop';

export interface CustomDesignEmailDetails {
  type: 'request_submitted' | 'needs_information' | 'design_ready' | 'approval_received' | 'status_updated' | 'customer_message';
  requestId: string;
  requestNumber: string;
  customerEmail: string;
  customerName: string;
  productType?: string;
  plan?: string;
  prepaymentAmount?: number;
  message?: string;
  newStatus?: string;
  description?: string;
  preferredSize?: string;
  preferredColor?: string;
  productPreference?: string;
  additionalNotes?: string;
  uploads?: Array<{ originalName: string; size: number; storagePath?: string }>;
  paymentReference?: string;
}

export async function sendCustomDesignNotification(details: CustomDesignEmailDetails): Promise<void> {
  const planLabel = details.plan === 'better_quality' || details.plan === 'priority' ? 'Better Quality' : 'Regular';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gerkink.shop';
  const adminUrl = `${appUrl}/admin/custom-designs/${details.requestId}`;
  const accountUrl = `${appUrl}/account/custom-design/${details.requestId}`;

  interface OutboundMail {
    to: string;
    subject: string;
    html: string;
    type: string;
  }

  const outboundMails: OutboundMail[] = [];

  if (details.type === 'request_submitted') {
    // 1. Customer Confirmation Receipt Email
    const custSubject = `[CONFIRMED] Custom Request #${details.requestNumber} Received — $${details.prepaymentAmount || 15} USD`;
    const custHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
        <div style="border-bottom: 2px solid #ff6b6b; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; letter-spacing: 2px; color: #ff6b6b; font-weight: 700; text-transform: uppercase;">GERKINK CUSTOM STUDIO</span>
          <h2 style="margin: 8px 0 0 0; font-size: 22px; color: #ffffff; text-transform: uppercase;">CUSTOM DESIGN REQUEST RECEIVED</h2>
        </div>

        <p style="font-size: 14px; color: #9ca3af; margin-bottom: 20px;">
          Hello ${escapeHtml(details.customerName || 'Valued Customer')},
        </p>

        <div style="font-size: 14px; line-height: 1.6; color: #e5e7eb;">
          <p>Thank you for submitting your custom design concept to GERKINK.</p>
          <p>Your non-refundable prepayment of <strong>$${details.prepaymentAmount || 15} USD</strong> for the <strong>${planLabel}</strong> custom review tier has been confirmed.</p>
          <p>Our studio team is currently reviewing your uploaded files and concept. You will be notified as your request progresses.</p>
        </div>

        <div style="background-color: #0d1117; padding: 16px; border-radius: 6px; border: 1px solid #21262d; margin: 24px 0;">
          <table style="width: 100%; font-size: 13px; color: #c9d1d9; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #8b949e; width: 140px;">Request Number:</td>
              <td style="padding: 4px 0; font-weight: 600; font-family: monospace;">#${details.requestNumber}</td>
            </tr>
            ${details.productType ? `
            <tr>
              <td style="padding: 4px 0; color: #8b949e;">Product Type:</td>
              <td style="padding: 4px 0; font-weight: 600;">${details.productType}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 4px 0; color: #8b949e;">Prepayment:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #2ed573;">$${details.prepaymentAmount || 15} USD PAID ✓</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${accountUrl}" style="display: inline-block; background-color: #ff6b6b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
            VIEW YOUR REQUEST →
          </a>
        </div>

        <p style="font-size: 12px; color: #8b949e; line-height: 1.5; text-align: center; border-top: 1px solid #1f2937; padding-top: 20px; margin-top: 32px;">
          GERKINK · Provocative Luxury Streetwear.<br/>
          This email was sent to ${escapeHtml(details.customerEmail)}.
        </p>
      </div>
    `;
    outboundMails.push({
      to: details.customerEmail,
      subject: custSubject,
      html: custHtml,
      type: 'request_submitted_customer',
    });

    // 2. GERKINK Atelier Studio Intake Email (sent to custom@gerkink.shop)
    const studioSubject = `🎨 [NEW CUSTOM REQUEST] #${details.requestNumber} — ${details.productType || 'Custom Piece'} ($${details.prepaymentAmount || 15} USD Paid)`;
    const uploadsListHtml = details.uploads && details.uploads.length > 0
      ? details.uploads.map((u) => `<li>${escapeHtml(u.originalName)} (${(u.size / 1024 / 1024).toFixed(2)} MB)</li>`).join('')
      : '<li>No files uploaded</li>';

    const studioHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
        <div style="border-bottom: 2px solid #ff6b6b; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; letter-spacing: 2px; color: #ff6b6b; font-weight: 700; text-transform: uppercase;">GERKINK ATELIER DESK</span>
          <h2 style="margin: 8px 0 0 0; font-size: 22px; color: #ffffff; text-transform: uppercase;">NEW CUSTOM DESIGN INTAKE</h2>
        </div>

        <div style="background-color: #0d1117; padding: 18px; border-radius: 8px; border: 1px solid #21262d; margin-bottom: 24px;">
          <table style="width: 100%; font-size: 13px; color: #c9d1d9; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #8b949e; width: 140px;">Request Number:</td>
              <td style="padding: 6px 0; font-weight: 700; font-family: monospace; color: #ff6b6b;">#${details.requestNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Customer:</td>
              <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(details.customerName)} (${escapeHtml(details.customerEmail)})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Garment Type:</td>
              <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(details.productType || 'Custom')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Prepayment Level:</td>
              <td style="padding: 6px 0; font-weight: 700;">${planLabel} ($${details.prepaymentAmount || 15} USD)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Prepayment Status:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #2ed573;">$${details.prepaymentAmount || 15} USD PAID ✓</td>
            </tr>
            ${details.paymentReference ? `
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Capture Reference:</td>
              <td style="padding: 6px 0; font-family: monospace;">${escapeHtml(details.paymentReference)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Preferred Size:</td>
              <td style="padding: 6px 0;">${escapeHtml(details.preferredSize || 'Not specified')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Preferred Color:</td>
              <td style="padding: 6px 0;">${escapeHtml(details.preferredColor || 'Not specified')}</td>
            </tr>
            ${details.productPreference ? `
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Fit &amp; Finishing:</td>
              <td style="padding: 6px 0;">${escapeHtml(details.productPreference)}</td>
            </tr>
            ` : ''}
            ${details.additionalNotes ? `
            <tr>
              <td style="padding: 6px 0; color: #8b949e;">Additional Notes:</td>
              <td style="padding: 6px 0;">${escapeHtml(details.additionalNotes)}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <h3 style="font-size: 14px; text-transform: uppercase; color: #ff6b6b; margin: 0 0 8px 0;">Customer Idea / Concept Description</h3>
        <div style="background-color: #161b22; padding: 16px; border-radius: 6px; border-left: 3px solid #ff6b6b; margin-bottom: 24px; font-size: 14px; line-height: 1.6; color: #f3f4f6; white-space: pre-wrap;">
          ${escapeHtml(details.description || 'No description provided')}
        </div>

        <h3 style="font-size: 14px; text-transform: uppercase; color: #8b949e; margin: 0 0 8px 0;">Uploaded Artwork Files (${details.uploads?.length || 0})</h3>
        <ul style="color: #c9d1d9; font-size: 13px; margin: 0 0 24px 0; padding-left: 20px; line-height: 1.6;">
          ${uploadsListHtml}
        </ul>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${adminUrl}" style="display: inline-block; background-color: #ff6b6b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
            OPEN IN ADMIN STUDIO →
          </a>
        </div>

        <p style="font-size: 12px; color: #8b949e; line-height: 1.5; text-align: center; border-top: 1px solid #1f2937; padding-top: 20px; margin-top: 32px;">
          Dispatched to GERKINK Custom Atelier Desk (<a href="mailto:${CUSTOM_DESIGN_STUDIO_EMAIL}" style="color: #8b949e;">${CUSTOM_DESIGN_STUDIO_EMAIL}</a>).
        </p>
      </div>
    `;
    outboundMails.push({
      to: CUSTOM_DESIGN_STUDIO_EMAIL,
      subject: studioSubject,
      html: studioHtml,
      type: 'request_submitted_studio',
    });
  } else if (details.type === 'customer_message') {
    // Alert to custom@gerkink.shop when customer sends a message
    const subject = `💬 [STUDIO DIALOGUE] Request #${details.requestNumber} — Message from ${details.customerName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
        <div style="border-bottom: 2px solid #ff6b6b; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; letter-spacing: 2px; color: #ff6b6b; font-weight: 700; text-transform: uppercase;">GERKINK ATELIER DESK</span>
          <h2 style="margin: 8px 0 0 0; font-size: 22px; color: #ffffff; text-transform: uppercase;">CUSTOMER MESSAGE RECEIVED</h2>
        </div>

        <p style="font-size: 14px; color: #c9d1d9; margin-bottom: 16px;">
          <strong>${escapeHtml(details.customerName)}</strong> (${escapeHtml(details.customerEmail)}) sent a message regarding custom request <strong>#${details.requestNumber}</strong>:
        </p>

        <div style="background-color: #161b22; padding: 18px; border-radius: 6px; border-left: 3px solid #ff6b6b; margin: 18px 0; font-size: 14px; line-height: 1.6; color: #f3f4f6; white-space: pre-wrap;">
          ${escapeHtml(details.message || '')}
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${adminUrl}" style="display: inline-block; background-color: #ff6b6b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
            REPLY IN ADMIN STUDIO →
          </a>
        </div>

        <p style="font-size: 12px; color: #8b949e; line-height: 1.5; text-align: center; border-top: 1px solid #1f2937; padding-top: 20px; margin-top: 32px;">
          Dispatched to GERKINK Custom Atelier Desk (${CUSTOM_DESIGN_STUDIO_EMAIL}).
        </p>
      </div>
    `;
    outboundMails.push({
      to: CUSTOM_DESIGN_STUDIO_EMAIL,
      subject,
      html,
      type: 'customer_message_studio',
    });
  } else if (details.type === 'approval_received') {
    // Alert to custom@gerkink.shop when customer approves design proof
    const subject = `✦ [DESIGN APPROVED] Request #${details.requestNumber} Approved by ${details.customerName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
        <div style="border-bottom: 2px solid #2ed573; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; letter-spacing: 2px; color: #2ed573; font-weight: 700; text-transform: uppercase;">GERKINK ATELIER DESK</span>
          <h2 style="margin: 8px 0 0 0; font-size: 22px; color: #ffffff; text-transform: uppercase;">DESIGN PROOF APPROVED</h2>
        </div>

        <p style="font-size: 14px; color: #c9d1d9; line-height: 1.6;">
          Customer <strong>${escapeHtml(details.customerName)}</strong> (${escapeHtml(details.customerEmail)}) has officially approved the design proof for request <strong>#${details.requestNumber}</strong>.
        </p>

        <p style="font-size: 14px; color: #c9d1d9; line-height: 1.6;">
          Status is now <strong>${escapeHtml(details.newStatus || 'APPROVED')}</strong>.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${adminUrl}" style="display: inline-block; background-color: #2ed573; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
            VIEW IN ADMIN STUDIO →
          </a>
        </div>

        <p style="font-size: 12px; color: #8b949e; line-height: 1.5; text-align: center; border-top: 1px solid #1f2937; padding-top: 20px; margin-top: 32px;">
          Dispatched to GERKINK Custom Atelier Desk (${CUSTOM_DESIGN_STUDIO_EMAIL}).
        </p>
      </div>
    `;
    outboundMails.push({
      to: CUSTOM_DESIGN_STUDIO_EMAIL,
      subject,
      html,
      type: 'approval_received_studio',
    });
  } else {
    // Customer status updates (needs_information, design_ready, status_updated)
    let subject = `Custom Design #${details.requestNumber} — GERKINK`;
    let headline = 'Custom Design Update';
    let bodyContent = '';

    if (details.type === 'needs_information') {
      subject = `[ACTION REQUIRED] Studio Inquiry for Request #${details.requestNumber}`;
      headline = 'WE NEED SOMETHING FROM YOU';
      bodyContent = `
        <p>The GERKINK studio team has a question regarding your custom design request:</p>
        <div style="background-color: #161b22; padding: 16px; border-left: 3px solid #ff6b6b; margin: 16px 0; font-style: italic;">
          "${escapeHtml(details.message || 'Please check your account for details.')}"
        </div>
        <p>Please log in to your account to review and reply so we can continue crafting your piece.</p>
      `;
    } else if (details.type === 'design_ready') {
      subject = `[APPROVAL REQUIRED] Design Concept Ready for Request #${details.requestNumber}`;
      headline = 'YOUR DESIGN IS READY FOR APPROVAL';
      bodyContent = `
        <p>Your custom design preparation is complete and awaiting your sign-off.</p>
        <p>Please review the design artwork and specifications in your account and confirm approval to advance to production.</p>
      `;
    } else {
      subject = `Status Update: Custom Request #${details.requestNumber} is now ${details.newStatus}`;
      headline = `STATUS: ${details.newStatus || 'UPDATED'}`;
      bodyContent = `<p>Your custom design request has moved to <strong>${details.newStatus}</strong>.</p>`;
    }

    const custHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #07090e; color: #f3f4f6; padding: 32px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
        <div style="border-bottom: 2px solid #ff6b6b; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; letter-spacing: 2px; color: #ff6b6b; font-weight: 700; text-transform: uppercase;">GERKINK CUSTOM STUDIO</span>
          <h2 style="margin: 8px 0 0 0; font-size: 22px; color: #ffffff; text-transform: uppercase;">${headline}</h2>
        </div>

        <p style="font-size: 14px; color: #9ca3af; margin-bottom: 20px;">
          Hello ${escapeHtml(details.customerName || 'Valued Customer')},
        </p>

        <div style="font-size: 14px; line-height: 1.6; color: #e5e7eb;">
          ${bodyContent}
        </div>

        <div style="background-color: #0d1117; padding: 16px; border-radius: 6px; border: 1px solid #21262d; margin: 24px 0;">
          <table style="width: 100%; font-size: 13px; color: #c9d1d9; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #8b949e; width: 140px;">Request Number:</td>
              <td style="padding: 4px 0; font-weight: 600; font-family: monospace;">#${details.requestNumber}</td>
            </tr>
            ${details.productType ? `
            <tr>
              <td style="padding: 4px 0; color: #8b949e;">Product Type:</td>
              <td style="padding: 4px 0; font-weight: 600;">${details.productType}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${accountUrl}" style="display: inline-block; background-color: #ff6b6b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
            VIEW IN ACCOUNT →
          </a>
        </div>

        <p style="font-size: 12px; color: #8b949e; line-height: 1.5; text-align: center; border-top: 1px solid #1f2937; padding-top: 20px; margin-top: 32px;">
          GERKINK · Provocative Luxury Streetwear.<br/>
          This email was sent to ${escapeHtml(details.customerEmail)}.
        </p>
      </div>
    `;
    outboundMails.push({
      to: details.customerEmail,
      subject,
      html: custHtml,
      type: details.type,
    });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass || !host) {
    console.log('[sendCustomDesignNotification] SMTP not configured. Writing to system_emails collection...');
    for (const mail of outboundMails) {
      await adminDb.collection('system_emails').add({
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        type: mail.type,
        requestId: details.requestId,
        status: 'pending_smtp_config',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    for (const mail of outboundMails) {
      await transporter.sendMail({
        from: `"GERKINK Custom Studio" <${getFromEmail()}>`,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
      });

      await adminDb.collection('system_emails').add({
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        type: mail.type,
        requestId: details.requestId,
        status: 'sent',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (err: any) {
    console.error('[sendCustomDesignNotification] Failed to send email:', err.message);
    for (const mail of outboundMails) {
      await adminDb.collection('system_emails').add({
        to: mail.to,
        subject: mail.subject,
        type: mail.type,
        requestId: details.requestId,
        status: 'failed',
        error: sanitizeErrorMessage(err.message),
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
}
