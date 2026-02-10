import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/db";
import { products, productMedia } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { formatCurrencyDisplay } from "@/lib/currency";
import { CheckoutSessionManager } from "@/lib/ucp/checkout-session-manager";
import { generateProductDetailHtml, generateOrderConfirmationHtml } from "@/lib/mcp-ui";

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
      const result = await checkoutManager.getCheckoutSession(args.id) as Record<string, unknown>;

      // Return MCP UI for completed orders
      if (result.status === "completed" && result.order) {
        const html = generateOrderConfirmationHtml(result);
        const resourcePath = `/orders/${(result.order as Record<string, unknown>).id}`;
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
      ) as Record<string, unknown>;

      if (result.status === "completed" && result.order) {
        const html = generateOrderConfirmationHtml(result);
        const resourcePath = `/orders/${(result.order as Record<string, unknown>).id}`;
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
