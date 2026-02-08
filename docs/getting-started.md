# Getting Started

This guide walks through creating your first OpenAgentShop project from scratch.

## Prerequisites

- Node.js 18+
- A PostgreSQL database (Neon, Supabase, or self-hosted)
- A product catalog in JSON format (see [Product Catalog Spec](./product-catalog-spec.md))

## Step 1: Prepare Your Product Catalog

The SDK expects a JSON file that describes your shop and products. The simplest catalog looks like this:

```json
{
  "shop": {
    "name": "My Store",
    "description": "A great store",
    "url": "http://localhost:3000",
    "currency": "USD"
  },
  "products": [
    {
      "id": "product-1",
      "name": "Widget",
      "price": 1999,
      "active": true
    }
  ]
}
```

**Prices are in minor units** (cents for USD). `1999` = $19.99.

For more complex catalogs with custom attributes, tiers, and categories, see the [full spec](./product-catalog-spec.md).

### Getting Product Data

You can create the catalog JSON from various sources:

1. **Manual entry** - Write the JSON directly
2. **AI agent conversion** - Have an AI agent convert a CSV, spreadsheet, or product listing into the catalog format
3. **Web scraping** - AI agents can scrape an existing e-commerce site and convert the data
4. **API export** - Export from Shopify, WooCommerce, etc. and transform to catalog format

## Step 2: Generate the Project

```bash
npx open-agent-shop init --catalog catalog.json --output ./my-store
```

Validate UCP discovery:

```bash
npx open-agent-shop ucp:check http://localhost:3000
```

Options:
- `--catalog <path>` (required) - Path to your product catalog JSON
- `--output <dir>` - Output directory (defaults to `./<shop-name>`)
- `--provider <neon|postgres|supabase>` - Database provider (default: `neon`)

## Step 3: Configure the Database

```bash
cd my-store
cp .env.example .env
```

Edit `.env` with your database connection string:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Database Provider Setup

**Neon (recommended for development):**
1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard

**Supabase:**
1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings > Database > Connection string
3. Use the connection pooler string

**Standard PostgreSQL:**
1. Use any PostgreSQL 14+ instance
2. Create a database for your shop
3. Use the standard connection string format

## Step 4: Install and Set Up

```bash
npm install
npm run db:push    # Apply the database schema
npm run db:seed    # Seed your products from the catalog
npm run dev        # Start the dev server
```

## Step 5: Connect an AI Agent

Your MCP server is running at `http://localhost:3000/api/mcp`. Connect it to any MCP-compatible AI client:

### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "my-store": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### MCP Inspector
```bash
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

## Step 6: Test the Flow

Once connected, try these interactions with your AI agent:

1. **Browse products:** "Show me what products are available"
2. **Get details:** "Tell me more about [product name]"
3. **Start checkout:** "I'd like to purchase [product name]"
4. **Complete order:** "My email is test@example.com, name is Jane Doe"

## What's Running

After setup, you have these endpoints:

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/api/mcp` | MCP server (for AI agents) |
| `http://localhost:3000/merchant` | Merchant center (product/order management) |
| `http://localhost:3000/api/feed` | Commerce feed (JSONL) |
| `http://localhost:3000/.well-known/ucp` | UCP capability profile |

## Next Steps

- Customize the MCP-UI theme - see [MCP-UI Guide](./mcp-ui-guide.md)
- Configure UCP payment handlers - see [UCP Integration](./ucp-integration.md)
- Add custom product attributes - see [Product Catalog Spec](./product-catalog-spec.md)
- Review all configuration options - see [Configuration](./configuration.md)
