/**
 * OpenAgentShop SDK
 *
 * Build MCP-UI ready and UCP-compliant agentic commerce apps
 * from a product catalog JSON.
 *
 * @example
 * ```typescript
 * import { createShop, generateProject } from "open-agent-shop";
 *
 * const catalog = JSON.parse(fs.readFileSync("catalog.json", "utf-8"));
 * generateProject(catalog, "./my-shop");
 * ```
 */

// Types
export type { ProductCatalog, ShopConfig, ProductSchema, CustomAttribute, CatalogProduct, ProductMedia } from "./types/product-catalog";
export type { OpenAgentShopConfig, DatabaseConfig, McpConfig, UcpConfig, FeedConfig, UiConfig } from "./types/config";
export type {
  UcpCheckoutData, UcpCheckoutResponse, UcpLineItem, UcpBuyer,
  UcpTotal, UcpMessage, UcpEnvelope, UcpProfile, CheckoutStatus,
  CreateCheckoutInput, UpdateCheckoutInput, CompleteCheckoutInput,
} from "./types/ucp";

// Core generators
export { generateSchemaSource, generateSeedSource } from "./core/schema-builder";
export { generateMcpServerSource } from "./core/mcp-server-builder";
export { generateCheckoutManagerSource } from "./core/ucp-checkout";
export { generateMcpUiSource } from "./core/mcp-ui-renderer";
export { generateFeedAdapterSource, generateFeedRouteSource } from "./core/feed-adapter";

// Currency utilities
export {
  minorToMajor, majorToMinor, formatCurrencyDisplay,
  formatPriceForFeed, calculateTax, calculateTotals,
  getCurrencyExponent,
} from "./core/currency";

// Route handler generators
export { generateMcpRouteSource } from "./handlers/mcp-route";
export { generateProductsRouteSource, generateProductByIdRouteSource, generateOrdersRouteSource } from "./handlers/merchant-api";
export { generateWellKnownUcpSource } from "./handlers/well-known-ucp";

// URL Scraping utilities
export {
  priceToMinorUnits, slugify, convertScrapedToCatalog,
  validateCatalog, CATALOG_TEMPLATE, SCRAPING_INSTRUCTIONS,
} from "./core/url-scraper";
export type { ScrapedProduct } from "./core/url-scraper";

// CLI / project generation
export { generateProject } from "./cli/scaffold";
