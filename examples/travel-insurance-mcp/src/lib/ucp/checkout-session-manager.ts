import { db } from "@/db";
import { checkoutSessions, products, orders, ucpIdempotencyKeys } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  UcpCheckoutResponse,
  UcpLineItem,
  UcpTotal,
  UcpMessage,
  UcpResponseEnvelope,
  UcpCheckoutStatus,
  UcpBuyer,
  UcpPayment,
  UcpPaymentInstrument,
  UcpServiceBinding,
} from "./types";

const UCP_VERSION = "2026-01-11";
const UCP_STRICT = process.env.UCP_STRICT === "true";
const ECP_ENABLED = process.env.ECP_ENABLED !== "false";

const PAYMENT_HANDLER_NAME = "com.demo.mock_payment";
const PAYMENT_HANDLER_ID = "mock_handler_1";
const PAYMENT_HANDLER_SPEC = "https://example.com/specs/mock-payment";
const PAYMENT_HANDLER_SCHEMA = "https://example.com/schemas/mock-payment.json";

const EMBEDDED_SERVICE_BINDING: UcpServiceBinding = {
  version: UCP_VERSION,
  transport: "embedded",
  schema: "https://ucp.dev/services/shopping/embedded.openrpc.json",
  spec: "https://ucp.dev/specification/embedded-checkout",
  config: {
    delegate: ["payment.instruments_change", "payment.credential"],
  },
};

const TAX_RATE = 0.08;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function generateCheckoutId(): string {
  return `checkout_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`;
}

interface CreateCheckoutInput {
  line_items: Array<{ item: { id: string }; quantity?: number }>;
  currency?: string;
  buyer?: UcpBuyer;
  payment?: UcpPayment;
}

async function resolveLineItems(
  lineItems: Array<{ item: { id: string }; quantity?: number }>
): Promise<{ resolved: UcpLineItem[]; errors: UcpMessage[] }> {
  const resolved: UcpLineItem[] = [];
  const errors: UcpMessage[] = [];

  for (const li of lineItems) {
    const productId = parseInt(li.item.id, 10);
    if (isNaN(productId)) {
      errors.push({
        type: "error",
        code: "invalid_item_id",
        content: `Item ID "${li.item.id}" is not a valid product ID.`,
        severity: "recoverable",
        path: `$.line_items`,
      });
      continue;
    }

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      errors.push({
        type: "error",
        code: "item_not_found",
        content: `Product with ID "${li.item.id}" was not found.`,
        severity: "recoverable",
        path: `$.line_items`,
      });
      continue;
    }

    if (!product.active) {
      errors.push({
        type: "error",
        code: "item_unavailable",
        content: `Product "${product.name}" is not currently available.`,
        severity: "recoverable",
        path: `$.line_items`,
      });
      continue;
    }

    const price = product.discountPrice ?? product.price;
    const qty = li.quantity ?? 1;
    const lineTotal = price * qty;

    resolved.push({
      id: `li_${product.id}`,
      item: {
        id: String(product.id),
        title: product.name,
        price,
      },
      quantity: qty,
      totals: [
        { type: "subtotal", amount: lineTotal },
        { type: "total", amount: lineTotal },
      ],
    });
  }

  return { resolved, errors };
}

function computeTotals(lineItems: UcpLineItem[]): UcpTotal[] {
  const subtotal = lineItems.reduce((sum, li) => {
    const liSubtotal =
      li.totals.find((t) => t.type === "subtotal")?.amount ?? 0;
    return sum + liSubtotal;
  }, 0);

  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  return [
    { type: "subtotal", amount: subtotal },
    { type: "tax", amount: tax },
    { type: "total", amount: total },
  ];
}

