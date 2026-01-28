# Configuration

This document covers all configuration options available in OpenAgentShop.

## Configuration Methods

### 1. Product Catalog JSON (Primary)

The catalog JSON is the primary input. Shop-level settings like name, URL, currency, tax rate, and branding are configured here. See [Product Catalog Spec](./product-catalog-spec.md).

### 2. SDK Config (Programmatic)

When using the SDK programmatically, pass configuration options as the third argument to `generateProject()`:

```typescript
import { generateProject } from "open-agent-shop";

generateProject(catalog, "./output", {
  database: { provider: "postgres" },
  mcp: { uiMode: "both" },
  ucp: { extensions: ["fulfillment"] },
  feed: { enabled: true },
  ui: { merchantCenter: true }
});
```

### 3. CLI Flags

```bash
open-agent-shop init --catalog catalog.json --output ./shop --provider neon
```

### 4. Environment Variables (Runtime)

Set in `.env` for the generated project:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXT_PUBLIC_BASE_URL=https://myshop.com
```

## Database Configuration

```typescript
{
  database: {
    provider: "neon" | "postgres" | "supabase",
    connectionString: "postgresql://..."  // Optional, falls back to DATABASE_URL
  }
}
```

| Provider | NPM Package | Use Case |
|----------|-------------|----------|
| `neon` | `@neondatabase/serverless` | Serverless deployments, Vercel |
| `postgres` | `postgres` (postgres.js) | Self-hosted, standard PostgreSQL |
| `supabase` | `@neondatabase/serverless` | Supabase projects |

## MCP Configuration

```typescript
{
  mcp: {
    serverName: "My Store",        // MCP server name (default: shop name)
    serverVersion: "1.0.0",        // Server version
    uiMode: "both",                // "classic" | "resource" | "both"
    customTools: []                 // Additional MCP tools
  }
}
```

### UI Mode

| Mode | Description | When to Use |
|------|-------------|-------------|
| `classic` | HTML in tool response only | Simple hosts, maximum compatibility |
| `resource` | HTML via resources/read only | MCP Apps-compliant hosts |
| `both` | Both modes simultaneously | Default, recommended |

### Custom Tools

Add additional MCP tools beyond the auto-generated ones:

```typescript
{
  mcp: {
    customTools: [
      {
        name: "check_warranty",
        description: "Check product warranty status",
        inputSchema: { orderId: { type: "string" } },
        handler: async (args) => {
          // Custom logic
          return { status: "active", expiresAt: "2027-01-01" };
        }
      }
    ]
  }
}
```

## UCP Configuration

```typescript
{
  ucp: {
    version: "2026-01-11",
    capabilities: ["dev.ucp.shopping.checkout"],
    extensions: ["fulfillment", "discount", "ap2_mandate", "buyer_consent"],
    paymentHandlers: {
      "com.google.pay": [{ id: "gpay_1", version: "2026-01-11", config: { ... } }]
    }
  }
}
```

See [UCP Integration](./ucp-integration.md) for detailed payment handler setup.

## Feed Configuration

```typescript
{
  feed: {
    enabled: true,                   // Enable /api/feed endpoint
    merchantName: "My Store",        // Merchant name in feed
    defaultBrand: "MyBrand",         // Default product brand
    enableCheckout: false,           // is_eligible_checkout flag
    productCategory: "Electronics"   // Default product category
  }
}
```

## UI Configuration

```typescript
{
  ui: {
    merchantCenter: true,     // Enable /merchant page
    checkoutPage: true,       // Enable /checkout/[id] page
    customCss: "",            // CSS injected into MCP-UI
    theme: {
      primaryColor: "#1a1a1a",
      secondaryColor: "#666",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      borderRadius: "12px"
    }
  }
}
```

## Generated File Configuration

After generation, these files can be modified directly:

| File | Configuration |
|------|---------------|
| `next.config.js` | CORS headers, Next.js settings |
| `drizzle.config.ts` | Database connection, migration paths |
| `tailwind.config.ts` | Tailwind CSS theme |
| `.env` | Runtime environment variables |
| `src/lib/mcp-server.ts` | MCP tool definitions |
| `src/lib/ucp/checkout-session-manager.ts` | UCP checkout logic, tax rate |
| `src/lib/mcp-ui.ts` | MCP-UI HTML templates |
| `src/lib/currency.ts` | Currency formatting |
