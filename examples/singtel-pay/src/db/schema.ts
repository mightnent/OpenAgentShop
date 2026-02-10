import {
  sqliteTable,
  integer,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Products Table
// ---------------------------------------------------------------------------

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** External catalog ID (slug) */
  catalogId: text("catalog_id").notNull().unique(),
  name: text("name").notNull(),
  shortDescription: text("short_description"),
  description: text("description"),
  /** ISO 4217 currency code */
  currency: text("currency").default("SGD").notNull(),
  /** Price in minor units (e.g., 2999 = $29.99) */
  price: integer("price").notNull(),
  /** Discount price in minor units (null = no discount) */
  discountPrice: integer("discount_price"),
  active: integer("active", { mode: "boolean" }).default(1).notNull(),
  /** Product tier: prepaid, postpaid */
  tier: text("tier").default("prepaid"),
  /** Product category: Mobile Bill, Broadband Bill, TV Bill */
  category: text("category"),
  /** Account Number */
  accountNumber: text("account_number"),
  /** Bill Amount */
  billAmount: integer("bill_amount"),
  /** Due Date */
  dueDate: text("due_date"),
  /** Billing Period */
  billingPeriod: text("billing_period"),
  /** Plan Type */
  planType: text("plan_type"),
  /** Data Usage */
  dataUsage: text("data_usage"),
  /** Overdue */
  overdue: integer("overdue", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// ---------------------------------------------------------------------------
// Product Media Table
// ---------------------------------------------------------------------------

export const productMedia = sqliteTable("product_media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").default("image").notNull(),
  url: text("url").notNull(),
  alt: text("alt"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// ---------------------------------------------------------------------------
// Orders Table
// ---------------------------------------------------------------------------

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  /** Buyer email or user identifier */
  userId: text("user_id").notNull(),
  /** Quantity purchased */
  quantity: integer("quantity").default(1).notNull(),
  /** Total price in minor units */
  totalPrice: integer("total_price"),
  /** Order status */
  status: text("status").default("pending").notNull(),
  /** Additional order metadata (UCP order data) */
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// ---------------------------------------------------------------------------
// Checkout Sessions Table (UCP)
// ---------------------------------------------------------------------------

export const checkoutSessions = sqliteTable("checkout_sessions", {
  /** UCP checkout session ID (e.g., "checkout_<uuid>") */
  id: text("id").primaryKey(),
  status: text("status").default("incomplete").notNull(),
  currency: text("currency").default("SGD").notNull(),
  /** Full UCP checkout response data */
  checkoutData: text("checkout_data", { mode: "json" }),
  /** Linked order ID (set after completion) */
  orderId: integer("order_id").references(() => orders.id),
  /** Session expiration */
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// ---------------------------------------------------------------------------
// UCP Idempotency Keys Table
// ---------------------------------------------------------------------------

export const ucpIdempotencyKeys = sqliteTable("ucp_idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  checkoutId: text("checkout_id").notNull(),
  response: text("response", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
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
