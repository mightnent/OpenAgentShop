# Instructions for AI Coding Agents

This document provides instructions for AI coding agents (Manus, Cascade, Claude, etc.) to help users build agentic commerce shops using the OpenAgentShop SDK.

## Overview

OpenAgentShop is an SDK that generates complete Next.js storefronts wired for AI agent commerce. You will help users by:
1. Gathering their product/shop requirements
2. Converting their data to a Product Catalog JSON
3. Running the CLI to generate a complete shop
4. Setting up the database and verifying everything works

## Quick Reference

- **Main docs**: Read `README.md` first
- **AI agent workflow**: See `skills/SKILL.md` for detailed patterns
- **Example output**: Review `examples/travel-insurance-mcp/` to see what you'll generate
- **Catalog spec**: See `docs/product-catalog-spec.md` for JSON format
- **UCP compliance**: See `docs/ucp-integration.md` for checkout patterns

## Step-by-Step Workflow

### 1. Review the SDK Structure

Before starting, familiarize yourself with:
- `README.md` - SDK overview and quick start
- `skills/SKILL.md` - Complete AI agent workflow and patterns
- `examples/travel-insurance-mcp/` - Reference implementation showing the generated output
- `templates/example-catalog.json` - Example catalog format

### 2. Gather Requirements from User

Use the onboarding prompt from `skills/SKILL.md`:

```
I can build your agentic shop with OpenAgentShop. Please share:

1) Shop info: name, description, public URL, currency (e.g., USD), tax rate (or 0)
2) Product data: catalog JSON, CSV, website link, or product list (name, price, description)
3) Categories, tiers, or filters for browsing
```

