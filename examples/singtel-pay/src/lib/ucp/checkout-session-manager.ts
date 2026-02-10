import { db } from "@/db";
import { products, orders, checkoutSessions, ucpIdempotencyKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateTotals } from "@/lib/currency";

const UCP_VERSION = "2026-01-11";
const CURRENCY = "SGD";
const TAX_RATE = 0;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SHOP_URL = "http://localhost:3003";
const SPEC_AUTHORITY = "https://ucp.dev";
const SERVICE_NAME = "dev.ucp.shopping";
const DEFAULT_DELEGATES = ["payment.instruments_change", "payment.credential"];
const ECP_ENABLED = process.env.ECP_ENABLED !== "false";

type CheckoutStatus =
  | "incomplete"
  | "ready_for_complete"
  | "requires_escalation"
  | "complete_in_progress"
  | "completed"
  | "canceled";
const TERMINAL_STATUSES: CheckoutStatus[] = ["completed", "canceled"];

interface LineItemInput {
  item: { id: string };
  quantity: number;
}

interface BuyerInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface ResolvedLineItem {
  id: string;
  item: {
    id: string;
    title: string;
    price: number;
    image_url?: string;
    description?: string;
    url?: string;
  };
  quantity: number;
  totals: Array<{ type: string; amount: number }>;
}

function buildUcpEnvelope(includeEmbedded: boolean = false) {
  const envelope: any = {
    version: UCP_VERSION,
    capabilities: {
      "dev.ucp.shopping.checkout": [{ version: UCP_VERSION }],
    },
    payment_handlers: {
      "com.demo.mock_payment": [
        {
          id: "mock_handler_1",
          version: UCP_VERSION,
          spec: "https://example.com/specs/mock-payment",
          schema: "https://example.com/schemas/mock-payment.json",
          config: {},
        },
      ],
    },
  };

  if (includeEmbedded && ECP_ENABLED) {
    envelope.services = {
      [SERVICE_NAME]: [
        {
          version: UCP_VERSION,
          transport: "embedded",
          schema: `${SPEC_AUTHORITY}/services/shopping/embedded.openrpc.json`,
          spec: `${SPEC_AUTHORITY}/specification/embedded-checkout`,
          config: {
            delegate: DEFAULT_DELEGATES,
          },
        },
      ],
    };
  }

  return envelope;
}

function makeResponse(data: Record<string, unknown>, includeEmbedded: boolean = false) {
  return { ucp: buildUcpEnvelope(includeEmbedded), ...data };
}

function evaluateStatus(
  buyer?: BuyerInput,
  lineItems?: ResolvedLineItem[],
  _payment?: { instruments?: Array<{ credential?: unknown }> }
): {
  status: CheckoutStatus;
  messages: Array<{ type: string; code: string; content: string; severity: string; path?: string }>;
} {
  const messages: Array<{ type: string; code: string; content: string; severity: string; path?: string }> = [];

  if (!lineItems || lineItems.length === 0) {
    messages.push({ type: "error", code: "empty_cart", content: "Cart is empty", severity: "recoverable" });
    return { status: "incomplete", messages };
  }

  if (!buyer?.email) {
    messages.push({ type: "error", code: "missing_buyer_email", content: "Buyer email is required", severity: "recoverable", path: "$.buyer.email" });
  }
  if (!buyer?.first_name) {
    messages.push({ type: "error", code: "missing_buyer_first_name", content: "Buyer first name is required", severity: "recoverable", path: "$.buyer.first_name" });
  }
  if (!buyer?.last_name) {
    messages.push({ type: "error", code: "missing_buyer_last_name", content: "Buyer last name is required", severity: "recoverable", path: "$.buyer.last_name" });
  }

  const hasErrors = messages.some((m) => m.type === "error");

  if (hasErrors) {
    return { status: "incomplete", messages };
  }

  return { status: "ready_for_complete", messages };
}

async function resolveLineItems(items: LineItemInput[] | undefined): Promise<{ resolved: ResolvedLineItem[]; messages: Array<{ type: string; code: string; content: string; severity: string }> }> {
  const resolved: ResolvedLineItem[] = [];
  const messages: Array<{ type: string; code: string; content: string; severity: string }> = [];

  if (!items || !Array.isArray(items)) {
    return { resolved, messages };
  }

  for (let i = 0; i < items.length; i++) {
    const input = items[i];
    const itemId = input.item.id;

    // Try parsing as numeric ID or look up by catalogId
    let product;
    const numId = parseInt(itemId, 10);
    if (!isNaN(numId)) {
      const rows = await db.select().from(products).where(eq(products.id, numId)).limit(1);
      product = rows[0];
    }
    if (!product) {
      const rows = await db.select().from(products).where(eq(products.catalogId, itemId)).limit(1);
      product = rows[0];
    }

    if (!product) {
      messages.push({ type: "error", code: "item_not_found", content: `Product "${itemId}" not found`, severity: "recoverable" });
      continue;
    }
    if (!product.active) {
      messages.push({ type: "error", code: "item_unavailable", content: `Product "${product.name}" is not available`, severity: "recoverable" });
      continue;
    }

    const unitPrice = product.discountPrice ?? product.price;
    const lineTotal = unitPrice * input.quantity;

    resolved.push({
      id: `li_${i + 1}`,
      item: {
        id: String(product.id),
        title: product.name,
        price: unitPrice,
        description: product.shortDescription ?? undefined,
        url: `${SHOP_URL}/products/${product.id}`,
      },
      quantity: input.quantity,
      totals: [
        { type: "subtotal", amount: lineTotal },
        { type: "total", amount: lineTotal },
      ],
    });
  }

  return { resolved, messages };
}

