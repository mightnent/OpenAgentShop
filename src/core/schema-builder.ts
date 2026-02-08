/**
 * Database Schema Builder
 *
 * Generates Drizzle ORM schema from a ProductCatalog definition.
 * The generated schema follows UCP conventions with minor-unit pricing.
 *
 * Produces 4 core tables:
 *   - products: Product catalog with custom attributes as JSONB
 *   - product_media: Product images, videos, documents
 *   - orders: Completed order records
 *   - checkout_sessions: UCP checkout session state
 */

import type { ProductCatalog, CustomAttribute } from "../types/product-catalog";

/**
 * Generate a complete Drizzle schema file as a string.
 * This is used by the CLI scaffolding to write db/schema.ts.
 */
export function generateSchemaSource(catalog: ProductCatalog): string {
  const currency = catalog.shop.currency ?? "USD";
  const tiers = catalog.product_schema?.tiers ?? [];
  const categories = catalog.product_schema?.categories ?? [];
  const customAttrs = catalog.product_schema?.custom_attributes ?? [];

  return `import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Products Table
// ---------------------------------------------------------------------------

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  /** External catalog ID (slug) */
  catalogId: varchar("catalog_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  shortDescription: text("short_description"),
  description: text("description"),
  /** ISO 4217 currency code */
  currency: varchar("currency", { length: 3 }).default("${currency}").notNull(),
  /** Price in minor units (e.g., 2999 = $29.99) */
  price: integer("price").notNull(),
  /** Discount price in minor units (null = no discount) */
  discountPrice: integer("discount_price"),
  active: boolean("active").default(true).notNull(),
${tiers.length > 0 ? `  /** Product tier: ${tiers.join(", ")} */
  tier: varchar("tier", { length: 50 }).default("${tiers[0]}"),
` : ""}${categories.length > 0 ? `  /** Product category: ${categories.join(", ")} */
  category: varchar("category", { length: 255 }),
` : ""}${generateCustomAttributeColumns(customAttrs)}  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Product Media Table
// ---------------------------------------------------------------------------

export const productMedia = pgTable("product_media", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 20 }).default("image").notNull(),
  url: text("url").notNull(),
  alt: varchar("alt", { length: 255 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Orders Table
// ---------------------------------------------------------------------------

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  /** Buyer email or user identifier */
  userId: varchar("user_id", { length: 255 }).notNull(),
  /** Quantity purchased */
  quantity: integer("quantity").default(1).notNull(),
  /** Total price in minor units */
  totalPrice: integer("total_price"),
  /** Order status */
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  /** Additional order metadata (UCP order data) */
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Checkout Sessions Table (UCP)
// ---------------------------------------------------------------------------

export const checkoutSessions = pgTable("checkout_sessions", {
  /** UCP checkout session ID (e.g., "checkout_<uuid>") */
  id: varchar("id", { length: 64 }).primaryKey(),
  status: varchar("status", { length: 30 }).default("incomplete").notNull(),
  currency: varchar("currency", { length: 3 }).default("${currency}").notNull(),
  /** Full UCP checkout response data */
  checkoutData: jsonb("checkout_data"),
  /** Linked order ID (set after completion) */
  orderId: integer("order_id").references(() => orders.id),
  /** Session expiration */
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// UCP Idempotency Keys Table
// ---------------------------------------------------------------------------

export const ucpIdempotencyKeys = pgTable("ucp_idempotency_keys", {
  key: varchar("key", { length: 128 }).primaryKey(),
  scope: varchar("scope", { length: 50 }).notNull(),
  checkoutId: varchar("checkout_id", { length: 64 }).notNull(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductMediaRecord = typeof productMedia.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type UcpIdempotencyKey = typeof ucpIdempotencyKeys.$inferSelect;
`;
}

/**
 * Generate column definitions for custom attributes.
 * Uses JSONB for array and object types, native columns for primitives.
 */
function generateCustomAttributeColumns(attrs: CustomAttribute[]): string {
  if (attrs.length === 0) return "";

  return attrs
    .map((attr) => {
      const comment = `  /** ${attr.label}${attr.description ? ": " + attr.description : ""} */\n`;
      switch (attr.type) {
        case "string":
          return `${comment}  ${camelCase(attr.key)}: text("${attr.key}"),\n`;
        case "number":
          return `${comment}  ${camelCase(attr.key)}: integer("${attr.key}"),\n`;
        case "boolean":
          return `${comment}  ${camelCase(attr.key)}: boolean("${attr.key}"),\n`;
        case "string[]":
        case "number[]":
        case "json":
          return `${comment}  ${camelCase(attr.key)}: jsonb("${attr.key}"),\n`;
        default:
          return `${comment}  ${camelCase(attr.key)}: jsonb("${attr.key}"),\n`;
      }
    })
    .join("");
}

/**
 * Generate a seed file from the product catalog.
 */
export function generateSeedSource(catalog: ProductCatalog): string {
  const products = catalog.products;
  const customAttrs = catalog.product_schema?.custom_attributes ?? [];

  const productInserts = products
    .map((p) => {
      const attrs: Record<string, string> = {
        catalogId: JSON.stringify(p.id),
        name: JSON.stringify(p.name),
        price: String(p.price),
        active: String(p.active ?? true),
      };

      if (p.short_description)
        attrs.shortDescription = JSON.stringify(p.short_description);
      if (p.description)
        attrs.description = JSON.stringify(p.description);
      if (p.discount_price != null)
        attrs.discountPrice = String(p.discount_price);
      if (p.tier) attrs.tier = JSON.stringify(p.tier);
      if (p.category) attrs.category = JSON.stringify(p.category);

      // Map custom attributes
      if (p.attributes) {
        for (const attr of customAttrs) {
          const val = p.attributes[attr.key];
          if (val !== undefined) {
            if (
              attr.type === "string[]" ||
              attr.type === "number[]" ||
              attr.type === "json"
            ) {
              attrs[camelCase(attr.key)] = JSON.stringify(val);
            } else if (attr.type === "string") {
              attrs[camelCase(attr.key)] = JSON.stringify(val);
            } else {
              attrs[camelCase(attr.key)] = String(val);
            }
          }
        }
      }

      const entries = Object.entries(attrs)
        .map(([k, v]) => `      ${k}: ${v},`)
        .join("\n");

      return `    {\n${entries}\n    }`;
    })
    .join(",\n");

  const mediaInserts = products
    .filter((p) => p.media && p.media.length > 0)
    .flatMap((p) =>
      p.media!.map(
        (m, i) =>
          `    { productId: productMap[${JSON.stringify(p.id)}], type: ${JSON.stringify(m.type)}, url: ${JSON.stringify(m.url)}, alt: ${JSON.stringify(m.alt ?? "")}, sortOrder: ${m.sort_order ?? i} }`
      )
    )
    .join(",\n");

  return `import { db } from "./index";
import { products, productMedia } from "./schema";

async function seed() {
  console.log("Seeding database...");

  // Insert products
  const inserted = await db
    .insert(products)
    .values([
${productInserts}
    ])
    .returning({ id: products.id, catalogId: products.catalogId });

  // Build a map of catalogId → DB id for media references
  const productMap: Record<string, number> = {};
  for (const row of inserted) {
    productMap[row.catalogId] = row.id;
  }

  console.log(\`Inserted \${inserted.length} products\`);
${
  mediaInserts
    ? `
  // Insert product media
  await db.insert(productMedia).values([
${mediaInserts}
  ]);

  console.log("Inserted product media");
`
    : ""
}
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
`;
}

/** Convert snake_case to camelCase */
function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
