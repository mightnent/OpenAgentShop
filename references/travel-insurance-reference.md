# Travel Insurance MCP Reference Implementation

This reference shows battle-tested patterns from the travel-insurance-mcp project. Use these patterns when implementing or customizing OpenAgentShop-generated projects.

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── mcp/route.ts           # MCP Streamable HTTP endpoint
│   │   └── merchant/              # Merchant CRUD API
│   ├── .well-known/ucp/route.ts   # UCP profile discovery
│   ├── merchant/page.tsx          # Merchant center UI
│   ├── checkout/[id]/page.tsx     # Checkout page
│   └── orders/[id]/page.tsx       # Order confirmation
├── db/
│   ├── schema.ts                  # Drizzle schema
│   ├── seed.ts                    # Seed data
│   └── index.ts                   # DB connection
└── lib/
    ├── mcp-server.ts              # MCP tools
    ├── currency.ts                # Currency formatting
    └── ucp/
        ├── checkout-session-manager.ts  # UCP checkout logic
        └── types.ts               # UCP type definitions
```

## MCP Server Patterns

### Tool with MCP-UI Resource

```typescript
server.tool(
  "list_products",
  "List products with optional filters",
  {
    tier: z.string().optional(),
    keyword: z.string().optional(),
  },
  async ({ tier, keyword }) => {
    // 1. Query database
    let allProducts = await db.select().from(products);
    if (tier) {
      allProducts = allProducts.filter(p => p.tier?.toLowerCase() === tier.toLowerCase());
    }

    // 2. Build text response for LLM context
    const textSummary = allProducts.map((p, i) => 
      `${i + 1}. [ID: ${p.id}] ${p.name} - ${formatCurrencyDisplay(p.price, p.currency)}`
    ).join('\n');

    // 3. Generate HTML for MCP-UI
    const htmlContent = generateProductListHtml(allProducts);
    const resourceUri = `ui://shop/products/list-${Date.now()}`;

    // 4. Create MCP-UI resource
    const classicResource = createUIResource({
      uri: resourceUri,
      content: { type: "rawHtml", htmlString: htmlContent },
      encoding: "text",
    });

    return {
      content: [
        { type: "text", text: textSummary },
        classicResource,
      ],
      _meta: { ui: { resourceUri } },
    };
  }
);
```

### Purchase Button in MCP-UI HTML

```typescript
function generateProductDetailHtml(product: Product): string {
  return `
    <div class="product-card">
      <h2>${product.name}</h2>
      <p class="price">${formatCurrencyDisplay(product.price, product.currency)}</p>
      <button onclick="window.parent.postMessage({ 
        type: 'tool', 
        payload: { 
          toolName: 'create_checkout', 
          params: { 
            meta: { 'ucp-agent': { profile: '${process.env.NEXT_PUBLIC_BASE_URL}/profiles/agent.json' } }, 
            checkout: { line_items: [{ item: { id: '${product.id}' }, quantity: 1 }] } 
          } 
        } 
      }, '*')">Purchase</button>
    </div>
  `;
}
```

## UCP Checkout Session Manager

### Response Envelope

```typescript
const UCP_VERSION = "2026-01-11";

const UCP_ENVELOPE = {
  version: UCP_VERSION,
  capabilities: {
    "dev.ucp.shopping.checkout": [{ version: UCP_VERSION }],
  },
  payment_handlers: {
    "com.demo.mock_payment": [{
      id: "mock_handler_1",
      version: UCP_VERSION,
      config: {},
    }],
  },
};
```

### Line Item Resolution

```typescript
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
        path: "$.line_items",
      });
      continue;
    }

    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) {
      errors.push({
        type: "error",
        code: "item_not_found",
        content: `Product with ID "${li.item.id}" was not found.`,
        severity: "recoverable",
      });
      continue;
    }

    const price = product.discountPrice ?? product.price;
    const qty = li.quantity ?? 1;

    resolved.push({
      id: `li_${product.id}`,
      item: { id: String(product.id), title: product.name, price },
      quantity: qty,
      totals: [
        { type: "subtotal", amount: price * qty },
        { type: "total", amount: price * qty },
      ],
    });
  }

  return { resolved, errors };
}
```

### Status Evaluation

```typescript
function evaluateStatus(
  buyer: UcpBuyer | undefined,
  lineItems: UcpLineItem[],
  itemErrors: UcpMessage[]
): { status: UcpCheckoutStatus; messages: UcpMessage[] } {
  const messages: UcpMessage[] = [...itemErrors];

  // Validate required fields
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

  // Determine status
  const hasRecoverable = messages.some(m => m.severity === "recoverable");
  const status = hasRecoverable ? "incomplete" : "ready_for_complete";

  return { status, messages };
}
```

## Drizzle Schema Pattern

```typescript
import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortDescription: text("short_description"),
  description: text("description"),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  price: integer("price").notNull(), // minor units (cents)
  discountPrice: integer("discount_price"),
  active: boolean("active").default(true).notNull(),
  tier: varchar("tier", { length: 50 }),
  // Custom attributes as JSONB
  coverageHighlights: jsonb("coverage_highlights").$type<string[]>().default([]),
  regionsCovered: jsonb("regions_covered").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const checkoutSessions = pgTable("checkout_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: varchar("status", { length: 30 }).notNull().default("incomplete"),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  checkoutData: jsonb("checkout_data").$type<Record<string, unknown>>().notNull(),
  orderId: integer("order_id").references(() => orders.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

## Currency Utilities

```typescript
export function formatCurrencyDisplay(amountMinor: number, currency: string = "USD"): string {
  const amountMajor = amountMinor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMajor);
}
```

## Common Pitfalls & Guards

### Always guard against undefined arrays

```typescript
// Bad
if (checkout.messages.length > 0) { ... }

// Good
if (checkout.messages && checkout.messages.length > 0) { ... }
```

### Guard in resolveLineItems

```typescript
if (!items || !Array.isArray(items)) {
  return { resolved: [], messages: [] };
}
```

### Guard empty cart on complete

```typescript
const lineItems = (data.line_items as ResolvedLineItem[]) || [];
if (lineItems.length === 0) {
  return makeResponse({
    ...data,
    messages: [{ 
      type: "error", 
      code: "empty_cart", 
      message: "Cannot complete checkout with no items", 
      severity: "recoverable" 
    }],
  });
}
```
