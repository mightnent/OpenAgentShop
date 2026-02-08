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

  // Determine if using standard namespace
  const useStandardNamespace = ucpNamespace.startsWith("dev.ucp");
  const namespaceAuthority = "";
  const serviceName = useStandardNamespace ? "dev.ucp.shopping" : ucpNamespace;

  return `import { db } from "@/db";
import { products, orders, checkoutSessions, ucpIdempotencyKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateTotals } from "@/lib/currency";

const UCP_VERSION = ${JSON.stringify(ucpVersion)};
const CURRENCY = ${JSON.stringify(currency)};
const TAX_RATE = ${taxRate};
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SHOP_URL = ${JSON.stringify(shopUrl)};
const SPEC_AUTHORITY = ${JSON.stringify(useStandardNamespace ? "https://ucp.dev" : namespaceAuthority)};
const SERVICE_NAME = ${JSON.stringify(serviceName)};
const DEFAULT_DELEGATES = ["payment.instruments_change", "payment.credential"];

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

function buildUcpEnvelope(baseUrl: string, delegate: string[]) {
  const authority = SPEC_AUTHORITY || undefined;
  const services = {
    [SERVICE_NAME]: [
      {
        version: UCP_VERSION,
        transport: "mcp",
        endpoint: \`\${baseUrl}/api/mcp\`,
        spec: authority ? \`\${authority}/specification/checkout-mcp\` : undefined,
        schema: authority ? \`\${authority}/services/shopping/mcp.openrpc.json\` : undefined,
      },
      {
        version: UCP_VERSION,
        transport: "embedded",
        endpoint: \`\${baseUrl}/checkout\`,
        spec: authority ? \`\${authority}/specification/embedded-checkout\` : undefined,
        schema: authority ? \`\${authority}/services/shopping/embedded.openrpc.json\` : undefined,
        config: {
          delegate,
          continue_url_template: \`\${baseUrl}/checkout/{id}\`,
        },
      },
    ],
  };

  return {
    ucp: {
      version: UCP_VERSION,
      services,
      capabilities: ${JSON.stringify(capabilities, null, 4).replace(/\n/g, "\n      ")},
      payment_handlers: ${JSON.stringify(paymentHandlers, null, 4).replace(/\n/g, "\n      ")},
    },
  };
}

function makeResponse(data: Record<string, unknown>, baseUrl: string, delegate: string[] = DEFAULT_DELEGATES) {
  return { ...buildUcpEnvelope(baseUrl, delegate), ...data };
}

function evaluateStatus(
  buyer?: BuyerInput,
  lineItems?: ResolvedLineItem[],
  payment?: { instruments?: Array<{ credential?: unknown }> }
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
    messages.push({ type: "error", code: "missing_buyer_email", content: "Buyer email is required", severity: "requires_buyer_input", path: "$.buyer.email" });
  }
  if (!buyer?.first_name) {
    messages.push({ type: "error", code: "missing_buyer_first_name", content: "Buyer first name is required", severity: "requires_buyer_input", path: "$.buyer.first_name" });
  }
  if (!buyer?.last_name) {
    messages.push({ type: "error", code: "missing_buyer_last_name", content: "Buyer last name is required", severity: "requires_buyer_input", path: "$.buyer.last_name" });
  }

  const hasErrors = messages.some((m) => m.type === "error");
  const hasCredential =
    payment?.instruments?.some((instrument) => Boolean(instrument?.credential)) ?? false;

  if (hasErrors) {
    return { status: "incomplete", messages };
  }

  if (!hasCredential) {
    messages.push({
      type: "info",
      code: "payment_required",
      content: "Payment details are required to complete checkout.",
      severity: "requires_buyer_review",
    });
    return { status: "requires_escalation", messages };
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
      messages.push({ type: "error", code: "item_not_found", content: \`Product "\${itemId}" not found\`, severity: "recoverable" });
      continue;
    }
    if (!product.active) {
      messages.push({ type: "error", code: "item_unavailable", content: \`Product "\${product.name}" is not available\`, severity: "recoverable" });
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
    const sessionId = \`checkout_\${crypto.randomUUID()}\`;
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
      }, baseUrl);
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
      }, baseUrl);
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
      continue_url: \`\${baseUrl}/checkout/\${sessionId}\`,
    };

    await db.insert(checkoutSessions).values({
      id: sessionId,
      status,
      currency: CURRENCY,
      checkoutData,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return makeResponse(checkoutData, baseUrl);
  }

  async getCheckoutSession(id: string) {
    const baseUrl = this.getBaseUrl();
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" }, baseUrl);
    }
    return makeResponse(rows[0].checkoutData as Record<string, unknown>, baseUrl);
  }

  async updateCheckoutSession(id: string, input: { buyer?: BuyerInput; line_items?: LineItemInput[]; payment?: { instruments?: Array<{ credential?: unknown }> } }) {
    const baseUrl = this.getBaseUrl();
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" }, baseUrl);
    }

    const session = rows[0];
    if (TERMINAL_STATUSES.includes(session.status as CheckoutStatus)) {
      return makeResponse({
        ...(session.checkoutData as Record<string, unknown>),
        messages: [{ type: "error", code: "checkout_immutable", content: "Cannot update a completed or canceled checkout", severity: "recoverable" }],
      }, baseUrl);
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
      continue_url: \`\${baseUrl}/checkout/\${id}\`,
    };

    await db
      .update(checkoutSessions)
      .set({
        status,
        checkoutData: updatedData,
        updatedAt: new Date(),
      })
      .where(eq(checkoutSessions.id, id));

    return makeResponse(updatedData, baseUrl);
  }

  async completeCheckoutSession(id: string, checkoutInput: Record<string, unknown>, idempotencyKey?: string) {
    const baseUrl = this.getBaseUrl();
    const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
    if (rows.length === 0) {
      return makeResponse({ error: "Checkout session not found", status: "error" }, baseUrl);
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
          { type: "error", code: "checkout_not_ready", content: \`Checkout status is "\${session.status}", must be "ready_for_complete"\`, severity: "recoverable" },
        ],
      }, baseUrl);
    }

    // Create order
    if (lineItems.length === 0) {
      return makeResponse({
        ...mergedData,
        messages: [{ type: "error", code: "empty_cart", content: "Cannot complete checkout with no items", severity: "recoverable" }],
      }, baseUrl);
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
    }, baseUrl);

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
      return makeResponse({ error: "Checkout session not found", status: "error" }, baseUrl);
    }

    const session = rows[0];
    if (TERMINAL_STATUSES.includes(session.status as CheckoutStatus)) {
      return makeResponse({
        ...(session.checkoutData as Record<string, unknown>),
        messages: [{ type: "error", code: "checkout_not_cancelable", content: "Cannot cancel a completed or already canceled checkout", severity: "recoverable" }],
      }, baseUrl);
    }

    const updatedData = { ...(session.checkoutData as Record<string, unknown>), status: "canceled" };

    await db
      .update(checkoutSessions)
      .set({ status: "canceled", checkoutData: updatedData, updatedAt: new Date() })
      .where(eq(checkoutSessions.id, id));

    return makeResponse(updatedData, baseUrl);
  }
}
`;
}
