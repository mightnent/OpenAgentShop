/**
 * OpenAgentShop SDK Configuration Types
 *
 * These types define how the SDK is configured at runtime,
 * including database, MCP server, and UCP settings.
 */

import type { ProductCatalog } from "./product-catalog";

// ---------------------------------------------------------------------------
// Database Configuration
// ---------------------------------------------------------------------------

export type DatabaseProvider = "neon" | "postgres" | "supabase" | "sqlite";

export interface DatabaseConfig {
  /**
   * Database provider.
   * - "neon": Neon serverless Postgres (uses @neondatabase/serverless)
   * - "postgres": Standard PostgreSQL (uses pg or postgres.js)
   * - "supabase": Supabase Postgres
   * - "sqlite": SQLite for local development (uses better-sqlite3)
   */
  provider: DatabaseProvider;
  /** Database connection string (falls back to DATABASE_URL env var) */
  connectionString?: string;
  /** SQLite database file path (only for sqlite provider, default: ./data/shop.db) */
  sqlitePath?: string;
}

// ---------------------------------------------------------------------------
// MCP Configuration
// ---------------------------------------------------------------------------

export interface McpConfig {
  /** Server name exposed in MCP capabilities (default: shop name) */
  serverName?: string;
  /** Server version (default: "1.0.0") */
  serverVersion?: string;
  /**
   * Which MCP-UI delivery mode(s) to use.
   * - "classic": Embed HTML directly in tool response content
   * - "resource": Register HTML via resources/read (MCP Apps)
   * - "both": Support both modes simultaneously (recommended)
   * Default: "both"
   */
  uiMode?: "classic" | "resource" | "both";
  /**
   * Custom tool definitions to add alongside auto-generated tools.
   * Advanced usage for extending the MCP server.
   */
  customTools?: CustomToolDefinition[];
}

export interface CustomToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// UCP Configuration
// ---------------------------------------------------------------------------

export interface UcpConfig {
  /** UCP version to advertise (default: "2026-01-11") */
  version?: string;
  /**
   * Payment handler declarations for the UCP profile.
   * Default: mock payment handler for development.
   */
  paymentHandlers?: Record<string, PaymentHandlerConfig[]>;
  /**
   * Capabilities to advertise in /.well-known/ucp profile.
   * Default: ["dev.ucp.shopping.checkout"]
   */
  capabilities?: string[];
  /**
   * Extensions to enable.
   * Default: none. Available: "fulfillment", "discount", "ap2_mandate", "buyer_consent"
   */
  extensions?: UcpExtension[];
}

export type UcpExtension = "fulfillment" | "discount" | "ap2_mandate" | "buyer_consent";

export interface PaymentHandlerConfig {
  id: string;
  version: string;
  spec?: string;
  schema?: string;
  config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Feed Configuration
// ---------------------------------------------------------------------------

export interface FeedConfig {
  /** Whether to enable the /api/feed endpoint (default: true) */
  enabled?: boolean;
  /** Merchant name for feed output */
  merchantName?: string;
  /** Default product brand name */
  defaultBrand?: string;
  /** Whether products are eligible for checkout via feed (default: false) */
  enableCheckout?: boolean;
  /** Product category for feed (e.g., "Insurance > Travel Insurance") */
  productCategory?: string;
}

// ---------------------------------------------------------------------------
// UI Configuration
// ---------------------------------------------------------------------------

export interface UiConfig {
  /** Enable merchant center UI at /merchant (default: true) */
  merchantCenter?: boolean;
  /** Enable checkout page UI at /checkout/[id] (default: true) */
  checkoutPage?: boolean;
  /** Custom CSS to inject into MCP-UI HTML */
  customCss?: string;
  /** Theme overrides for MCP-UI components */
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    borderRadius?: string;
  };
}

// ---------------------------------------------------------------------------
// Top-Level SDK Configuration
// ---------------------------------------------------------------------------

/**
 * Complete SDK configuration.
 * Pass this to `createShop()` to initialize an OpenAgentShop instance.
 */
export interface OpenAgentShopConfig {
  /** Product catalog (the primary input) */
  catalog: ProductCatalog;
  /** Database configuration */
  database?: DatabaseConfig;
  /** MCP server configuration */
  mcp?: McpConfig;
  /** UCP protocol configuration */
  ucp?: UcpConfig;
  /** Commerce feed configuration */
  feed?: FeedConfig;
  /** UI configuration */
  ui?: UiConfig;
}
