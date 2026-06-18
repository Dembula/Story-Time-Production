/** Client-safe labels and types for admin payment transaction detail UI. */

export const PAYMENT_PURPOSE_LABELS: Record<string, string> = {
  viewer_subscription: "Viewer subscription (initial)",
  viewer_subscription_renewal: "Viewer subscription renewal",
  viewer_ppv: "Viewer pay-per-view title",
  SCRIPT_REVIEW: "Executive script review",
  CASTING_ACQUISITION_FEE: "Casting acquisition fee",
  AUDITION_LISTING: "Audition role listing",
  COMPANY_SUBSCRIPTION: "Company listing subscription",
  COMPANY_SUBSCRIPTION_RENEWAL: "Company subscription renewal",
  CREATOR_YEARLY_LICENSE: "Creator yearly licence",
  CREATOR_CONTENT_UPLOAD: "Creator catalogue upload",
  CREATOR_MUSIC_UPLOAD: "Creator music upload",
  creator_film_upload: "Creator per-film upload",
  creator_pipeline_yearly: "Creator pipeline (yearly)",
  creator_pipeline_monthly: "Creator pipeline (monthly)",
  creator_pipeline_monthly_renewal: "Creator pipeline monthly renewal",
  creator_pipeline_yearly_renewal: "Creator pipeline yearly renewal",
  creator_upload_only_yearly_renewal: "Creator upload-only yearly renewal",
  creator_upload_only_yearly: "Creator upload-only yearly",
  creator_distribution_yearly: "Creator distribution (yearly)",
  creator_distribution_per_upload: "Creator distribution per upload",
  music_track_publish: "Music track publish",
  EQUIPMENT_REQUEST: "Marketplace — equipment hire",
  LOCATION_BOOKING: "Marketplace — location booking",
  CATERING_BOOKING: "Marketplace — catering booking",
  CREW_REQUEST: "Marketplace — crew team request",
  CAST_INQUIRY: "Marketplace — casting inquiry",
};

export type RevenueRouteLine = {
  label: string;
  recipient: string;
  recipientRole?: string;
  accountType: string;
  amount: number;
  description: string;
};

export type AdminPaymentRecordDetail = {
  kind: "payment_record";
  id: string;
  status: string;
  purpose: string;
  purposeLabel: string;
  amount: number;
  settlementAmount: number | null;
  providerFeeAmount: number | null;
  providerPaymentMethod: string | null;
  providerPaymentMethodLabel: string | null;
  settlementSource: string | null;
  currency: string;
  provider: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  gatewayReference: string | null;
  providerPaymentId: string | null;
  providerItnStatus: string | null;
  payer: { id: string; name: string | null; email: string | null; role: string | null } | null;
  relatedEntity: { type: string | null; id: string | null; summary: string | null; extra?: Record<string, unknown> };
  revenueCategory: string;
  revenueRouting: RevenueRouteLine[];
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    subtotalAmount: number;
    platformFeeAmount: number;
    totalAmount: number;
    lines: { description: string; quantity: number; unitAmount: number; totalAmount: number }[];
  } | null;
  gatewayReferences: {
    id: string;
    externalRef: string;
    referenceType: string;
    referenceId: string;
    createdAt: string;
  }[];
  webhookEvents: {
    id: string;
    eventType: string;
    eventId: string | null;
    signatureVerified: boolean;
    processingError: string | null;
    processedAt: string | null;
    createdAt: string;
  }[];
  gatewayEvents: {
    id: string;
    eventType: string;
    eventId: string | null;
    signatureVerified: boolean;
    processed: boolean;
    createdAt: string;
  }[];
  ledgerBatch: {
    id: string;
    idempotencyKey: string;
    status: string;
    entries: {
      direction: string;
      accountType: string;
      transactionType: string;
      amount: number;
      description: string | null;
      userId: string;
      userLabel: string;
    }[];
  } | null;
  metadata: Record<string, unknown> | null;
  subscriptionPayment: {
    id: string;
    amount: number;
    status: string;
    purpose: string;
    paidAt: string | null;
  } | null;
};

export type AdminMarketplaceTransactionDetail = {
  kind: "marketplace_transaction";
  id: string;
  status: string;
  type: string;
  typeLabel: string;
  referenceId: string;
  amount: number;
  feeAmount: number;
  totalAmount: number;
  feeRateLabel: string;
  createdAt: string;
  gatewayReference: string | null;
  externalPaymentId: string | null;
  payer: { id: string; name: string | null; email: string | null; role: string | null };
  payee: { id: string; name: string | null; email: string | null; role: string | null };
  referenceEntity: { summary: string | null; extra?: Record<string, unknown> };
  revenueRouting: RevenueRouteLine[];
  paymentRecord: {
    id: string;
    status: string;
    purpose: string;
    amount: number;
    provider: string;
    paidAt: string | null;
  } | null;
  escrow: {
    id: string;
    status: string;
    amount: number;
    releaseTrigger: string | null;
    releasedAt: string | null;
  } | null;
};

export function paymentPurposeLabel(purpose: string): string {
  return PAYMENT_PURPOSE_LABELS[purpose] ?? purpose.replace(/_/g, " ");
}
