# OpenAgentShop

**Build MCP-UI ready and UCP-compliant agentic commerce apps from a product catalog JSON.**

OpenAgentShop is an SDK and CLI that generates complete Next.js storefronts wired for AI agent commerce. Give it your product catalog, and it produces a working app with:

- **MCP Server** with product discovery and checkout tools
- **MCP-UI** components for rich product display in AI chat interfaces
- **UCP Checkout** (Universal Commerce Protocol) session management
- **Merchant Center** for product and order management
- **Commerce Feed** endpoint (OpenAI-compatible JSONL)

## Quick Start

### 1. Define your product catalog

Create a `catalog.json` file following the [Product Catalog Spec](./docs/product-catalog-spec.md):

```json
{
  "shop": {
    "name": "My Store",
    "description": "An awesome store",
    "url": "http://localhost:3000",
    "currency": "USD",
    "tax_rate": 0.08
  },
  "product_schema": {
    "tiers": ["basic", "pro"],
    "custom_attributes": [
      {
        "key": "features",
        "type": "string[]",
        "label": "Features",
        "display_in_detail": true
      }
    ]
  },
  "products": [
    {
      "id": "starter-plan",
      "name": "Starter Plan",
      "price": 999,
      "tier": "basic",
      "active": true,
      "attributes": {
        "features": ["Feature A", "Feature B"]
      }
    }
  ]
}
```

### 2. Generate the project

```bash
npx open-agent-shop init --catalog catalog.json --output ./my-store
```

### 3. Set up and run

```bash
cd my-store
cp .env.example .env
# Edit .env with your DATABASE_URL (any PostgreSQL database)
npm install
npm run db:push
npm run db:seed
npm run dev
```

Your MCP server is now running at `http://localhost:3000/api/mcp`.

## What Gets Generated

```
my-store/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── mcp/route.ts             # MCP Streamable HTTP endpoint
│   │   │   ├── feed/route.ts            # Commerce feed (JSONL)
│   │   │   └── merchant/               # Merchant CRUD API
│   │   ├── .well-known/ucp/route.ts    # UCP capability discovery
│   │   ├── merchant/page.tsx            # Merchant center UI
│   │   ├── checkout/[id]/page.tsx       # Checkout page
│   │   └── layout.tsx
│   ├── db/
│   │   ├── schema.ts                    # Drizzle schema (from your catalog)
│   │   ├── seed.ts                      # Seed data (from your products)
│   │   └── index.ts                     # DB connection
│   └── lib/
│       ├── mcp-server.ts                # MCP tools (auto-generated)
│       ├── mcp-ui.ts                    # MCP-UI HTML renderers
│       ├── ucp/checkout-session-manager.ts  # UCP checkout logic
│       ├── feed-adapter.ts              # Commerce feed adapter
│       └── currency.ts                  # UCP-compliant currency utils
├── package.json
├── next.config.js
├── drizzle.config.ts
└── .env.example
```

## MCP Tools (Auto-Generated)

| Tool | Description |
|------|-------------|
| `list_products` | Filter and browse products with tier/category/keyword support |
| `get_product` | Get detailed product information with MCP-UI card |
| `recommend_products` | Get personalized product recommendations |
| `create_checkout` | Start a UCP checkout session |
| `get_checkout` | Retrieve checkout session state |
| `update_checkout` | Update buyer info or line items |
| `complete_checkout` | Finalize checkout and create order |
| `cancel_checkout` | Cancel a checkout session |

## Database Support

OpenAgentShop works with any PostgreSQL database:

- **Neon** (default) - Serverless Postgres, great for development
- **Supabase** - Managed Postgres with extras
- **Standard PostgreSQL** - Any self-hosted or cloud PostgreSQL instance

```bash
# Specify provider at generation time
npx open-agent-shop init --catalog catalog.json --provider postgres
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](./docs/getting-started.md) | Full setup walkthrough |
| [Product Catalog Spec](./docs/product-catalog-spec.md) | JSON specification for product catalogs |
| [Architecture](./docs/architecture.md) | System architecture and design decisions |
| [MCP-UI Guide](./docs/mcp-ui-guide.md) | How MCP-UI components work |
| [UCP Integration](./docs/ucp-integration.md) | UCP protocol implementation details |
| [Configuration](./docs/configuration.md) | All configuration options |
| [API Reference](./docs/api-reference.md) | Generated API endpoints and MCP tools |
| [Roadmap](./docs/roadmap.md) | Current status and future plans |

## For AI Coding Agents

**AI agents (Manus, Cascade, Claude Code, etc.):** Start with [INSTRUCTIONS.md](./INSTRUCTIONS.md) for a complete step-by-step workflow to help users build shops.

**Advanced patterns and skill integration:** See [skills/SKILL.md](./skills/SKILL.md) for detailed implementation patterns, code examples, and troubleshooting.

**Reference implementations:** Review [`examples/`](./examples/) to see complete generated shops.

## License

MIT
