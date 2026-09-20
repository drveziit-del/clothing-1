import { z } from 'zod';
import type { Timestamp } from 'firebase-admin/firestore';

export type CustomDesignProductType = 'T-Shirt' | 'Hoodie' | 'Sweatshirt' | 'Accessory' | 'Other';

export type CustomDesignPlan = 'regular' | 'better_quality' | 'basic' | 'priority';

export interface PlanPricingItem {
  amount: number;
  currency: string;
  label: string;
  subhead: string;
  description: string;
  features: string[];
}

export const PLAN_PRICING: Record<CustomDesignPlan, PlanPricingItem> = {
  regular: {
    amount: 15,
    currency: 'USD',
    label: 'Regular',
    subhead: 'STANDARD CUSTOM DESIGN',
    description: 'For straightforward custom concepts.',
    features: [
      'Standard design review',
      'Feasibility assessment',
      'Standard artwork preparation',
      'Standard digital proof',
      'GERKINK studio feedback',
    ],
  },
  better_quality: {
    amount: 20,
    currency: 'USD',
    label: 'Better Quality',
    subhead: 'ENHANCED CUSTOM DESIGN',
    description: 'For customers who want more attention to the visual execution.',
    features: [
      'More detailed design review',
      'Enhanced artwork preparation',
      'More detailed digital proof',
      'Additional refinement',
      'GERKINK studio feedback',
    ],
  },
  // Backward compatibility internal aliases:
  basic: {
    amount: 15,
    currency: 'USD',
    label: 'Regular',
    subhead: 'STANDARD CUSTOM DESIGN',
    description: 'For straightforward custom concepts.',
    features: [
      'Standard design review',
      'Feasibility assessment',
      'Standard artwork preparation',
      'Standard digital proof',
      'GERKINK studio feedback',
    ],
  },
  priority: {
    amount: 20,
    currency: 'USD',
    label: 'Better Quality',
    subhead: 'ENHANCED CUSTOM DESIGN',
    description: 'For customers who want more attention to the visual execution.',
    features: [
      'More detailed design review',
      'Enhanced artwork preparation',
      'More detailed digital proof',
      'Additional refinement',
      'GERKINK studio feedback',
    ],
  },
};

export function normalizePlan(plan: string | undefined): 'regular' | 'better_quality' {
  if (plan === 'better_quality' || plan === 'priority') return 'better_quality';
  return 'regular';
}

export function formatPlanLabel(plan: string | undefined): string {
  return normalizePlan(plan) === 'better_quality' ? 'Better Quality' : 'Regular';
}

export const CURRENT_POLICY_VERSION = 'v1_non_refundable_prepayment';

export type CustomDesignStatus =
  | 'DRAFT'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_PAID'
  | 'PAYMENT_FAILED'
  | 'MANUAL_REVIEW'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_INFORMATION'
  | 'DESIGN_IN_PROGRESS'
  | 'DESIGN_READY'
  | 'CUSTOMER_APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'FINAL_PAYMENT_PENDING'
  | 'READY_FOR_PRODUCTION'
  | 'IN_PRODUCTION'
  | 'FULFILLED'
  | 'CANCELLED';

export interface CustomDesignUpload {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedAt: string;
}

export interface CustomDesignMessage {
  id: string;
  sender: 'customer' | 'admin' | 'system';
  senderName: string;
  senderUid: string;
  message: string;
  timestamp: string;
}

export interface CustomDesignStatusHistory {
  from: CustomDesignStatus;
  to: CustomDesignStatus;
  actor: 'system' | 'customer' | 'admin';
  actorId?: string;
  timestamp: string;
  reason?: string;
}

export interface CustomDesignRequest {
  id: string; // Firestore doc ID
  requestId: string; // Human-friendly e.g. GK-CUS-1842
  userId: string;
  customerEmail: string;
  customerName: string;

  productType: CustomDesignProductType;
  preferredSize?: string;
  preferredColor?: string;
  productPreference?: string;
  description: string;
  additionalNotes?: string;

  uploads: CustomDesignUpload[];

  plan: CustomDesignPlan;
  prepaymentAmount: number; // 15 or 20 authoritative USD
  currency: 'USD';

  paymentProvider: 'paypal';
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'review_required';
  paymentReference?: string; // PayPal Capture ID
  paypalOrderId?: string;
  idempotencyKey?: string;

  reconciliationRequired?: boolean;
  reconciliationReason?: string;
  capturedAmount?: number;
  capturedCurrency?: string;

  paymentPolicyVersion: string;
  paymentPolicyAccepted: boolean;
  paymentPolicyAcceptedAt: string | Timestamp;

  status: CustomDesignStatus;
  statusHistory: CustomDesignStatusHistory[];

  adminNotes?: string;
  customerMessages: CustomDesignMessage[];

