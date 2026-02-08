/**
 * UCP (Universal Commerce Protocol) Types
 *
 * Based on UCP specification version 2026-01-11.
 * These types define the checkout session data structures.
 */

// ---------------------------------------------------------------------------
// Checkout Status
// ---------------------------------------------------------------------------

export type CheckoutStatus =
  | "incomplete"
  | "ready_for_complete"
  | "requires_escalation"
  | "complete_in_progress"
  | "completed"
  | "canceled";

export const TERMINAL_STATUSES: CheckoutStatus[] = ["completed", "canceled"];

// ---------------------------------------------------------------------------
// Line Items
// ---------------------------------------------------------------------------

export interface UcpLineItemProduct {
  /** Product ID (from catalog) */
  id: string;
  /** Product title */
  title?: string;
  /** Unit price in minor units */
  price?: number;
  /** Product image URL */
  image_url?: string;
  /** Product description */
  description?: string;
  /** Product page URL */
  url?: string;
}

export interface UcpTotal {
  type: "subtotal" | "tax" | "shipping" | "discount" | "total";
  amount: number;
}

export interface UcpLineItem {
  /** Line item ID (e.g., "li_1") */
  id: string;
  /** Product information */
  item: UcpLineItemProduct;
  /** Quantity */
  quantity: number;
  /** Line item totals */
  totals?: UcpTotal[];
}

// ---------------------------------------------------------------------------
// Buyer
// ---------------------------------------------------------------------------

export interface UcpPostalAddress {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
}

export interface UcpBuyer {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  billing_address?: UcpPostalAddress;
  shipping_address?: UcpPostalAddress;
  consent?: {
    analytics?: boolean;
    preferences?: boolean;
    marketing?: boolean;
    sale_of_data?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export interface UcpPaymentInstrument {
  id: string;
  handler_id: string;
  type: string;
  selected?: boolean;
  display?: {
    brand?: string;
    last_digits?: string;
    email?: string;
  };
  billing_address?: UcpPostalAddress;
  credential?: {
    type: string;
    token: string;
  };
}

export interface UcpPayment {
  instruments?: UcpPaymentInstrument[];
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type MessageType = "error" | "warning" | "info";
export type MessageSeverity =
  | "recoverable"
  | "requires_buyer_input"
  | "requires_buyer_review";

export interface UcpMessage {
  type: MessageType;
  code: string;
  content: string;
  content_type?: string;
  severity?: MessageSeverity;
  path?: string;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export interface UcpLink {
  type: string;
  url: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Checkout Session
// ---------------------------------------------------------------------------

export interface UcpCheckoutData {
  id: string;
  status: CheckoutStatus;
  currency: string;
  line_items: UcpLineItem[];
  buyer?: UcpBuyer;
  totals: UcpTotal[];
  payment?: UcpPayment;
  messages?: UcpMessage[];
  links?: UcpLink[];
  continue_url?: string;
  order?: {
    id: string;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// UCP Envelope (wraps all responses)
// ---------------------------------------------------------------------------

/**
 * UCP Capability Declaration
 * 
 * The `spec` and `schema` fields are REQUIRED for all capabilities.
 * The origin of these URLs MUST match the namespace authority:
 * - `dev.ucp.*` namespace → `https://ucp.dev/...`
 * - `com.example.*` namespace → `https://example.com/...`
 */
export interface UcpCapabilityDeclaration {
  version: string;
  /** 
   * URL to the human-readable specification document.
   * REQUIRED. Must match namespace authority.
   */
  spec: string;
  /** 
   * URL to the JSON schema for validation.
   * REQUIRED. Must match namespace authority.
   */
  schema: string;
}

export interface UcpPaymentHandlerDeclaration {
  id: string;
  version: string;
  spec?: string;
  schema?: string;
  config: Record<string, unknown>;
}

export interface UcpServiceBinding {
  version: string;
  transport: "rest" | "mcp" | "a2a" | "embedded";
  endpoint?: string;
  spec?: string;
  schema?: string;
  config?: Record<string, unknown>;
}

export interface UcpEnvelope {
  ucp: {
    version: string;
    services?: Record<string, UcpServiceBinding[]>;
    capabilities: Record<string, UcpCapabilityDeclaration[]>;
    payment_handlers?: Record<string, UcpPaymentHandlerDeclaration[]>;
  };
}

export type UcpCheckoutResponse = UcpEnvelope & UcpCheckoutData;

// ---------------------------------------------------------------------------
// MCP Meta (for MCP transport)
// ---------------------------------------------------------------------------

export interface UcpMcpMeta {
  "ucp-agent"?: {
    profile?: string;
  };
  "idempotency-key"?: string;
}

// ---------------------------------------------------------------------------
// Checkout Input (what the platform sends)
// ---------------------------------------------------------------------------

export interface CreateCheckoutInput {
  meta?: UcpMcpMeta;
  checkout: {
    buyer?: UcpBuyer;
    line_items: Array<{
      item: { id: string };
      quantity: number;
    }>;
  };
}

export interface UpdateCheckoutInput {
  meta?: UcpMcpMeta;
  id: string;
  checkout: {
    buyer?: UcpBuyer;
    line_items?: Array<{
      item: { id: string };
      quantity: number;
    }>;
  };
}

export interface CompleteCheckoutInput {
  meta?: UcpMcpMeta;
  id: string;
  checkout?: {
    payment?: UcpPayment;
    risk_signals?: Record<string, unknown>;
  };
  idempotency_key?: string;
}

// ---------------------------------------------------------------------------
// UCP Profile (/.well-known/ucp)
// ---------------------------------------------------------------------------

export interface UcpProfile {
  ucp: {
    version: string;
    services: Record<string, UcpServiceBinding[]>;
    capabilities: Record<string, UcpCapabilityDeclaration[]>;
    payment_handlers?: Record<string, UcpPaymentHandlerDeclaration[]>;
  };
  signing_keys?: Array<{ kid: string; kty: string; [key: string]: unknown }>;
}