function evaluateStatus(
  buyer: UcpBuyer | undefined,
  lineItems: UcpLineItem[],
  itemErrors: UcpMessage[]
): { status: UcpCheckoutStatus; messages: UcpMessage[] } {
  const messages: UcpMessage[] = [...itemErrors];

  if (lineItems.length === 0 && itemErrors.length === 0) {
    messages.push({
      type: "error",
      code: "empty_cart",
      content: "At least one line item is required.",
      severity: "recoverable",
    });
  }

  if (!buyer?.email) {
    messages.push({
      type: "error",
      code: "missing_buyer_email",
      content: "Buyer email is required.",
      severity: "recoverable",
      path: "$.buyer.email",
    });
  }

  if (!buyer?.first_name) {
    messages.push({
      type: "error",
      code: "missing_buyer_first_name",
      content: "Buyer first name is required.",
      severity: "recoverable",
      path: "$.buyer.first_name",
    });
  }

  if (!buyer?.last_name) {
    messages.push({
      type: "error",
      code: "missing_buyer_last_name",
      content: "Buyer last name is required.",
      severity: "recoverable",
      path: "$.buyer.last_name",
    });
  }

  const hasEscalation = messages.some(
    (m) =>
      m.severity === "requires_buyer_input" ||
      m.severity === "requires_buyer_review"
  );
  const hasRecoverable = messages.some((m) => m.severity === "recoverable");

  let status: UcpCheckoutStatus;
  if (hasEscalation) {
    status = "requires_escalation";
  } else if (hasRecoverable || messages.some((m) => m.type === "error")) {
    status = "incomplete";
  } else {
    status = "ready_for_complete";
  }

  return { status, messages };
}

function buildUcpEnvelope(includeEmbedded: boolean): UcpResponseEnvelope {
  const envelope: UcpResponseEnvelope = {
    version: UCP_VERSION,
    capabilities: {
      "dev.ucp.shopping.checkout": [{ version: UCP_VERSION }],
    },
    payment_handlers: {
      [PAYMENT_HANDLER_NAME]: [
        {
          id: PAYMENT_HANDLER_ID,
          version: UCP_VERSION,
          spec: PAYMENT_HANDLER_SPEC,
          schema: PAYMENT_HANDLER_SCHEMA,
          config: {},
        },
      ],
    },
  };

  if (includeEmbedded && ECP_ENABLED) {
    envelope.services = {
      "dev.ucp.shopping": [EMBEDDED_SERVICE_BINDING],
    };
  }

  return envelope;
}

function ensureHttpsBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
  if (UCP_STRICT && !baseUrl.startsWith("https://")) {
    throw new Error(
      "UCP_STRICT requires NEXT_PUBLIC_BASE_URL to be an https:// URL"
    );
  }
  return baseUrl;
}

async function getIdempotentResponse(
  operation: "complete_checkout" | "cancel_checkout",
  checkoutId: string,
  idempotencyKey: string
): Promise<UcpCheckoutResponse | null> {
  const [record] = await db
    .select()
    .from(ucpIdempotencyKeys)
    .where(
      and(
        eq(ucpIdempotencyKeys.checkoutId, checkoutId),
        eq(ucpIdempotencyKeys.operation, operation),
        eq(ucpIdempotencyKeys.idempotencyKey, idempotencyKey)
      )
    );

  if (!record) return null;
  return record.responseData as unknown as UcpCheckoutResponse;
}

