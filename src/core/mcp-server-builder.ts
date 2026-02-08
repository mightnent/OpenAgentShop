/**
 * MCP Server Builder
 *
 * Generates an MCP server with auto-generated tools for product discovery
 * and UCP checkout, based on the product catalog and SDK configuration.
 *
 * Auto-generated tools:
 *   - list_products: Filter and browse products
 *   - get_product: Get detailed product info
 *   - recommend_products: AI-powered recommendations
 *   - create_checkout: Start UCP checkout session
 *   - get_checkout: Retrieve checkout state
 *   - update_checkout: Update buyer/items
 *   - complete_checkout: Finalize order
 *   - cancel_checkout: Cancel checkout
 */

import type { ProductCatalog, CustomAttribute } from "../types/product-catalog";
import type { McpConfig } from "../types/config";

/**
 * Generate the MCP server source code for a shop.
 *
 * This produces a complete mcp-server.ts file that registers tools
 * tailored to the catalog's product schema.
 */
export function generateMcpServerSource(
  catalog: ProductCatalog,
  config?: McpConfig
): string {
  const shopName = catalog.shop.name;
  const serverName = config?.serverName ?? shopName;
  const serverVersion = config?.serverVersion ?? "1.0.0";
  const uiMode = config?.uiMode ?? "both";
  const tiers = catalog.product_schema?.tiers ?? [];
  const categories = catalog.product_schema?.categories ?? [];
  const filterableAttrs = (
    catalog.product_schema?.custom_attributes ?? []
  ).filter((a) => a.filterable);

  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
    name: ${JSON.stringify(serverName)},
    version: ${JSON.stringify(serverVersion)},
  });

  // -----------------------------------------------------------------------
  // UI Resource Template (MCP Apps mode)
  // -----------------------------------------------------------------------
