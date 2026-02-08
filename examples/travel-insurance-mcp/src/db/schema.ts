import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortDescription: text("short_description"),
  description: text("description"),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  price: integer("price").notNull(), // minor units (e.g. 2999 = $29.99 USD)
  discountPrice: integer("discount_price"), // minor units, nullable
  active: boolean("active").default(true).notNull(),
  coverageHighlights: jsonb("coverage_highlights").$type<string[]>().default([]),
  regionsCovered: jsonb("regions_covered").$type<string[]>().default([]),
  durationOptions: jsonb("duration_options").$type<number[]>().default([]),
  termsUrl: text("terms_url"),
  policyPdfUrl: text("policy_pdf_url"),
  tier: varchar("tier", { length: 50 }).default("standard"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productMedia = pgTable("product_media", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  type: varchar("type", { length: 20 }).default("image").notNull(),
  url: text("url").notNull(),
  alt: varchar("alt", { length: 255 }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  duration: integer("duration").notNull(),
  travelers: integer("travelers").default(1),
  startDate: timestamp("start_date"),
  totalPrice: integer("total_price"), // minor units
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const checkoutSessions = pgTable("checkout_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: varchar("status", { length: 30 }).notNull().default("incomplete"),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  checkoutData: jsonb("checkout_data").$type<Record<string, unknown>>().notNull(),
  orderId: integer("order_id").references(() => orders.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ucpIdempotencyKeys = pgTable("ucp_idempotency_keys", {
  key: varchar("key", { length: 128 }).primaryKey(),
  scope: varchar("scope", { length: 50 }).notNull(),
  checkoutId: varchar("checkout_id", { length: 64 }).notNull(),
  response: jsonb("response").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductMedia = typeof productMedia.$inferSelect;
export type NewProductMedia = typeof productMedia.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type NewCheckoutSession = typeof checkoutSessions.$inferInsert;
export type UcpIdempotencyKey = typeof ucpIdempotencyKeys.$inferSelect;