async function storeIdempotentResponse(
  operation: "complete_checkout" | "cancel_checkout",
  checkoutId: string,
  idempotencyKey: string,
  response: UcpCheckoutResponse
) {
  await db
    .insert(ucpIdempotencyKeys)
    .values({
      checkoutId,
      operation,
      idempotencyKey,
      responseData: response as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing();
}

function selectPaymentInstrument(payment?: UcpPayment): UcpPaymentInstrument | null {
  const instruments = payment?.instruments || [];
  const selected = instruments.find((i) => i.selected);
  return selected || null;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<UcpCheckoutResponse> {
  const id = generateCheckoutId();
  const currency = input.currency || "USD";
  const buyer = input.buyer || {};

  const { resolved: lineItems, errors: itemErrors } = await resolveLineItems(
    input.line_items || []
  );
  const totals = computeTotals(lineItems);
  const { status, messages } = evaluateStatus(buyer, lineItems, itemErrors);

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const baseUrl = ensureHttpsBaseUrl();

  const checkoutResponse: UcpCheckoutResponse = {
    ucp: buildUcpEnvelope(true),
    id,
    status,
    buyer,
    line_items: lineItems,
    currency,
    totals,
    messages,
    continue_url: `${baseUrl}/checkout/${id}`,
    expires_at: expiresAt.toISOString(),
    links: [
      { type: "terms_of_service", url: `${baseUrl}/terms` },
      { type: "privacy_policy", url: `${baseUrl}/privacy` },
    ],
    payment: input.payment,
  };

  await db.insert(checkoutSessions).values({
    id,
    status,
    currency,
    checkoutData: checkoutResponse as unknown as Record<string, unknown>,
    expiresAt,
  });

  return checkoutResponse;
}

export async function getCheckoutSession(
  id: string
): Promise<UcpCheckoutResponse | null> {
  const [session] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id));

  if (!session) return null;

  // Return stored checkout data with fresh UCP envelope
  const data = session.checkoutData as unknown as UcpCheckoutResponse;
  return { ...data, ucp: buildUcpEnvelope(true) };
}

export async function updateCheckoutSession(
  id: string,
  input: Partial<CreateCheckoutInput>
): Promise<UcpCheckoutResponse | null> {
  const [session] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id));

  if (!session) return null;

  const existing = session.checkoutData as unknown as UcpCheckoutResponse;

  // Reject updates on terminal statuses
  if (existing.status === "completed" || existing.status === "canceled") {
    return {
      ...existing,
      ucp: UCP_ENVELOPE,
      messages: [
        {
          type: "error",
          code: "checkout_immutable",
          content: `Checkout is ${existing.status} and cannot be updated.`,
          severity: "recoverable",
        },
      ],
    };
  }

  // Full replacement semantics: use input fields if provided, else keep existing
  const buyer: UcpBuyer = input.buyer || existing.buyer || {};
  const currency = input.currency || existing.currency;

  // Re-resolve line items if provided, otherwise keep existing
  let lineItems: UcpLineItem[];
  let itemErrors: UcpMessage[] = [];
  if (input.line_items && input.line_items.length > 0) {
    const result = await resolveLineItems(input.line_items);
    lineItems = result.resolved;
    itemErrors = result.errors;
  } else {
    lineItems = existing.line_items;
  }

  const totals = computeTotals(lineItems);
  const { status, messages } = evaluateStatus(buyer, lineItems, itemErrors);

  const baseUrl = ensureHttpsBaseUrl();

  const checkoutResponse: UcpCheckoutResponse = {
    ucp: buildUcpEnvelope(true),
    id,
    status,
    buyer,
    line_items: lineItems,
    currency,
    totals,
    messages,
    continue_url: `${baseUrl}/checkout/${id}`,
    expires_at: existing.expires_at,
    links: existing.links,
    payment: input.payment || existing.payment,
  };

  await db
    .update(checkoutSessions)
    .set({
      status,
      currency,
      checkoutData: checkoutResponse as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(checkoutSessions.id, id));

  return checkoutResponse;
}

