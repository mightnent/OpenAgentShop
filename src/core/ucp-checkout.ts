/**
 * UCP Checkout Session Manager Generator
 *
 * Generates a checkout session manager that implements the UCP
 * checkout capability (dev.ucp.shopping.checkout) for any shop.
 *
 * Checkout lifecycle:
 *   incomplete → ready_for_complete → completed
 *              ↘ requires_escalation
 *              ↘ canceled
 */

import type { ProductCatalog } from "../types/product-catalog";
import type { UcpConfig, PaymentHandlerConfig } from "../types/config";

/**
 * Derive UCP namespace from URL or use provided namespace
 * e.g., "https://myshop.com" -> "com.myshop"
 */
function deriveUcpNamespace(url: string, providedNamespace?: string): string {
  if (providedNamespace) return providedNamespace;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // Handle localhost/development
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "dev.localhost";
    }
    
    // Reverse the domain parts: myshop.com -> com.myshop
    const parts = hostname.replace(/^www\./, "").split(".");
    return parts.reverse().join(".");
  } catch {
    return "dev.localhost";
  }
}

/**
 * Generate the UCP checkout session manager source code.
 */
export function generateCheckoutManagerSource(
  catalog: ProductCatalog,
  ucpConfig?: UcpConfig
): string {
  const currency = catalog.shop.currency ?? "USD";
  const taxRate = catalog.shop.tax_rate ?? 0;
  const shopUrl = catalog.shop.url;
  const ucpNamespace = deriveUcpNamespace(shopUrl, catalog.shop.ucp_namespace);

  const ucpVersion = ucpConfig?.version ?? "2026-01-11";
  
  // Use namespace-based capability if not explicitly provided
  const defaultCapability = ucpNamespace.startsWith("dev.") 
    ? "dev.ucp.shopping.checkout" 
    : `${ucpNamespace}.checkout`;
  const capabilities: Record<string, Array<{ version: string }>> = {
    [defaultCapability]: [{ version: ucpVersion }],
  };

  // Use namespace-based payment handler if not explicitly provided
  const defaultPaymentHandler = ucpNamespace.startsWith("dev.")
    ? "com.demo.mock_payment"
    : `${ucpNamespace}.payment`;
  const paymentHandlers = ucpConfig?.paymentHandlers ?? {
    [defaultPaymentHandler]: [
      {
        id: `${ucpNamespace.replace(/\./g, "_")}_handler_1`,
        version: ucpVersion,
        config: {},
      },
    ],
  };

  // Add extension capabilities (use namespace-aware capability names)
  if (ucpConfig?.extensions) {
    const extPrefix = ucpNamespace.startsWith("dev.") ? "dev.ucp.shopping" : ucpNamespace;
    for (const ext of ucpConfig.extensions) {
      capabilities[`${extPrefix}.${ext}`] = [{ version: ucpVersion }];
    }
  }

  return `import { db } from "@/db";
import { products, orders, checkoutSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculateTotals, formatCurrencyDisplay } from "@/lib/currency";

const UCP_VERSION = ${JSON.stringify(ucpVersion)};
const CURRENCY = ${JSON.stringify(currency)};
const TAX_RATE = ${taxRate};
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SHOP_URL = ${JSON.stringify(shopUrl)};

const UCP_ENVELOPE = {
  ucp: {
    version: UCP_VERSION,
    capabilities: ${JSON.stringify(capabilities, null, 4).replace(/\n/g, "\n    ")},
    payment_handlers: ${JSON.stringify(paymentHandlers, null, 4).replace(/\n/g, "\n    ")},
  },
};

type CheckoutStatus = "incomplete" | "ready_for_complete" | "requires_escalation" | "completed" | "canceled";
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

function makeResponse(data: Record<string, unknown>) {
  return { ...UCP_ENVELOPE, ...data };
}

function evaluateStatus(buyer?: BuyerInput, lineItems?: ResolvedLineItem[]): { status: CheckoutStatus; messages: Array<{ type: string; code: string; message: string; severity: string; path?: string }> } {
  const messages: Array<{ type: string; code: string; message: string; severity: string; path?: string }> = [];

  if (!lineItems || lineItems.length === 0) {
    messages.push({ type: "error", code: "empty_cart", message: "Cart is empty", severity: "recoverable" });
    return { status: "incomplete", messages };
  }

  if (!buyer?.email) {
    messages.push({ type: "error", code: "missing_buyer_email", message: "Buyer email is required", severity: "requires_buyer_input", path: "$.buyer.email" });
  }
  if (!buyer?.first_name) {
    messages.push({ type: "error", code: "missing_buyer_first_name", message: "Buyer first name is required", severity: "requires_buyer_input", path: "$.buyer.first_name" });
  }
  if (!buyer?.last_name) {
    messages.push({ type: "error", code: "missing_buyer_last_name", message: "Buyer last name is required", severity: "requires_buyer_input", path: "$.buyer.last_name" });
  }

  const hasErrors = messages.some((m) => m.type === "error");
  return {
    status: hasErrors ? "incomplete" : "ready_for_complete",
    messages,
  };
}

async function resolveLineItems(items: LineItemInput[] | undefined): Promise<{ resolved: ResolvedLineItem[]; messages: Array<{ type: string; code: string; message: string; severity: string }> }> {
  const resolved: ResolvedLineItem[] = [];
  const messages: Array<{ type: string; code: string; message: string; severity: string }> = [];

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
      messages.push({ type: "error", code: "item_not_found", message: \`Product "\${itemId}" not found\`, severity: "recoverable" });
      continue;
    }
    if (!product.active) {
      messages.push({ type: "error", code: "item_unavailable", message: \`Product "\${product.name}" is not available\`, severity: "recoverable" });
      continue;
    }

    const unitPrice = product.discountPrice ?? product.price;
    const lineTotal = unitPrice * input.quantity;

    resolved.push({
      id: \`li_\${i + 1}\`,
      item: {
        id: String(product.id),
        title: product.name,
        price: unitPrice,
        description: product.shortDescription ?? undefined,
        url: \`\${SHOP_URL}/products/\${product.id}\`,
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

export class CheckoutSessionManager {
  async createCheckoutSession(input: { meta?: Record<string, unknown>; checkout: { buyer?: BuyerInput; line_items: LineItemInput[] } }) {
    const sessionId = \`checkout_\${crypto.randomUUID()}\`;
    const lineItemsInput = input.checkout?.line_items || [];
    
    // Guard against empty or invalid line_items
    if (!Array.isArray(lineItemsInput) || lineItemsInput.length === 0) {
      return makeResponse({
        id: sessionId,
        status: "incomplete",
        currency: CURRENCY,
        line_items: [],
        totals: [],
        messages: [{ type: "error", code: "empty_cart", message: "Cart is empty", severity: "recoverable" }],
      });
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
      });
    }

    const totals = computeTotals(resolved);
    const { status, messages: statusMessages } = evaluateStatus(input.checkout.buyer, resolved);
    const allMessages = [...itemMessages, ...statusMessages];

    const checkoutData = {
      id: sessionId,
      status,
      currency: CURRENCY,
      buyer: input.checkout.buyer || {},
      line_items: resolved,
      totals,
      messages: allMessages.length > 0 ? allMessages : undefined,
      continue_url: \`\${SHOP_URL}/checkout/\${sessionId}\`,
    };

    await db.insert(checkoutSessions).values({
      id: sessionId,
      status,
      currency: CURRENCY,
      checkoutData,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return makeResponse(checkoutData);
  }

  async getCheckoutSession(id: string) {
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" });
    }
    return makeResponse(rows[0].checkoutData as Record<string, unknown>);
  }

  async updateCheckoutSession(id: string, input: { buyer?: BuyerInput; line_items?: LineItemInput[] }) {
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" });
    }

    const session = rows[0];
    if (TERMINAL_STATUSES.includes(session.status as CheckoutStatus)) {
      return makeResponse({
        ...(session.checkoutData as Record<string, unknown>),
        messages: [{ type: "error", code: "checkout_immutable", message: "Cannot update a completed or canceled checkout", severity: "recoverable" }],
      });
    }

    const existingData = session.checkoutData as Record<string, unknown>;
    let resolvedItems = existingData.line_items as ResolvedLineItem[];
    const allMessages: Array<{ type: string; code: string; message: string; severity: string }> = [];

    if (input.line_items && Array.isArray(input.line_items) && input.line_items.length > 0) {
      const { resolved, messages } = await resolveLineItems(input.line_items);
      resolvedItems = resolved;
      allMessages.push(...messages);
    }

    const buyer = input.buyer
      ? { ...(existingData.buyer as Record<string, unknown> || {}), ...input.buyer }
      : existingData.buyer;

    const totals = computeTotals(resolvedItems);
    const { status, messages: statusMessages } = evaluateStatus(buyer as BuyerInput, resolvedItems);
    allMessages.push(...statusMessages);

    const updatedData = {
      ...existingData,
      buyer,
      line_items: resolvedItems,
      totals,
      status,
      messages: allMessages.length > 0 ? allMessages : undefined,
    };

    await db
      .update(checkoutSessions)
      .set({
        status,
        checkoutData: updatedData,
        updatedAt: new Date(),
      })
      .where(eq(checkoutSessions.id, id));

    return makeResponse(updatedData);
  }

  async completeCheckoutSession(id: string, _checkoutInput: Record<string, unknown>, _idempotencyKey?: string) {
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" });
    }

    const session = rows[0];
    const data = session.checkoutData as Record<string, unknown>;

    if (session.status !== "ready_for_complete") {
      return makeResponse({
        ...data,
        messages: [{ type: "error", code: "checkout_not_ready", message: \`Checkout status is "\${session.status}", must be "ready_for_complete"\`, severity: "recoverable" }],
      });
    }

    // Create order
    const lineItems = (data.line_items as ResolvedLineItem[]) || [];
    const totals = (data.totals as Array<{ type: string; amount: number }>) || [];
    const totalAmount = totals.find((t) => t.type === "total")?.amount ?? 0;
    const buyer = data.buyer as BuyerInput;

    if (lineItems.length === 0) {
      return makeResponse({
        ...data,
        messages: [{ type: "error", code: "empty_cart", message: "Cannot complete checkout with no items", severity: "recoverable" }],
      });
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
        checkoutData: { ...data, status: "completed", order: { id: String(order.id) } },
        updatedAt: new Date(),
      })
      .where(eq(checkoutSessions.id, id));

    return makeResponse({
      ...data,
      status: "completed",
      order: {
        id: String(order.id),
        status: "confirmed",
        total: totalAmount,
        currency: session.currency,
      },
    });
  }

  async cancelCheckoutSession(id: string, _idempotencyKey?: string) {
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" });
    }

    const session = rows[0];
    if (TERMINAL_STATUSES.includes(session.status as CheckoutStatus)) {
      return makeResponse({
        ...(session.checkoutData as Record<string, unknown>),
        messages: [{ type: "error", code: "checkout_not_cancelable", message: "Cannot cancel a completed or already canceled checkout", severity: "recoverable" }],
      });
    }

    const updatedData = { ...(session.checkoutData as Record<string, unknown>), status: "canceled" };

    await db
      .update(checkoutSessions)
      .set({ status: "canceled", checkoutData: updatedData, updatedAt: new Date() })
      .where(eq(checkoutSessions.id, id));

    return makeResponse(updatedData);
  }
}
`;
}
