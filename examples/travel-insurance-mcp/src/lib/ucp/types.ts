export interface UcpBuyer {
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface UcpItem {
  id: string;
  title?: string;
  price?: number; // minor units
}

export interface UcpTotal {
  type: "subtotal" | "tax" | "fulfillment" | "discount" | "total" | string;
  amount: number; // minor units
  display_text?: string;
}

export interface UcpLineItem {
  id: string;
  item: UcpItem;
  quantity: number;
  totals: UcpTotal[];
}

export interface UcpMessage {
  type: "error" | "warning" | "info";
  code: string;
  content: string;
  severity?: "recoverable" | "requires_buyer_input" | "requires_buyer_review";
  path?: string;
}

export interface UcpLink {
  type: string;
  url: string;
  title?: string;
}

export interface UcpOrderConfirmation {
  id: string;
  permalink_url?: string;
}

export interface UcpCapabilityVersion {
  version: string;
}

export interface UcpPaymentHandlerRef {
  id: string;
  version: string;
  config?: Record<string, unknown>;
}

export interface UcpResponseEnvelope {
  version: string;
  capabilities: Record<string, UcpCapabilityVersion[]>;
  payment_handlers?: Record<string, UcpPaymentHandlerRef[]>;
}

export type UcpCheckoutStatus =
  | "incomplete"
  | "requires_escalation"
  | "ready_for_complete"
  | "complete_in_progress"
  | "completed"
  | "canceled";

export interface UcpCheckoutResponse {
  ucp: UcpResponseEnvelope;
  id: string;
  status: UcpCheckoutStatus;
  buyer: UcpBuyer;
  line_items: UcpLineItem[];
  currency: string;
  totals: UcpTotal[];
  messages: UcpMessage[];
  continue_url?: string;
  expires_at?: string;
  links?: UcpLink[];
  order?: UcpOrderConfirmation;
}