export async function completeCheckoutSession(
  id: string,
  checkoutInput: Record<string, unknown>,
  idempotencyKey: string
): Promise<UcpCheckoutResponse | null> {
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(
      "complete_checkout",
      id,
      idempotencyKey
    );
    if (cached) return cached;
  }

  const [session] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id));

  if (!session) return null;

  const existing = session.checkoutData as unknown as UcpCheckoutResponse;
  const now = new Date();
  if (existing.expires_at && new Date(existing.expires_at) < now) {
    const expiredResponse: UcpCheckoutResponse = {
      ...existing,
      ucp: buildUcpEnvelope(true),
      status: "canceled",
      messages: [
        {
          type: "error",
          code: "checkout_expired",
          content: "Checkout session has expired.",
          severity: "recoverable",
        },
      ],
    };
    return expiredResponse;
  }

  if (existing.status !== "ready_for_complete") {
    return {
      ...existing,
      ucp: buildUcpEnvelope(true),
      messages: [
        {
          type: "error",
          code: "checkout_not_ready",
          content: `Checkout status is "${existing.status}" but must be "ready_for_complete" to complete.`,
          severity: "recoverable",
        },
      ],
    };
  }

  const payment = (checkoutInput?.payment as UcpPayment | undefined) || existing.payment;
  const selectedInstrument = selectPaymentInstrument(payment);
  if (UCP_STRICT) {
    if (!selectedInstrument) {
      return {
        ...existing,
        ucp: buildUcpEnvelope(true),
        messages: [
          {
            type: "error",
            code: "missing_payment_instrument",
            content: "A selected payment instrument is required to complete checkout.",
            severity: "recoverable",
            path: "$.payment.instruments",
          },
        ],
      };
    }
    if (selectedInstrument.handler_id !== PAYMENT_HANDLER_ID) {
      return {
        ...existing,
        ucp: buildUcpEnvelope(true),
        messages: [
          {
            type: "error",
            code: "invalid_payment_handler",
            content: "Selected payment instrument handler is not supported.",
            severity: "recoverable",
            path: "$.payment.instruments[0].handler_id",
          },
        ],
      };
    }
    if (!selectedInstrument.credential || !selectedInstrument.credential.type) {
      return {
        ...existing,
        ucp: buildUcpEnvelope(true),
        messages: [
          {
            type: "error",
            code: "missing_payment_credential",
            content: "Payment credential is required to complete checkout.",
            severity: "recoverable",
            path: "$.payment.instruments[0].credential",
          },
        ],
      };
    }
    if (selectedInstrument.credential.type === "card") {
      return {
        ...existing,
        ucp: buildUcpEnvelope(true),
        messages: [
          {
            type: "error",
            code: "raw_card_not_allowed",
            content: "Raw card credentials are not permitted for this checkout.",
            severity: "recoverable",
            path: "$.payment.instruments[0].credential.type",
          },
        ],
      };
    }
  }

  // Mock payment: create order synchronously
  const totalAmount =
    existing.totals.find((t) => t.type === "total")?.amount ?? 0;
  const firstLineItem = existing.line_items[0];
  const productId = firstLineItem
    ? parseInt(firstLineItem.item.id, 10)
    : undefined;

  let orderId: number | undefined;
  if (productId && !isNaN(productId)) {
    const [order] = await db
      .insert(orders)
      .values({
        productId,
        userId: existing.buyer?.email || "anonymous",
        duration: 30, // default duration for checkout orders
        travelers: 1,
        startDate: new Date(),
        totalPrice: totalAmount,
        status: "confirmed",
      })
      .returning();
    orderId = order.id;
  }

  const baseUrl = ensureHttpsBaseUrl();

  const checkoutResponse: UcpCheckoutResponse = {
    ...existing,
    ucp: buildUcpEnvelope(true),
    status: "completed",
    messages: [],
    continue_url: undefined,
    payment,
    order: orderId
      ? {
          id: String(orderId),
          permalink_url: `${baseUrl}/orders/${orderId}`,
        }
      : undefined,
  };

  await db
    .update(checkoutSessions)
    .set({
      status: "completed",
      orderId: orderId ?? null,
      checkoutData: checkoutResponse as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(checkoutSessions.id, id));

  if (idempotencyKey) {
    await storeIdempotentResponse(
      "complete_checkout",
      id,
      idempotencyKey,
      checkoutResponse
    );
  }

  return checkoutResponse;
}

export async function cancelCheckoutSession(
  id: string,
  idempotencyKey: string
): Promise<UcpCheckoutResponse | null> {
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(
      "cancel_checkout",
      id,
      idempotencyKey
    );
    if (cached) return cached;
  }

  const [session] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id));

  if (!session) return null;

  const existing = session.checkoutData as unknown as UcpCheckoutResponse;

  if (existing.status === "completed" || existing.status === "canceled") {
    return {
      ...existing,
      ucp: buildUcpEnvelope(true),
      messages: [
        {
          type: "error",
          code: "checkout_not_cancelable",
          content: `Checkout is already ${existing.status}.`,
          severity: "recoverable",
        },
      ],
    };
  }

  const checkoutResponse: UcpCheckoutResponse = {
    ...existing,
    ucp: buildUcpEnvelope(true),
    status: "canceled",
    messages: [],
    continue_url: undefined,
  };

  await db
    .update(checkoutSessions)
    .set({
      status: "canceled",
      checkoutData: checkoutResponse as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(checkoutSessions.id, id));

  if (idempotencyKey) {
    await storeIdempotentResponse(
      "cancel_checkout",
      id,
      idempotencyKey,
      checkoutResponse
    );
  }

  return checkoutResponse;
}
