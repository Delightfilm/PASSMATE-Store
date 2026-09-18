import contract from "@/config/order-state.json";

export type OrderStatus =
  | "pending"
  | "payment_pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type FulfillmentStatus =
  | "not_started"
  | "queued"
  | "issuing"
  | "ready"
  | "failed"
  | "revoked";

export const ORDER_INITIAL = contract.order.initial as OrderStatus;
export const FULFILLMENT_INITIAL =
  contract.fulfillment.initial as FulfillmentStatus;

export const ORDER_TRANSITIONS =
  contract.order.transitions as Record<OrderStatus, OrderStatus[]>;

export const FULFILLMENT_TRANSITIONS =
  contract.fulfillment.transitions as Record<
    FulfillmentStatus,
    FulfillmentStatus[]
  >;

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return from === to || ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionFulfillment(
  from: FulfillmentStatus,
  to: FulfillmentStatus
): boolean {
  return from === to || FULFILLMENT_TRANSITIONS[from].includes(to);
}

export function isOrderFulfillmentCombinationValid(
  orderStatus: OrderStatus,
  fulfillmentStatus: FulfillmentStatus
): boolean {
  if (orderStatus === "refunded") {
    return fulfillmentStatus === "revoked";
  }

  if (orderStatus === "paid") {
    return fulfillmentStatus !== "revoked";
  }

  return fulfillmentStatus === "not_started";
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "주문 생성",
  payment_pending: "결제 진행 중",
  paid: "결제 완료",
  failed: "결제 실패",
  cancelled: "주문 취소",
  refunded: "환불 완료",
};

export const FULFILLMENT_STATUS_LABELS: Record<
  FulfillmentStatus,
  string
> = {
  not_started: "발행 전",
  queued: "발행 대기",
  issuing: "발행 중",
  ready: "자료 준비 완료",
  failed: "발행 실패",
  revoked: "접근 종료",
};