  finalPrice?: number;
  finalPaymentStatus?: 'unpaid' | 'pending' | 'paid';
  finalPaymentReference?: string;

  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface CustomerSafeCustomDesignUpload {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface CustomerSafeCustomDesignRequest {
  id: string;
  requestId: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  productType: CustomDesignProductType;
  preferredSize?: string;
  preferredColor?: string;
  productPreference?: string;
  description: string;
  additionalNotes?: string;
  uploads: CustomerSafeCustomDesignUpload[];
  plan: CustomDesignPlan;
  prepaymentAmount: number;
  currency: 'USD';
  paymentProvider: 'paypal';
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'review_required';
  paypalOrderId?: string;
  paymentPolicyVersion: string;
  paymentPolicyAccepted: boolean;
  paymentPolicyAcceptedAt: string | any;
  status: CustomDesignStatus;
  statusHistory: CustomDesignStatusHistory[];
  customerMessages: CustomDesignMessage[];
  finalPrice?: number;
  finalPaymentStatus?: 'unpaid' | 'pending' | 'paid';
  createdAt: string | any;
  updatedAt: string | any;
}

export function toCustomerSafeCustomDesignDto(docData: any, docId: string): CustomerSafeCustomDesignRequest {
  return {
    id: docId,
    requestId: docData.requestId || docId,
    userId: docData.userId || '',
    customerEmail: docData.customerEmail || '',
    customerName: docData.customerName || '',
    productType: docData.productType,
    preferredSize: docData.preferredSize,
    preferredColor: docData.preferredColor,
    productPreference: docData.productPreference,
    description: docData.description || '',
    additionalNotes: docData.additionalNotes,
    uploads: (docData.uploads || []).map((u: any) => ({
      fileId: u.fileId,
      originalName: u.originalName,
      mimeType: u.mimeType,
      size: u.size,
      uploadedAt: u.uploadedAt,
    })),
    plan: docData.plan,
    prepaymentAmount: docData.prepaymentAmount,
    currency: docData.currency || 'USD',
    paymentProvider: docData.paymentProvider || 'paypal',
    paymentStatus: docData.paymentStatus || 'pending',
    paypalOrderId: docData.paypalOrderId,
    paymentPolicyVersion: docData.paymentPolicyVersion || '',
    paymentPolicyAccepted: Boolean(docData.paymentPolicyAccepted),
    paymentPolicyAcceptedAt: docData.paymentPolicyAcceptedAt,
    status: docData.status,
    statusHistory: docData.statusHistory || [],
    customerMessages: docData.customerMessages || [],
    finalPrice: docData.finalPrice,
    finalPaymentStatus: docData.finalPaymentStatus,
    createdAt: docData.createdAt,
    updatedAt: docData.updatedAt,
  };
}

export const createCustomDesignSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  productType: z.enum(['T-Shirt', 'Hoodie', 'Sweatshirt', 'Accessory', 'Other']),
  preferredSize: z.string().max(30).optional().default(''),
  preferredColor: z.string().max(50).optional().default(''),
  productPreference: z.string().max(100).optional().default(''),
  description: z.string().min(10, 'Description must be at least 10 characters').max(3000),
  additionalNotes: z.string().max(1000).optional().default(''),
  plan: z.enum(['regular', 'better_quality', 'basic', 'priority']),
  paymentPolicyAccepted: z.literal(true, {
    message: 'You must accept the non-refundable prepayment policy to proceed.',
  }),
  policyVersion: z.string().default(CURRENT_POLICY_VERSION),
  uploads: z.array(
    z.object({
      fileId: z.string().min(1),
      originalName: z.string().min(1),
      mimeType: z.string().min(1),
      size: z.number().positive(),
      storagePath: z.string().min(1),
      uploadedAt: z.string().optional(),
    })
  ).min(1, 'Please upload at least one design/artwork file').max(5, 'Maximum 5 files allowed'),
});

export const customerMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000),
});

export const adminStatusUpdateSchema = z.object({
  status: z.enum([
    'DRAFT',
    'PAYMENT_PENDING',
    'PAYMENT_PROCESSING',
    'PAYMENT_PAID',
    'PAYMENT_FAILED',
    'SUBMITTED',
    'UNDER_REVIEW',
    'NEEDS_INFORMATION',
    'DESIGN_IN_PROGRESS',
    'DESIGN_READY',
    'CUSTOMER_APPROVAL_REQUIRED',
    'APPROVED',
    'FINAL_PAYMENT_PENDING',
    'READY_FOR_PRODUCTION',
    'IN_PRODUCTION',
    'FULFILLED',
    'CANCELLED',
  ]),
  reason: z.string().max(500).optional(),
  adminNotes: z.string().max(2000).optional(),
  finalPrice: z.number().nonnegative().optional(),
});