${uiMode !== "classic" ? `
  server.resource(
    "ui-resource",
    "ui://${slugify(shopName)}/{path}",
    { description: "MCP-UI resources for ${shopName}", mimeType: "text/html;profile=mcp-app" },
    async (uri) => {
      const path = uri.pathname;
      const html = mcpAppsResources.get(path);
      if (!html) {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: "Resource not found" }] };
      }
      return { contents: [{ uri: uri.href, mimeType: "text/html", text: html }] };
    }
  );
` : ""}

  // -----------------------------------------------------------------------
  // Product Discovery Tools
  // -----------------------------------------------------------------------

  server.tool(
    "list_products",
    "List and filter ${shopName} products",
    {
      keyword: z.string().optional().describe("Search keyword for name/description"),
${tiers.length > 0 ? `      tier: z.enum([${tiers.map((t) => `"${t}"`).join(", ")}]).optional().describe("Filter by product tier"),\n` : ""}${categories.length > 0 ? `      category: z.enum([${categories.map((c) => `"${c}"`).join(", ")}]).optional().describe("Filter by category"),\n` : ""}${filterableAttrs.map((a) => `      ${a.key}: z.string().optional().describe("Filter by ${a.label}"),\n`).join("")}      activeOnly: z.boolean().optional().default(true).describe("Only show active products"),
      limit: z.number().int().min(1).max(50).optional().default(5).describe("Max number of products to return (default 5)"),
      offset: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
    },
    async (args) => {
      const conditions = [];
      if (args.activeOnly) conditions.push(eq(products.active, true));
      if (args.keyword) {
        conditions.push(
          sql\`(\${products.name} ILIKE \${"%" + args.keyword + "%"} OR \${products.description} ILIKE \${"%" + args.keyword + "%"})\`
        );
      }
${tiers.length > 0 ? `      if (args.tier) conditions.push(eq(products.tier, args.tier));\n` : ""}${categories.length > 0 ? `      if (args.category) conditions.push(eq(products.category, args.category));\n` : ""}
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
            ? \`~~\${formatCurrencyDisplay(p.price, p.currency)}~~ \${formatCurrencyDisplay(p.discountPrice, p.currency)}\`
            : formatCurrencyDisplay(p.price, p.currency);
          return \`\${p.id}. **\${p.name}** (\${price}): \${p.shortDescription || ""}\`;
        })
        .join("\\n");

      const html = generateProductListHtml(productsWithMedia);
      const resourcePath = "/products/list";
      mcpAppsResources.set(resourcePath, html);

      return {
        content: [
          { type: "text", text: \`Showing \${result.length} products:\\n\\n\${textSummary}\` },
          { type: "resource", resource: { uri: \`ui://${slugify(shopName)}\${resourcePath}\`, mimeType: "text/html", text: html } },
        ],
        _meta: { ui: { resourceUri: \`ui://${slugify(shopName)}\${resourcePath}\` } },
      };
    }
  );

  server.tool(
    "get_product",
    "Get detailed information about a specific ${shopName} product",
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
        ? \`~~\${formatCurrencyDisplay(p.price, p.currency)}~~ \${formatCurrencyDisplay(p.discountPrice, p.currency)}\`
        : formatCurrencyDisplay(p.price, p.currency);

      const text = [
        \`## \${p.name}\`,
        \`**Price:** \${price}\`,
        p.description || "",
      ].join("\\n\\n");

      const html = generateProductDetailHtml(p, media);
      const resourcePath = \`/products/\${p.id}\`;
      mcpAppsResources.set(resourcePath, html);

      return {
        content: [
          { type: "text", text },
          { type: "resource", resource: { uri: \`ui://${slugify(shopName)}\${resourcePath}\`, mimeType: "text/html", text: html } },
        ],
        _meta: { ui: { resourceUri: \`ui://${slugify(shopName)}\${resourcePath}\` } },
      };
    }
  );

  server.tool(
    "recommend_products",
    "Get product recommendations based on preferences",
    {
      budget: z.number().optional().describe("Maximum budget in major currency units (e.g., 100 for $100)"),
${tiers.length > 0 ? `      preferredTier: z.enum([${tiers.map((t) => `"${t}"`).join(", ")}]).optional().describe("Preferred tier"),\n` : ""}      keyword: z.string().optional().describe("What the customer is looking for"),
      limit: z.number().int().min(1).max(20).optional().default(5).describe("Max number of recommendations to return (default 5)"),
    },
    async (args) => {
      const conditions = [eq(products.active, true)];

      if (args.budget) {
        const budgetMinor = args.budget * 100;
        conditions.push(sql\`COALESCE(\${products.discountPrice}, \${products.price}) <= \${budgetMinor}\`);
      }
${tiers.length > 0 ? `      if (args.preferredTier) conditions.push(eq(products.tier, args.preferredTier));\n` : ""}
      const result = await db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(products.price)
        .limit(args.limit);

      const textSummary = result
        .map((p, i) => {
          const price = formatCurrencyDisplay(p.discountPrice ?? p.price, p.currency);
          return \`\${i + 1}. **\${p.name}** (\${price}) - \${p.shortDescription || ""}\`;
        })
        .join("\\n");

      const html = generateRecommendationsHtml(result);
      const resourcePath = "/products/recommendations";
      mcpAppsResources.set(resourcePath, html);

      return {
        content: [
          { type: "text", text: \`Top \${result.length} recommendations:\\n\\n\${textSummary}\` },
          { type: "resource", resource: { uri: \`ui://${slugify(shopName)}\${resourcePath}\`, mimeType: "text/html", text: html } },
        ],
        _meta: { ui: { resourceUri: \`ui://${slugify(shopName)}\${resourcePath}\` } },
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
    "Retrieve the current state of a checkout session",
    {
      meta: z.object({
        "ucp-agent": z.object({ profile: z.string().optional() }).optional(),
        "idempotency-key": z.string().optional(),
      }).optional().describe("UCP agent metadata"),
      id: z.string().describe("Checkout session ID"),
    },
    async (args) => {
      const result = await checkoutManager.getCheckoutSession(args.id);
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
        const resourcePath = \`/orders/\${result.order.id}\`;
        mcpAppsResources.set(resourcePath, html);

        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
            { type: "resource", resource: { uri: \`ui://${slugify(shopName)}\${resourcePath}\`, mimeType: "text/html", text: html } },
          ],
          _meta: { ui: { resourceUri: \`ui://${slugify(shopName)}\${resourcePath}\` } },
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
`;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
