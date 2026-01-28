# Product Catalog JSON Specification

The product catalog JSON is the primary input to OpenAgentShop. It defines your shop configuration, product schema, and product data. The SDK uses this to generate the database schema, MCP tools, MCP-UI components, and UCP checkout flow.

## Top-Level Structure

```json
{
  "shop": { ... },
  "product_schema": { ... },
  "products": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shop` | `ShopConfig` | Yes | Shop-level configuration |
| `product_schema` | `ProductSchema` | No | Product schema definition |
| `products` | `CatalogProduct[]` | Yes | Array of products |

## Shop Configuration

```json
{
  "shop": {
    "name": "My Store",
    "description": "A great store",
    "url": "http://localhost:3000",
    "currency": "USD",
    "tax_rate": 0.08,
    "port": 3000,
    "branding": {
      "primary_color": "#1a1a1a",
      "secondary_color": "#666666",
      "logo_url": "https://example.com/logo.png",
      "favicon_url": "https://example.com/favicon.ico"
    },
    "policies": {
      "terms_url": "https://example.com/terms",
      "privacy_url": "https://example.com/privacy",
      "return_url": "https://example.com/returns",
      "return_window_days": 14
    }
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Shop display name |
| `description` | string | Yes | — | Short description |
| `url` | string | Yes | — | Shop URL (used for feed, UCP profile, links) |
| `currency` | string | No | `"USD"` | ISO 4217 currency code |
| `tax_rate` | number | No | `0` | Tax rate as decimal (0.08 = 8%) |
| `port` | number | No | `3000` | Dev server port |
| `branding` | object | No | — | UI branding options |
| `policies` | object | No | — | Legal/policy URLs |

## Product Schema

The product schema defines how your products are structured beyond the base fields. This drives database column generation, MCP tool filters, and UI rendering.

```json
{
  "product_schema": {
    "custom_attributes": [
      {
        "key": "features",
        "type": "string[]",
        "label": "Features",
        "display_in_list": false,
        "display_in_detail": true,
        "filterable": false,
        "required": false,
        "description": "Product feature list"
      }
    ],
    "tiers": ["basic", "pro", "enterprise"],
    "categories": ["Software", "Hardware"]
  }
}
```

### Custom Attributes

Custom attributes extend the base product model with domain-specific fields. Each attribute becomes a column in the database and can optionally be used as a filter in MCP tools or displayed in MCP-UI components.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `key` | string | Yes | — | Unique identifier (snake_case) |
| `type` | string | Yes | — | Data type (see below) |
| `label` | string | Yes | — | Human-readable label |
| `display_in_list` | boolean | No | `false` | Show in product list views |
| `display_in_detail` | boolean | No | `false` | Show in product detail views |
| `filterable` | boolean | No | `false` | Enable as filter in `list_products` tool |
| `required` | boolean | No | `false` | Required for all products |
| `default_value` | any | No | — | Default value if not provided |
| `description` | string | No | — | Description for AI agents |

#### Attribute Types

| Type | DB Column | Description | Example |
|------|-----------|-------------|---------|
| `string` | `text` | Free text | `"Red"` |
| `number` | `integer` | Numeric value | `42` |
| `boolean` | `boolean` | True/false | `true` |
| `string[]` | `jsonb` | Array of strings | `["A", "B"]` |
| `number[]` | `jsonb` | Array of numbers | `[7, 14, 30]` |
| `json` | `jsonb` | Arbitrary JSON | `{"key": "value"}` |

### Tiers

Optional product tiers for segmentation. When defined, generates:
- A `tier` column on the products table
- A `tier` filter parameter on the `list_products` MCP tool
- Tier badges in MCP-UI product cards

### Categories

Optional product categories. When defined, generates:
- A `category` column on the products table
- A `category` filter parameter on the `list_products` MCP tool

## Products

Each product in the `products` array represents a single item in your catalog.

```json
{
  "id": "starter-plan",
  "name": "Starter Plan",
  "short_description": "Great for getting started",
  "description": "Full description of the starter plan...",
  "price": 999,
  "discount_price": 799,
  "tier": "basic",
  "category": "Software",
  "active": true,
  "media": [
    {
      "type": "image",
      "url": "https://example.com/image.jpg",
      "alt": "Starter Plan",
      "sort_order": 0
    }
  ],
  "attributes": {
    "features": ["Feature A", "Feature B", "Feature C"]
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Unique identifier (slug) |
| `name` | string | Yes | — | Display name |
| `short_description` | string | No | — | 1-2 sentence summary |
| `description` | string | No | — | Full description |
| `price` | number | Yes | — | Price in **minor units** |
| `discount_price` | number | No | `null` | Sale price in minor units |
| `tier` | string | No | — | Must match `product_schema.tiers` |
| `category` | string | No | — | Must match `product_schema.categories` |
| `active` | boolean | No | `true` | Available for purchase |
| `media` | array | No | `[]` | Product images/videos |
| `attributes` | object | No | `{}` | Custom attribute values |

### Pricing in Minor Units

All prices are integers in the currency's minor unit. This follows UCP conventions and prevents floating-point errors.

| Currency | Minor Unit | $29.99 | $0.50 | Free |
|----------|-----------|--------|-------|------|
| USD | cent | `2999` | `50` | `0` |
| EUR | cent | `2999` | `50` | `0` |
| JPY | yen | `30` | `1` | `0` |
| GBP | penny | `2999` | `50` | `0` |
| BHD | fils | `29990` | `500` | `0` |

## Domain Examples

### Travel Insurance

```json
{
  "product_schema": {
    "custom_attributes": [
      { "key": "coverage_highlights", "type": "string[]", "label": "Coverage", "display_in_detail": true },
      { "key": "regions_covered", "type": "string[]", "label": "Regions", "filterable": true },
      { "key": "duration_options", "type": "number[]", "label": "Duration (days)" }
    ],
    "tiers": ["budget", "standard", "premium"]
  }
}
```

### Fashion / Apparel

```json
{
  "product_schema": {
    "custom_attributes": [
      { "key": "sizes", "type": "string[]", "label": "Available Sizes", "display_in_detail": true },
      { "key": "colors", "type": "string[]", "label": "Colors", "display_in_detail": true, "filterable": true },
      { "key": "material", "type": "string", "label": "Material", "display_in_detail": true }
    ],
    "categories": ["Tops", "Bottoms", "Shoes", "Accessories"]
  }
}
```

### SaaS / Software

```json
{
  "product_schema": {
    "custom_attributes": [
      { "key": "features", "type": "string[]", "label": "Features", "display_in_detail": true },
      { "key": "user_limit", "type": "number", "label": "User Limit", "display_in_list": true },
      { "key": "storage_gb", "type": "number", "label": "Storage (GB)", "display_in_list": true },
      { "key": "api_access", "type": "boolean", "label": "API Access", "display_in_detail": true }
    ],
    "tiers": ["starter", "pro", "enterprise"]
  }
}
```

### Food / Restaurant

```json
{
  "product_schema": {
    "custom_attributes": [
      { "key": "ingredients", "type": "string[]", "label": "Ingredients", "display_in_detail": true },
      { "key": "allergens", "type": "string[]", "label": "Allergens", "display_in_detail": true, "filterable": true },
      { "key": "calories", "type": "number", "label": "Calories", "display_in_list": true },
      { "key": "spice_level", "type": "string", "label": "Spice Level", "filterable": true }
    ],
    "categories": ["Appetizers", "Mains", "Desserts", "Drinks"]
  }
}
```

## Validation Rules

1. `shop.name`, `shop.description`, and `shop.url` are required
2. Each product must have a unique `id`
3. Product `price` must be a non-negative integer
4. If `tiers` are defined, product `tier` values must match one of them
5. If `categories` are defined, product `category` values must match one of them
6. Custom attribute `key` values must be valid identifiers (snake_case)
7. Product `attributes` keys must match defined `custom_attributes` keys
