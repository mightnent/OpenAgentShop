/**
 * OpenAgentShop Product Catalog JSON Specification
 *
 * This is the canonical input format for the SDK. AI agents convert
 * merchant product data (uploads, scrapes, APIs) into this JSON format,
 * which the SDK then uses to generate the database schema, MCP tools,
 * MCP-UI components, and UCP checkout flow.
 *
 * @version 0.1.0
 */

// ---------------------------------------------------------------------------
// Shop Configuration
// ---------------------------------------------------------------------------

export interface ShopBranding {
  /** Primary brand color (hex, e.g. "#1a1a1a") */
  primary_color?: string;
  /** Secondary brand color */
  secondary_color?: string;
  /** Logo image URL */
  logo_url?: string;
  /** Favicon URL */
  favicon_url?: string;
}

export interface ShopPolicies {
  /** Terms of service URL */
  terms_url?: string;
  /** Privacy policy URL */
  privacy_url?: string;
  /** Return/refund policy URL */
  return_url?: string;
  /** Return window in days (default: 14) */
  return_window_days?: number;
}

export interface ShopConfig {
  /** Shop display name */
  name: string;
  /** Short description of the shop */
  description: string;
  /** Shop URL (used for feed, UCP profile, checkout links) */
  url: string;
  /**
   * Reverse domain namespace for UCP (e.g., "com.myshop" for myshop.com).
   * Used for payment_handlers and capabilities namespacing.
   * If not provided, will be auto-derived from url or use "dev.localhost" in development.
   */
  ucp_namespace?: string;
  /** ISO 4217 currency code (default: "USD") */
  currency?: string;
  /** Tax rate as decimal (e.g., 0.08 for 8%). Set to 0 for tax-free. */
  tax_rate?: number;
  /** Port to run the dev server on (default: 3000) */
  port?: number;
  /** Shop branding */
  branding?: ShopBranding;
  /** Shop policies */
  policies?: ShopPolicies;
}

// ---------------------------------------------------------------------------
// Product Schema Definition
// ---------------------------------------------------------------------------

/** Supported types for custom product attributes */
export type AttributeType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]"
  | "json";

/**
 * Custom attribute definition.
 * These extend the base product fields with domain-specific data.
 *
 * Examples:
 *   - Travel insurance: coverage_highlights (string[]), regions_covered (string[])
 *   - Fashion: sizes (string[]), colors (string[]), material (string)
 *   - Electronics: specs (json), warranty_months (number)
 *   - Food: ingredients (string[]), calories (number), allergens (string[])
 */
export interface CustomAttribute {
  /** Unique key for this attribute (snake_case) */
  key: string;
  /** Data type */
  type: AttributeType;
  /** Human-readable label */
  label: string;
  /** Whether to show this attribute in product list views */
  display_in_list?: boolean;
  /** Whether to show this attribute in product detail views */
  display_in_detail?: boolean;
  /** Whether this attribute can be used as a filter in product discovery */
  filterable?: boolean;
  /** Whether this attribute is required for all products */
  required?: boolean;
  /** Default value if not provided */
  default_value?: unknown;
  /** Description for AI agents to understand the attribute */
  description?: string;
}

/**
 * Product schema configuration.
 * Defines the shape of products beyond the base fields.
 */
export interface ProductSchema {
  /** Custom attributes that extend the base product model */
  custom_attributes?: CustomAttribute[];
  /**
   * Product tiers/levels. Used for filtering and pricing segments.
   * Example: ["budget", "standard", "premium"]
   */
  tiers?: string[];
  /**
   * Product categories. Used for organization and filtering.
   * Example: ["Travel Insurance", "Health Insurance"]
   */
  categories?: string[];
}

// ---------------------------------------------------------------------------
// Product Definition
// ---------------------------------------------------------------------------

export interface ProductMedia {
  /** Media type */
  type: "image" | "video" | "document";
  /** Media URL */
  url: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Sort order (lower = first) */
  sort_order?: number;
}

/**
 * A single product in the catalog.
 *
 * Prices are in MINOR UNITS (e.g., cents for USD).
 * $29.99 = 2999, $199.99 = 19999, ¥1000 = 1000 (JPY has 0 decimals)
 */
export interface CatalogProduct {
  /**
   * Unique product identifier (string slug or numeric).
   * Used as the external reference ID. Must be unique within the catalog.
   */
  id: string;
  /** Product display name */
  name: string;
  /** Short description (1-2 sentences, shown in list views) */
  short_description?: string;
  /** Full description (shown in detail views) */
  description?: string;
  /** Price in minor units (e.g., 2999 = $29.99 USD) */
  price: number;
  /** Discounted price in minor units, if on sale */
  discount_price?: number | null;
  /** Product tier (must match one of product_schema.tiers if defined) */
  tier?: string;
  /** Product category (must match one of product_schema.categories if defined) */
  category?: string;
  /** Whether the product is currently available for purchase */
  active?: boolean;
  /** Product media (images, videos, documents) */
  media?: ProductMedia[];
  /**
   * Custom attribute values.
   * Keys must match custom_attributes defined in product_schema.
   */
  attributes?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Full Catalog (Top-Level Input)
// ---------------------------------------------------------------------------

/**
 * The complete product catalog JSON.
 * This is the primary input to the OpenAgentShop SDK.
 *
 * @example
 * ```json
 * {
 *   "shop": {
 *     "name": "TravelGuard Insurance",
 *     "description": "Comprehensive travel insurance plans",
 *     "url": "https://travelguard.example.com",
 *     "currency": "USD",
 *     "tax_rate": 0.08
 *   },
 *   "product_schema": {
 *     "custom_attributes": [
 *       {
 *         "key": "coverage_highlights",
 *         "type": "string[]",
 *         "label": "Coverage Highlights",
 *         "display_in_detail": true,
 *         "filterable": false
 *       }
 *     ],
 *     "tiers": ["budget", "standard", "premium"]
 *   },
 *   "products": [
 *     {
 *       "id": "budget-explorer",
 *       "name": "Budget Explorer",
 *       "price": 2999,
 *       "tier": "budget",
 *       "active": true,
 *       "attributes": {
 *         "coverage_highlights": ["Emergency Medical $50k"]
 *       }
 *     }
 *   ]
 * }
 * ```
 */
export interface ProductCatalog {
  /** Shop-level configuration */
  shop: ShopConfig;
  /** Product schema definition (custom attributes, tiers, categories) */
  product_schema?: ProductSchema;
  /** Array of products in the catalog */
  products: CatalogProduct[];
}
