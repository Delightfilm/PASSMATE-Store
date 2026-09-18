export type PaymentEventType =
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentAttemptStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type PreparePaymentInput = {
  orderId: string;
  amountKrw: number;
  merchantOrderId: string;
  idempotencyKey: string;
  customerEmail?: string;
};

export type PreparePaymentResult = {
  provider: string;
  merchantOrderId: string;
  clientPayload: Record<string, unknown>;
};

export type NormalizedPaymentEvent = {
  provider: string;
  providerEventId: string;
  type: PaymentEventType;
  merchantOrderId: string;
  providerPaymentId?: string;
  amountKrw?: number;
  payloadSha256: string;
  failureCode?: string;
  failureDetail?: string;
};

export type RefundPaymentInput = {
  providerPaymentId: string;
  amountKrw: number;
  reason: string;
};

export interface PaymentProviderAdapter {
  readonly name: string;

  prepare(input: PreparePaymentInput): Promise<PreparePaymentResult>;

  verifyAndNormalizeWebhook(
    rawBody: Uint8Array,
    headers: Headers
  ): Promise<NormalizedPaymentEvent>;

  refund(input: RefundPaymentInput): Promise<NormalizedPaymentEvent>;
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
