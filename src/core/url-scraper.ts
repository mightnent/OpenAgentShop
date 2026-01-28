/**
 * URL Scraper for Product Catalog Generation
 *
 * Utilities to help AI agents scrape product data from existing websites
 * and convert it into OpenAgentShop catalog format.
 *
 * NOTE: This module provides helper functions and templates.
 * Actual scraping should be done by AI agents using appropriate tools.
 */

import type { ProductCatalog, CatalogProduct, ProductMedia } from "../types/product-catalog";

/**
 * Template for AI agents to understand the expected catalog structure
 */
export const CATALOG_TEMPLATE: ProductCatalog = {
  shop: {
    name: "Shop Name",
    description: "Shop description",
    url: "https://example.com",
    currency: "USD",
    tax_rate: 0,
  },
  product_schema: {
    tiers: [],
    categories: [],
    custom_attributes: [],
  },
  products: [],
};

/**
 * Helper to convert major currency units to minor units
 * e.g., $29.99 -> 2999
 */
export function priceToMinorUnits(price: number | string, currency: string = "USD"): number {
  const numPrice = typeof price === "string" ? parseFloat(price.replace(/[^0-9.]/g, "")) : price;
  const exponent = ["JPY", "VND", "KRW"].includes(currency.toUpperCase()) ? 0 : 2;
  return Math.round(numPrice * Math.pow(10, exponent));
}

/**
 * Helper to generate a slug ID from product name
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Schema for scraped product data (what AI agents should extract)
 */
export interface ScrapedProduct {
  name: string;
  price: string | number;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  category?: string;
  tier?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Convert scraped products to catalog format
 */
export function convertScrapedToCatalog(
  shopInfo: {
    name: string;
    description: string;
    url: string;
    currency?: string;
    tax_rate?: number;
  },
  scrapedProducts: ScrapedProduct[],
  options?: {
    tiers?: string[];
    categories?: string[];
    customAttributes?: Array<{
      key: string;
      type: "string" | "number" | "boolean" | "string[]";
      label: string;
      display_in_list?: boolean;
      display_in_detail?: boolean;
      filterable?: boolean;
    }>;
  }
): ProductCatalog {
  const currency = shopInfo.currency || "USD";

  const products: CatalogProduct[] = scrapedProducts.map((scraped, index) => {
    const media: ProductMedia[] = scraped.imageUrl
      ? [{ type: "image", url: scraped.imageUrl, alt: scraped.name }]
      : [];

    const product: CatalogProduct = {
      id: slugify(scraped.name) || `product-${index + 1}`,
      name: scraped.name,
      price: priceToMinorUnits(scraped.price, currency),
      active: true,
    };

    if (scraped.description) product.description = scraped.description;
    if (scraped.shortDescription) product.short_description = scraped.shortDescription;
    if (scraped.category) product.category = scraped.category;
    if (scraped.tier) product.tier = scraped.tier;
    if (media.length > 0) product.media = media;
    if (scraped.attributes) product.attributes = scraped.attributes;

    return product;
  });

  // Auto-detect categories and tiers from products
  const detectedCategories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
  const detectedTiers = [...new Set(products.map(p => p.tier).filter(Boolean))] as string[];

  return {
    shop: {
      name: shopInfo.name,
      description: shopInfo.description,
      url: shopInfo.url,
      currency,
      tax_rate: shopInfo.tax_rate || 0,
    },
    product_schema: {
      tiers: options?.tiers || detectedTiers,
      categories: options?.categories || detectedCategories,
      custom_attributes: options?.customAttributes || [],
    },
    products,
  };
}

/**
 * Instructions for AI agents on how to scrape product data
 */
export const SCRAPING_INSTRUCTIONS = `
## Product Scraping Instructions

When scraping products from a website, extract the following for each product:

### Required Fields
- **name**: Product title/name
- **price**: Price in the displayed format (e.g., "$29.99", "29.99 USD")

### Optional Fields
- **description**: Full product description
- **shortDescription**: Brief summary (1-2 sentences)
- **imageUrl**: Primary product image URL
- **category**: Product category
- **tier**: Product tier (e.g., "basic", "premium")
- **attributes**: Any custom attributes (sizes, colors, features, etc.)

### Price Conversion
Prices should be converted to minor units (cents for USD):
- $29.99 → 2999
- $100.00 → 10000
- ¥1000 (JPY) → 1000 (no conversion, JPY has no decimal)

### Attribute Detection
Look for patterns in the products to identify custom attributes:
- Size options: S, M, L, XL
- Color options: Red, Blue, Green
- Features lists
- Specifications tables
- Variant selectors

### Output Format
Return data as JSON matching the ScrapedProduct interface:
{
  "name": "Product Name",
  "price": "29.99",
  "description": "Full description...",
  "shortDescription": "Brief summary",
  "imageUrl": "https://...",
  "category": "Category",
  "tier": "premium",
  "attributes": {
    "sizes": ["S", "M", "L"],
    "color": "Blue"
  }
}
`;

/**
 * Validate a product catalog for completeness
 */
export function validateCatalog(catalog: ProductCatalog): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Shop validation
  if (!catalog.shop?.name) errors.push("Missing shop.name");
  if (!catalog.shop?.description) errors.push("Missing shop.description");
  if (!catalog.shop?.url) errors.push("Missing shop.url");

  // Products validation
  if (!catalog.products || catalog.products.length === 0) {
    errors.push("No products in catalog");
  } else {
    catalog.products.forEach((product, i) => {
      if (!product.id) errors.push(`Product ${i}: missing id`);
      if (!product.name) errors.push(`Product ${i}: missing name`);
      if (typeof product.price !== "number" || product.price < 0) {
        errors.push(`Product ${i}: invalid price`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