**Required information:**
- Shop name and description
- Shop URL (production URL or `http://localhost:3000` for development)
- Currency (default: USD)
- Tax rate (decimal format: 0.08 for 8%, or 0 for no tax)
- Product data source (one of):
  - URL to existing shop/website (you'll scrape it)
  - Product catalog JSON
  - CSV file with products
  - Manual product list

**Optional but helpful:**
- Product categories or tiers (e.g., "Basic", "Pro", "Enterprise")
- Custom attributes (sizes, colors, features, regions, coverage, etc.)
- Domain-specific requirements (travel insurance, SaaS, fashion, food, etc.)

### 3. Convert to Product Catalog JSON

Create a `catalog.json` file following the spec in `docs/product-catalog-spec.md`.

**Critical rules:**
- All prices in **minor units** (cents). $29.99 = `2999`, €10.00 = `1000`
- Each product needs a unique string `id` (slug format: "starter-plan", "pro-tier")
- Define `custom_attributes` in `product_schema` for domain-specific properties
- Set `active: true` for products that should be available

**Example structure:**
```json
{
  "shop": {
    "name": "My Store",
    "description": "Store description",
    "url": "http://localhost:3000",
    "currency": "USD",
    "tax_rate": 0.08
  },
  "product_schema": {
    "tiers": ["basic", "pro"],
    "categories": ["category1", "category2"],
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
      "id": "product-id",
      "name": "Product Name",
      "price": 2999,
      "tier": "basic",
      "category": "category1",
      "active": true,
      "attributes": {
        "features": ["Feature A", "Feature B"]
      }
    }
  ]
}
```

**If scraping from a website:**
- Use the SDK's URL scraper or implement your own
- Extract: product names, prices, descriptions, images (if available)
- Normalize prices to minor units
- Create sensible `id` slugs from product names

### 4. Generate the Project

Run the CLI command:

```bash
npx open-agent-shop init --catalog catalog.json --output ./[shop-name]
```

Replace `[shop-name]` with an appropriate folder name based on the user's shop (e.g., `./acme-insurance`, `./fashion-boutique`).

**Optional flags:**
- `--provider neon|supabase|postgres` - Specify database provider (default: neon)

### 5. Set Up Database

Navigate to the generated project:

```bash
cd [shop-name]
cp .env.example .env
```

**Ask the user:**
> Do you have a PostgreSQL database URL? You can use:
> - **Neon** (recommended for development) - Free tier at https://neon.tech
> - **Supabase** - Managed Postgres at https://supabase.com
> - **Standard PostgreSQL** - Any self-hosted or cloud Postgres instance

Once they provide the `DATABASE_URL`, update the `.env` file.

**For Neon URLs, remind them to include:** `?sslmode=require`

Example: `postgresql://user:pass@host/db?sslmode=require`

### 6. Install Dependencies and Seed Database

```bash
npm install
npm run db:push      # Push schema to database
npm run db:seed      # Seed with products from catalog
npm run dev          # Start development server
```

### 7. Verify Everything Works

Check that these endpoints are working:

1. **MCP Server**: http://localhost:3000/api/mcp
2. **Merchant Center**: http://localhost:3000/merchant
3. **UCP Profile**: http://localhost:3000/.well-known/ucp
4. **Commerce Feed**: http://localhost:3000/api/feed

**Test with MCP Inspector:**
```bash
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

This opens a UI to test the MCP tools like `list_products`, `get_product`, `create_checkout`, etc.

### 8. Provide User Summary

Give the user:

**What was generated:**
- MCP server with tools: `list_products`, `get_product`, `recommend_products`, `create_checkout`, `update_checkout`, `complete_checkout`, `cancel_checkout`
- MCP-UI components for rich product display in AI chat
- UCP checkout session manager
- Merchant center at `/merchant` for product/order management
- Commerce feed endpoint for AI agent discovery

**How to test:**
- Open MCP Inspector (command above)
- Try `list_products` with filters
- Try `get_product` with a product ID
- Create a checkout session
- Visit merchant center to manage products

**How to connect to Claude Desktop:**
Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "shop-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-http", "http://localhost:3000/api/mcp"]
    }
  }
}
```

**Next steps:**
- Customize the shop (branding, styling, additional MCP tools)
- Deploy to Vercel/Netlify with production database
- Add payment processing (Stripe, etc.)
- Configure domain and SSL

## Important Guidelines

### Follow the SDK Patterns
- Don't manually create files - use the CLI to generate the project
- The SDK handles schema generation, MCP tools, UCP compliance, etc.
- Check `examples/travel-insurance-mcp/` to see expected output structure

### Ask Clarifying Questions
If anything is unclear about:
- Product structure or attributes
- Pricing model
- Categories or tiers
- Business logic

**Ask the user before proceeding.** It's better to clarify upfront than generate the wrong structure.

### UCP Compliance
- Prices MUST be in minor units (cents)
- Checkout requires: `email`, `first_name`, `last_name`
- Status lifecycle: `incomplete` → `ready_for_complete` → `completed`
- See `docs/ucp-integration.md` for full details

### Defensive Coding
When extending the generated code:
- Always guard array access: `if (items && items.length > 0)`
- Validate user inputs
- Handle null/undefined gracefully
- See defensive patterns in `skills/SKILL.md`

## Common Scenarios

### Scenario: User has a website URL
1. Ask for the URL
2. Use web scraping to extract products (or ask user to manually provide list if scraping fails)
3. Convert to catalog JSON with prices in minor units
4. Generate project

### Scenario: User has a CSV file
1. Ask them to share the CSV or describe the columns
2. Parse CSV to extract products
3. Map to catalog JSON format (normalize prices to minor units)
4. Generate project

### Scenario: User provides manual product list
1. Ask for: name, price, description for each product
2. Create sensible `id` slugs (e.g., "Travel Insurance Pro" → "travel-insurance-pro")
3. Convert prices to minor units
4. Build catalog JSON
5. Generate project

### Scenario: Domain-specific attributes
**Travel Insurance:** `regionsCovered`, `coverageHighlights`, `durations`
**Fashion:** `sizes`, `colors`, `materials`, `gender`
**SaaS:** `features`, `userLimits`, `storageGB`, `apiCallsPerMonth`
**Food:** `ingredients`, `allergens`, `calories`, `servingSize`

Define these as `custom_attributes` in the `product_schema`.

## Troubleshooting

### Database connection fails
- Verify `DATABASE_URL` in `.env`
- For Neon, ensure `?sslmode=require` is appended
- Test connection with `npm run db:push`

### MCP connection fails
- Verify server is running (`npm run dev`)
- Test endpoint directly: `curl http://localhost:3000/api/mcp`
- Use MCP Inspector to debug tool calls

### Products not showing
- Run `npm run db:seed` to seed database
- Check products are `active: true` in catalog
- Use `npm run db:studio` to inspect database directly

### Build errors
- Ensure all dependencies installed: `npm install`
- Check Node.js version (requires Node 18+)
- Clear `.next` folder: `rm -rf .next` and restart dev server

## Reference Implementation

The `examples/travel-insurance-mcp/` directory contains a complete working shop generated by the SDK. Review it to understand:
- File structure and organization
- How MCP tools are wired up (`src/lib/mcp-server.ts`)
- UCP checkout implementation (`src/lib/ucp/checkout-session-manager.ts`)
- Database schema (`src/db/schema.ts`)
- MCP-UI rendering (`src/lib/mcp-ui.ts`)
- Merchant center UI (`src/app/merchant/page.tsx`)

## Additional Resources

- **UCP Spec**: https://ucp.dev/2026-01-23/
- **MCP Docs**: https://modelcontextprotocol.io/
- **Drizzle ORM**: https://orm.drizzle.team/
- **Next.js**: https://nextjs.org/docs

## Questions?

If you encounter scenarios not covered here:
1. Check `skills/SKILL.md` for detailed patterns
2. Review the example implementation
3. Ask the user for clarification
4. Refer to the documentation in `docs/`

Build great shops! 🚀
