import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/db";
import { products, productMedia } from "@/db/schema";
import { eq, and, ilike, sql, inArray } from "drizzle-orm";
import { formatCurrencyDisplay } from "@/lib/currency";
import { CheckoutSessionManager } from "@/lib/ucp/checkout-session-manager";
import { generateProductListHtml, generateProductDetailHtml, generateRecommendationsHtml, generateOrderConfirmationHtml } from "@/lib/mcp-ui";

// In-memory store for MCP App resources (per-session)
const mcpAppsResources = new Map<string, string>();

export function createMcpServer({ baseUrl }: { baseUrl: string }) {
  const checkoutManager = new CheckoutSessionManager({ baseUrl });
  const server = new McpServer({
    name: "Singtel Bill Payment",
    version: "1.0.0",
  });

  // -----------------------------------------------------------------------
  // UI Resource Template (MCP Apps mode)
  // -----------------------------------------------------------------------

  server.resource(
    "ui-resource",
    "ui://singtel-bill-payment/{path}",
    { description: "MCP-UI resources for Singtel Bill Payment", mimeType: "text/html;profile=mcp-app" },
    async (uri) => {
      const path = uri.pathname;
      const html = mcpAppsResources.get(path);
      if (!html) {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: "Resource not found" }] };
      }
      return { contents: [{ uri: uri.href, mimeType: "text/html", text: html }] };
    }
  );


  // -----------------------------------------------------------------------
  // Singtel Bill Lookup Tool
  // -----------------------------------------------------------------------

  server.tool(
    "lookup_bill_by_phone",
    "Look up a Singtel bill by phone number (account number)",
    {
      phoneNumber: z.string().describe("The phone number to look up (e.g., 81132253)"),
    },
    async (args) => {
      const result = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.active, true),
            eq(products.accountNumber, args.phoneNumber)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No bill found for phone number ${args.phoneNumber}. Please check the number and try again.`
          }]
        };
      }

      const p = result[0];
      const media = await db
        .select()
        .from(productMedia)
        .where(eq(productMedia.productId, p.id))
        .orderBy(productMedia.sortOrder);

      const price = p.discountPrice
        ? `~~${formatCurrencyDisplay(p.price, p.currency)}~~ ${formatCurrencyDisplay(p.discountPrice, p.currency)}`
        : formatCurrencyDisplay(p.price, p.currency);

      const overdueText = p.overdue ? " ⚠️ OVERDUE" : "";
      const text = [
        `## ${p.name}${overdueText}`,
        `**Amount Due:** ${price}`,
        `**Due Date:** ${p.dueDate}`,
        `**Plan Type:** ${p.planType}`,
        `**Billing Period:** ${p.billingPeriod}`,
        `**Data Usage:** ${p.dataUsage}`,
        p.description || "",
      ].join("\n\n");

      const html = generateProductDetailHtml(p, media);
      const resourcePath = `/bill/${args.phoneNumber}`;
      mcpAppsResources.set(resourcePath, html);

      return {
        content: [
          { type: "text", text },
          { type: "resource", resource: { uri: `ui://singtel-bill-payment${resourcePath}`, mimeType: "text/html", text: html } },
        ],
        _meta: { ui: { resourceUri: `ui://singtel-bill-payment${resourcePath}` } },
      };
    }
  );

  // -----------------------------------------------------------------------
  // Product Discovery Tools
  // -----------------------------------------------------------------------

  server.tool(
    "list_products",
    "List and filter Singtel Bill Payment products",
    {
      keyword: z.string().optional().describe("Search keyword for name/description"),
      tier: z.enum(["prepaid", "postpaid"]).optional().describe("Filter by product tier"),
      category: z.enum(["Mobile Bill", "Broadband Bill", "TV Bill"]).optional().describe("Filter by category"),
      plan_type: z.string().optional().describe("Filter by Plan Type"),
      overdue: z.string().optional().describe("Filter by Overdue"),
      activeOnly: z.boolean().optional().default(true).describe("Only show active products"),
      limit: z.number().int().min(1).max(50).optional().default(5).describe("Max number of products to return (default 5)"),
      offset: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
    },
    async (args) => {
      const conditions = [];
      if (args.activeOnly) conditions.push(eq(products.active, true));
      if (args.keyword) {
        conditions.push(
          sql`(${products.name} ILIKE ${"%" + args.keyword + "%"} OR ${products.description} ILIKE ${"%" + args.keyword + "%"})`
        );
      }
      if (args.tier) conditions.push(eq(products.tier, args.tier));
      if (args.category) conditions.push(eq(products.category, args.category));

      const result = await db
        .select()
        .from(products)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(products.price)
        .limit(args.limit)
        .offset(args.offset);

      // Fetch media for all products
      const mediaMap = new Map<number, { url: string; alt: string | null }[]>();
      if (result.length > 0) {
        const mediaRows = await db
          .select({ productId: productMedia.productId, url: productMedia.url, alt: productMedia.alt, sortOrder: productMedia.sortOrder })
          .from(productMedia)
          .where(inArray(productMedia.productId, result.map((p) => p.id)))
          .orderBy(productMedia.productId, productMedia.sortOrder);

        for (const m of mediaRows) {
          const list = mediaMap.get(m.productId) || [];
          list.push({ url: m.url, alt: m.alt });
          mediaMap.set(m.productId, list);
        }
      }

      const productsWithMedia = result.map((p) => ({ ...p, media: mediaMap.get(p.id) || [] }));

      const textSummary = productsWithMedia
        .map((p) => {
          const price = p.discountPrice
            ? `~~${formatCurrencyDisplay(p.price, p.currency)}~~ ${formatCurrencyDisplay(p.discountPrice, p.currency)}`
            : formatCurrencyDisplay(p.price, p.currency);
          return `${p.id}. **${p.name}** (${price}): ${p.shortDescription || ""}`;
        })
        .join("\n");

      const html = generateProductListHtml(productsWithMedia);
      const resourcePath = "/products/list";
      mcpAppsResources.set(resourcePath, html);

      return {
        content: [
          { type: "text", text: `Showing ${result.length} products:\n\n${textSummary}` },
          { type: "resource", resource: { uri: `ui://singtel-bill-payment${resourcePath}`, mimeType: "text/html", text: html } },
        ],
        _meta: { ui: { resourceUri: `ui://singtel-bill-payment${resourcePath}` } },
      };
    }
  );

  server.tool(
    "get_product",
    "Get detailed information about a specific Singtel Bill Payment product",
    {
      productId: z.number().describe("The product ID"),
    },
    async (args) => {
      const result = await db
        .select()
        .from(products)
        .where(eq(products.id, args.productId))
        .limit(1);

      if (result.length === 0) {
        return { content: [{ type: "text", text: "Product not found." }] };
      }

      const p = result[0];
      const media = await db
        .select()
        .from(productMedia)
        .where(eq(productMedia.productId, p.id))
        .orderBy(productMedia.sortOrder);

      const price = p.discountPrice
        ? `~~${formatCurrencyDisplay(p.price, p.currency)}~~ ${formatCurrencyDisplay(p.discountPrice, p.currency)}`
        : formatCurrencyDisplay(p.price, p.currency);

      const text = [
        `## ${p.name}`,
        `**Price:** ${price}`,
        p.description || "",
      ].join("\n\n");

      const html = generateProductDetailHtml(p, media);
      const resourcePath = `/products/${p.id}`;
      mcpAppsResources.set(resourcePath, html);

      return {
        content: [
          { type: "text", text },
          { type: "resource", resource: { uri: `ui://singtel-bill-payment${resourcePath}`, mimeType: "text/html", text: html } },
        ],
        _meta: { ui: { resourceUri: `ui://singtel-bill-payment${resourcePath}` } },
      };
    }
  );

  server.tool(
    "recommend_products",
    "Get product recommendations based on preferences",
    {
      budget: z.number().optional().describe("Maximum budget in major currency units (e.g., 100 for $100)"),
      preferredTier: z.enum(["prepaid", "postpaid"]).optional().describe("Preferred tier"),
      keyword: z.string().optional().describe("What the customer is looking for"),
      limit: z.number().int().min(1).max(20).optional().default(5).describe("Max number of recommendations to return (default 5)"),
    },
    async (args) => {
      const conditions = [eq(products.active, true)];

      if (args.budget) {
        const budgetMinor = args.budget * 100;
        conditions.push(sql`COALESCE(${products.discountPrice}, ${products.price}) <= ${budgetMinor}`);
      }
      if (args.preferredTier) conditions.push(eq(products.tier, args.preferredTier));

      const result = await db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(products.price)
        .limit(args.limit);

      const textSummary = result
        .map((p, i) => {
          const price = formatCurrencyDisplay(p.discountPrice ?? p.price, p.currency);
          return `${i + 1}. **${p.name}** (${price}) - ${p.shortDescription || ""}`;
        })
        .join("\n");

      const html = generateRecommendationsHtml(result);
      const resourcePath = "/products/recommendations";
      mcpAppsResources.set(resourcePath, html);

      return {
        content: [
          { type: "text", text: `Top ${result.length} recommendations:\n\n${textSummary}` },
          { type: "resource", resource: { uri: `ui://singtel-bill-payment${resourcePath}`, mimeType: "text/html", text: html } },
        ],
        _meta: { ui: { resourceUri: `ui://singtel-bill-payment${resourcePath}` } },
      };
    }
  );

  // -----------------------------------------------------------------------
  // UCP Checkout Tools
  // -----------------------------------------------------------------------

  server.tool(
    "create_checkout",
    "Create a new UCP checkout session",
    {
      meta: z.object({
        "ucp-agent": z.object({ profile: z.string().optional() }).optional(),
        "idempotency-key": z.string().optional(),
      }).optional().describe("UCP agent metadata"),
      checkout: z.object({
        buyer: z.object({
          email: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          phone: z.string().optional(),
        }).optional(),
        line_items: z.array(
          z.object({
            item: z.object({ id: z.string() }),
            quantity: z.number().default(1),
          })
        ),
      }),
    },
    async (args) => {
      const result = await checkoutManager.createCheckoutSession(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_checkout",
    "Retrieve the current state of a checkout session. Returns order confirmation UI when checkout is completed.",
    {
      meta: z.object({
        "ucp-agent": z.object({ profile: z.string().optional() }).optional(),
        "idempotency-key": z.string().optional(),
      }).optional().describe("UCP agent metadata"),
      id: z.string().describe("Checkout session ID"),
    },
    async (args) => {
      const result = await checkoutManager.getCheckoutSession(args.id);

      // Return MCP UI for completed orders
      if (result.status === "completed" && result.order) {
        const html = generateOrderConfirmationHtml(result);
        const resourcePath = `/orders/${result.order.id}`;
        mcpAppsResources.set(resourcePath, html);

        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
            { type: "resource", resource: { uri: `ui://singtel-bill-payment${resourcePath}`, mimeType: "text/html", text: html } },
          ],
          _meta: { ui: { resourceUri: `ui://singtel-bill-payment${resourcePath}` } },
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_checkout",
    "Update buyer info or line items on a checkout session",
    {
      meta: z.object({
        "ucp-agent": z.object({ profile: z.string().optional() }).optional(),
        "idempotency-key": z.string().optional(),
      }).optional().describe("UCP agent metadata"),
      id: z.string().describe("Checkout session ID"),
      checkout: z.object({
        buyer: z.object({
          email: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          phone: z.string().optional(),
        }).optional(),
        line_items: z.array(
          z.object({
            item: z.object({ id: z.string() }),
            quantity: z.number().default(1),
          })
        ).optional(),
      }),
    },
    async (args) => {
      const result = await checkoutManager.updateCheckoutSession(args.id, args.checkout);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "complete_checkout",
    "Complete a checkout session and place the order",
    {
      meta: z.object({
        "ucp-agent": z.object({ profile: z.string().optional() }).optional(),
        "idempotency-key": z.string().optional(),
      }).optional().describe("UCP agent metadata"),
      id: z.string().describe("Checkout session ID"),
      checkout: z.object({
        payment: z.object({
          instruments: z.array(z.record(z.unknown())).optional(),
        }).optional(),
        risk_signals: z.record(z.unknown()).optional(),
      }).optional(),
      idempotency_key: z.string().optional().describe("Idempotency key for safe retries"),
    },
    async (args) => {
      const result = await checkoutManager.completeCheckoutSession(
        args.id,
        args.checkout ?? {},
        args.idempotency_key
      );

      if (result.status === "completed" && result.order) {
        const html = generateOrderConfirmationHtml(result);
        const resourcePath = `/orders/${result.order.id}`;
        mcpAppsResources.set(resourcePath, html);

        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
            { type: "resource", resource: { uri: `ui://singtel-bill-payment${resourcePath}`, mimeType: "text/html", text: html } },
          ],
          _meta: { ui: { resourceUri: `ui://singtel-bill-payment${resourcePath}` } },
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "cancel_checkout",
    "Cancel a checkout session",
    {
      meta: z.object({
        "ucp-agent": z.object({ profile: z.string().optional() }).optional(),
        "idempotency-key": z.string().optional(),
      }).optional().describe("UCP agent metadata"),
      id: z.string().describe("Checkout session ID"),
      idempotency_key: z.string().optional().describe("Idempotency key for safe retries"),
    },
    async (args) => {
      const result = await checkoutManager.cancelCheckoutSession(args.id, args.idempotency_key);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