function computeTotals(lineItems: ResolvedLineItem[] | undefined) {
  if (!lineItems || !Array.isArray(lineItems)) {
    return [{ type: "subtotal", amount: 0 }, { type: "total", amount: 0 }];
  }
  const subtotal = lineItems.reduce((sum, li) => {
    const liSubtotal = li.totals.find((t) => t.type === "subtotal");
    return sum + (liSubtotal?.amount ?? 0);
  }, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  const totals = [
    { type: "subtotal", amount: subtotal },
  ];
  if (TAX_RATE > 0) {
    totals.push({ type: "tax", amount: tax });
  }
  totals.push({ type: "total", amount: total });

  return totals;
}

function resolveBaseUrl(preferred?: string) {
  let baseUrl = preferred || process.env.NEXT_PUBLIC_BASE_URL || SHOP_URL;
  const strict = process.env.UCP_STRICT === "true";
  if (strict && baseUrl.startsWith("http://") && !baseUrl.includes("localhost")) {
    baseUrl = baseUrl.replace("http://", "https://");
  }
  return baseUrl;
}

export class CheckoutSessionManager {
  private baseUrl?: string;

  constructor({ baseUrl }: { baseUrl?: string } = {}) {
    this.baseUrl = baseUrl;
  }

  private getBaseUrl() {
    return resolveBaseUrl(this.baseUrl);
  }

  async createCheckoutSession(input: { meta?: Record<string, unknown>; checkout: { buyer?: BuyerInput; line_items: LineItemInput[]; payment?: { instruments?: Array<{ credential?: unknown }> } } }) {
    const sessionId = `checkout_${crypto.randomUUID()}`;
    const lineItemsInput = input.checkout?.line_items || [];
    const baseUrl = this.getBaseUrl();
    
    // Guard against empty or invalid line_items
    if (!Array.isArray(lineItemsInput) || lineItemsInput.length === 0) {
      return makeResponse({
        id: sessionId,
        status: "incomplete",
        currency: CURRENCY,
        line_items: [],
        totals: [],
        messages: [{ type: "error", code: "empty_cart", content: "Cart is empty", severity: "recoverable" }],
      }, true);
    }

    const { resolved, messages: itemMessages } = await resolveLineItems(lineItemsInput);

    if (itemMessages.some((m) => m.type === "error")) {
      return makeResponse({
        id: sessionId,
        status: "incomplete",
        currency: CURRENCY,
        line_items: [],
        totals: [],
        messages: itemMessages,
      }, true);
    }

    const totals = computeTotals(resolved);
    const { status, messages: statusMessages } = evaluateStatus(
      input.checkout.buyer,
      resolved,
      input.checkout.payment
    );
    const allMessages = [...itemMessages, ...statusMessages];

    const checkoutData = {
      id: sessionId,
      status,
      currency: CURRENCY,
      buyer: input.checkout.buyer || {},
      line_items: resolved,
      totals,
      messages: allMessages.length > 0 ? allMessages : undefined,
      payment: input.checkout.payment,
      continue_url: `${baseUrl}/checkout/${sessionId}`,
    };

    await db.insert(checkoutSessions).values({
      id: sessionId,
      status,
      currency: CURRENCY,
      checkoutData,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return makeResponse(checkoutData, true);
  }

  async getCheckoutSession(id: string) {
    const baseUrl = this.getBaseUrl();
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" }, true);
    }
    return makeResponse(rows[0].checkoutData as Record<string, unknown>, true);
  }

  async updateCheckoutSession(id: string, input: { buyer?: BuyerInput; line_items?: LineItemInput[]; payment?: { instruments?: Array<{ credential?: unknown }> } }) {
    const baseUrl = this.getBaseUrl();
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" }, true);
    }

    const session = rows[0];
    if (TERMINAL_STATUSES.includes(session.status as CheckoutStatus)) {
      return makeResponse({
        ...(session.checkoutData as Record<string, unknown>),
        messages: [{ type: "error", code: "checkout_immutable", content: "Cannot update a completed or canceled checkout", severity: "recoverable" }],
      }, true);
    }

    const existingData = session.checkoutData as Record<string, unknown>;
    let resolvedItems = existingData.line_items as ResolvedLineItem[];
    const allMessages: Array<{ type: string; code: string; content: string; severity: string }> = [];

    if (input.line_items && Array.isArray(input.line_items) && input.line_items.length > 0) {
      const { resolved, messages } = await resolveLineItems(input.line_items);
      resolvedItems = resolved;
      allMessages.push(...messages);
    }

    const buyer = input.buyer
      ? { ...(existingData.buyer as Record<string, unknown> || {}), ...input.buyer }
      : existingData.buyer;

    const totals = computeTotals(resolvedItems);
    const payment = input.payment ?? (existingData.payment as { instruments?: Array<{ credential?: unknown }> } | undefined);
    const { status, messages: statusMessages } = evaluateStatus(buyer as BuyerInput, resolvedItems, payment);
    allMessages.push(...statusMessages);

    const updatedData = {
      ...existingData,
      buyer,
      line_items: resolvedItems,
      totals,
      status,
      messages: allMessages.length > 0 ? allMessages : undefined,
      payment,
      continue_url: `${baseUrl}/checkout/${id}`,
    };

    await db
      .update(checkoutSessions)
      .set({
        status,
        checkoutData: updatedData,
        updatedAt: new Date(),
      })
      .where(eq(checkoutSessions.id, id));

    return makeResponse(updatedData, true);
  }

  async completeCheckoutSession(id: string, checkoutInput: Record<string, unknown>, idempotencyKey?: string) {
    const baseUrl = this.getBaseUrl();
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" }, true);
    }

    const session = rows[0];
    const data = session.checkoutData as Record<string, unknown>;

    if (idempotencyKey) {
      const prior = await db
        .select()
        .from(ucpIdempotencyKeys)
        .where(and(eq(ucpIdempotencyKeys.key, idempotencyKey), eq(ucpIdempotencyKeys.scope, "complete_checkout"), eq(ucpIdempotencyKeys.checkoutId, id)))
        .limit(1);
      if (prior.length > 0) {
        return prior[0].response as Record<string, unknown>;
      }
    }

    const mergedData = {
      ...data,
      ...(checkoutInput || {}),
    };

    const paymentInput = (checkoutInput as any)?.payment;
    const lineItems = (mergedData.line_items as ResolvedLineItem[]) || [];
    const totals = (mergedData.totals as Array<{ type: string; amount: number }>) || [];
    const totalAmount = totals.find((t) => t.type === "total")?.amount ?? 0;
    const buyer = mergedData.buyer as BuyerInput;

    const { status, messages: statusMessages } = evaluateStatus(
      buyer,
      lineItems,
      paymentInput ?? (mergedData.payment as { instruments?: Array<{ credential?: unknown }> } | undefined)
    );

    if (status !== "ready_for_complete") {
      return makeResponse({
        ...mergedData,
        status,
        messages: [
          ...statusMessages,
          { type: "error", code: "checkout_not_ready", content: `Checkout status is "${session.status}", must be "ready_for_complete"`, severity: "recoverable" },
        ],
      }, true);
    }

    // Create order
    if (lineItems.length === 0) {
      return makeResponse({
        ...mergedData,
        messages: [{ type: "error", code: "empty_cart", content: "Cannot complete checkout with no items", severity: "recoverable" }],
      }, true);
    }

    const [order] = await db
      .insert(orders)
      .values({
        productId: parseInt(lineItems[0]?.item.id ?? "0", 10),
        userId: buyer?.email ?? "unknown",
        quantity: lineItems.reduce((sum, li) => sum + li.quantity, 0),
        totalPrice: totalAmount,
        status: "confirmed",
      })
      .returning();

    await db
      .update(checkoutSessions)
      .set({
        status: "completed",
        orderId: order.id,
        checkoutData: { ...mergedData, status: "completed", order: { id: String(order.id) } },
        updatedAt: new Date(),
      })
      .where(eq(checkoutSessions.id, id));

    const response = makeResponse({
      ...mergedData,
      status: "completed",
      order: {
        id: String(order.id),
        status: "confirmed",
        total: totalAmount,
        currency: session.currency,
      },
    }, true);

    if (idempotencyKey) {
      await db.insert(ucpIdempotencyKeys).values({
        key: idempotencyKey,
        scope: "complete_checkout",
        checkoutId: id,
        response,
      });
    }

    return response;
  }

  async cancelCheckoutSession(id: string, _idempotencyKey?: string) {
    const baseUrl = this.getBaseUrl();
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" }, true);
    }

    const session = rows[0];
    if (TERMINAL_STATUSES.includes(session.status as CheckoutStatus)) {
      return makeResponse({
        ...(session.checkoutData as Record<string, unknown>),
        messages: [{ type: "error", code: "checkout_not_cancelable", content: "Cannot cancel a completed or already canceled checkout", severity: "recoverable" }],
      }, true);
    }

    const updatedData = { ...(session.checkoutData as Record<string, unknown>), status: "canceled" };

    await db
      .update(checkoutSessions)
      .set({ status: "canceled", checkoutData: updatedData, updatedAt: new Date() })
      .where(eq(checkoutSessions.id, id));

    return makeResponse(updatedData, true);
  }
}
