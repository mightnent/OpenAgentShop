---
name: OpenAgentShop
description: |
  Build MCP-UI ready and UCP-compliant agentic commerce apps from a product catalog JSON.
  Use this skill when: creating AI agent storefronts, generating MCP commerce servers,
  implementing UCP checkout flows, or onboarding merchants to agentic commerce.
---

# OpenAgentShop Skill

Generate complete Next.js storefronts that AI agents can interact with via MCP and that follow UCP for checkout.

## Onboarding Prompt

Use this to collect requirements from merchants:

```
I can build your agentic shop with OpenAgentShop. Please share:

1) Shop info: name, description, public URL, currency (e.g., USD), tax rate (or 0)
2) Product data: catalog JSON, CSV, website link, or product list (name, price, description)
3) Categories, tiers, or filters for browsing
```

### Required Inputs

- **Shop name** and **description**
- **Shop URL** (for UCP profile + feed links)
- **Currency** (defaults to USD)
- **Products** (at least id, name, price in minor units)

## Workflow

### 1. Gather Product Data

Accept: JSON catalog, CSV, website link to scrape, verbal description, or product images.

### 2. Convert to Catalog JSON

```json
{
  "shop": {
    "name": "Shop Name",
    "url": "http://localhost:3000",
    "currency": "USD",
    "tax_rate": 0.08
  },
  "product_schema": {
    "custom_attributes": [],
    "tiers": [],
    "categories": []
  },
  "products": []
}
```

**Key rules:**
- All prices in **minor units** (cents). $29.99 = `2999`
- Each product needs unique string `id` (slug format)
- Define custom attributes from product data (sizes, colors, features, etc.)

### 3. Generate Project

```bash
npx open-agent-shop init --catalog catalog.json --output ./shop-name
```

### 4. Set Up Database

```bash
cd shop-name
cp .env.example .env
# Edit .env with DATABASE_URL
npm install
npm run db:push
npm run db:seed
npm run dev
```

### 5. Verify

- MCP server: `http://localhost:3000/api/mcp`
- Merchant center: `http://localhost:3000/merchant`
- UCP profile: `http://localhost:3000/.well-known/ucp`

## Generated MCP Tools

| Tool | Description |
|------|-------------|
| `list_products` | Filter/browse products |
| `get_product` | Get product details |
| `recommend_products` | Get recommendations |
| `create_checkout` | Start UCP checkout |
| `get_checkout` | Check checkout status |
| `update_checkout` | Update buyer/items |
| `complete_checkout` | Place order |
| `cancel_checkout` | Cancel checkout |

## UCP Compliance

**Always check latest UCP docs** - protocol is fast-evolving.
- Online: https://ucp.dev/2026-01-23/
- Local: `/ucp/docs` in workspace

**Key concepts:**
- Checkout capability: `dev.ucp.shopping.checkout`
- All prices in minor units (cents)
- Status lifecycle: `incomplete` → `ready_for_complete` → `completed`
- Required buyer fields: `email`, `first_name`, `last_name`

## Catalog Quick Reference

### Shop Config

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Shop display name |
| `description` | Yes | - | Short description |
| `url` | Yes | - | Shop URL |
| `currency` | No | USD | ISO 4217 code |
| `tax_rate` | No | 0 | Decimal (0.08 = 8%) |

### Custom Attribute Types

| Type | Example |
|------|---------|
| `string` | `"Red"` |
| `number` | `42` |
| `boolean` | `true` |
| `string[]` | `["S", "M", "L"]` |
| `number[]` | `[7, 14, 30]` |
| `json` | `{"key": "val"}` |

### Product Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique slug |
| `name` | Yes | Display name |
| `price` | Yes | Minor units |
| `active` | No | Default: true |
| `tier` | No | Must match schema |
| `category` | No | Must match schema |
| `attributes` | No | Custom values |

## Domain-Specific Attributes

**Travel insurance:** coverage highlights, regions, durations  
**Fashion:** sizes, colors, materials  
**SaaS:** features, user limits, storage  
**Food:** ingredients, allergens, calories  
**Electronics:** specs, warranty, compatibility

## Reference Implementation

For detailed implementation patterns, see:
- `references/travel-insurance-reference.md` - MCP server, UCP checkout, schema patterns

## Troubleshooting

**Database connection fails:**
- Verify `DATABASE_URL` in `.env`
- For Neon: include `?sslmode=require`

**MCP connection fails:**
- Verify server running
- Test with: `npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp`

**Products not showing:**
- Run `npm run db:seed`
- Check `npm run db:studio`
- Ensure `active: true`

## Common Code Patterns

### Adding Custom MCP Tool

```typescript
server.tool(
  "check_coverage",
  "Check if region is covered",
  { productId: z.number(), region: z.string() },
  async (args) => {
    const product = await db.select().from(products)
      .where(eq(products.id, args.productId)).limit(1);
    const regions = product[0]?.regionsCovered as string[] || [];
    const covered = regions.some(r => 
      r.toLowerCase().includes(args.region.toLowerCase())
    );
    return { 
      content: [{ type: "text", text: covered ? "Yes" : "No" }] 
    };
  }
);
```

### Defensive Guards

```typescript
// Always guard array access
if (checkout.messages && checkout.messages.length > 0) { ... }

// Guard line items
if (!items || !Array.isArray(items)) {
  return { resolved: [], messages: [] };
}
```
