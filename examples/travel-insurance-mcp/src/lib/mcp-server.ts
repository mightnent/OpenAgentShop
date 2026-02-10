import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createUIResource } from "@mcp-ui/server";
import { z } from "zod";
import { db } from "@/db";
import { products, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatCurrencyDisplay } from "@/lib/currency";
import {
  createCheckoutSession,
  getCheckoutSession,
  updateCheckoutSession,
  completeCheckoutSession,
  cancelCheckoutSession,
} from "@/lib/ucp/checkout-session-manager";

// Store registered MCP Apps resources for resources/read
const mcpAppsResources = new Map<string, { mimeType: string; text: string }>();

export function getMcpAppsResource(uri: string) {
  return mcpAppsResources.get(uri);
}

export function listMcpAppsResources() {
  return Array.from(mcpAppsResources.keys()).map((uri) => ({
    uri,
    name: uri.replace("ui://travel-insurance/", ""),
    mimeType: "text/html;profile=mcp-app",
  }));
}

export function createMcpServer() {
  const server = new McpServer({
    name: "travel-insurance-mcp",
    version: "1.0.0",
  });

  server.tool(
    "list_products",
    "List travel insurance products. Filter by tier (budget/standard/premium), region, or search by keyword.",
    {
      tier: z.string().optional().describe("Filter by tier: budget, standard, or premium"),
      region: z.string().optional().describe("Filter by region coverage (e.g., 'Asia', 'Worldwide')"),
      keyword: z.string().optional().describe("Search in product name or description"),
      activeOnly: z.boolean().optional().describe("Only show active products (default: true)"),
    },
    async ({ tier, region, keyword, activeOnly = true }) => {
      let allProducts = await db.select().from(products);
      if (activeOnly) {
        allProducts = allProducts.filter((p) => p.active);
      }
      if (tier) {
        allProducts = allProducts.filter((p) => p.tier?.toLowerCase() === tier.toLowerCase());
      }
      if (region) {
        allProducts = allProducts.filter((p) =>
          ((p.regionsCovered as string[]) || []).some((r) =>
            r.toLowerCase().includes(region.toLowerCase())
          )
        );
      }
      if (keyword) {
        const kw = keyword.toLowerCase();
        allProducts = allProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(kw) ||
            p.shortDescription?.toLowerCase().includes(kw) ||
            p.description?.toLowerCase().includes(kw)
        );
      }

      const displayProducts = allProducts.slice(0, 5);

      // Build structured text response with product IDs for LLM context
      const productListText = displayProducts.length > 0
        ? displayProducts.map((p, i) => {
            const price = p.discountPrice ?? p.price;
            return `${i + 1}. [ID: ${p.id}] ${p.name} - ${formatCurrencyDisplay(price, p.currency)} (${p.tier} tier)`;
          }).join('\n')
        : 'No products found.';
      const textSummary = `Found ${allProducts.length} travel insurance product(s):\n${productListText}\n\nTo select a product, use get_product with the product ID, or create_checkout with the product ID.`;

      const htmlContent = generateProductListHtml(displayProducts, allProducts.length);
      const resourceUri = `ui://travel-insurance/products/list-${Date.now()}` as const;

      // MCP Apps resource (with adapter) - register for MCP Apps hosts to fetch
      const mcpAppsResource = createUIResource({
        uri: resourceUri,
        content: { type: "rawHtml", htmlString: htmlContent },
        encoding: "text",
        adapters: {
          mcpApps: { enabled: true },
        },
      });
      mcpAppsResources.set(resourceUri, {
        mimeType: mcpAppsResource.resource.mimeType,
        text: mcpAppsResource.resource.text || "",
      });

      // Classic MCP-UI resource (no adapter) - embed in tool result for legacy hosts
      const classicResource = createUIResource({
        uri: resourceUri as `ui://${string}`,
        content: { type: "rawHtml", htmlString: htmlContent },
        encoding: "text",
      });

      return {
        content: [
          { type: "text", text: textSummary },
          classicResource,
        ],
        _meta: {
          ui: {
            resourceUri,
          },
        },
      };
    }
  );

  server.tool(
    "get_product",
    "Get detailed information about a specific travel insurance product including coverage highlights, pricing, and available durations.",
    {
      productId: z.number().describe("The ID of the product"),
    },
    async ({ productId }) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId));

      if (!product) {
        return {
          content: [{ type: "text", text: "Product not found." }],
          isError: true,
        };
      }

      const durations = (product.durationOptions as number[]) || [];
      const regions = (product.regionsCovered as string[]) || [];
      const highlights = (product.coverageHighlights as string[]) || [];

      const htmlContent = generateProductDetailHtml(product, durations, regions, highlights);
      const resourceUri = `ui://travel-insurance/product/${productId}` as const;

      // MCP Apps resource (with adapter) - register for MCP Apps hosts to fetch
      const mcpAppsResource = createUIResource({
        uri: resourceUri,
        content: { type: "rawHtml", htmlString: htmlContent },
        encoding: "text",
        adapters: {
          mcpApps: { enabled: true },
        },
      });
      mcpAppsResources.set(resourceUri, {
        mimeType: mcpAppsResource.resource.mimeType,
        text: mcpAppsResource.resource.text || "",
      });

      // Classic MCP-UI resource (no adapter) - embed in tool result for legacy hosts
      const classicResource = createUIResource({
        uri: resourceUri as `ui://${string}`,
        content: { type: "rawHtml", htmlString: htmlContent },
        encoding: "text",
      });

      // Build detailed text response with product ID for LLM context
      const price = product.discountPrice ?? product.price;
      const textSummary = `Product Details [ID: ${product.id}]:
- Name: ${product.name}
- Tier: ${product.tier}
- Price: ${formatCurrencyDisplay(price, product.currency)}${product.discountPrice ? ` (was ${formatCurrencyDisplay(product.price, product.currency)})` : ''}
- Regions: ${regions.join(', ')}
- Duration options: ${durations.map(d => `${d} days`).join(', ')}
- Coverage highlights: ${highlights.join(', ')}

To purchase this product, use create_checkout with product ID ${product.id}.`;

      return {
        content: [
          { type: "text", text: textSummary },
          classicResource,
        ],
        _meta: {
          ui: {
            resourceUri,
          },
        },
      };
    }
  );

  server.tool(
    "recommend_products",
    "Get personalized product recommendations based on travel needs like destination, duration, and budget preference.",
    {
      destination: z.string().optional().describe("Travel destination (e.g., 'Japan', 'Europe', 'USA')"),
      duration: z.number().optional().describe("Trip duration in days"),
      budget: z.string().optional().describe("Budget preference: low, medium, or high"),
      travelers: z.number().optional().describe("Number of travelers"),
    },
    async ({ destination, duration, budget }) => {
      let allProducts = await db.select().from(products).where(eq(products.active, true));

      if (budget) {
        const tierMap: Record<string, string> = { low: "budget", medium: "standard", high: "premium" };
        const targetTier = tierMap[budget.toLowerCase()];
        if (targetTier) {
          allProducts = allProducts.filter((p) => p.tier === targetTier);
        }
      }

      if (destination) {
        const dest = destination.toLowerCase();
        allProducts = allProducts.filter((p) => {
          const regions = (p.regionsCovered as string[]) || [];
          return regions.some(
            (r) =>
              r.toLowerCase().includes(dest) ||
              r.toLowerCase() === "worldwide" ||
              (dest.includes("asia") && r.toLowerCase().includes("asia")) ||
              (dest.includes("europe") && r.toLowerCase().includes("europe"))
          );
        });
      }

      if (duration) {
        allProducts = allProducts.filter((p) => {
          const durations = (p.durationOptions as number[]) || [];
          return durations.some((d) => d >= duration);
        });
      }

      allProducts.sort((a, b) => {
        const priceA = a.discountPrice ?? a.price;
        const priceB = b.discountPrice ?? b.price;
        return priceA - priceB;
      });

      const recommendations = allProducts.slice(0, 5);

      // Build structured text response with product IDs for LLM context
      const productListText = recommendations.length > 0
        ? recommendations.map((p, i) => {
            const price = p.discountPrice ?? p.price;
            const bestMatch = i === 0 ? ' ⭐ Best Match' : '';
            return `${i + 1}. [ID: ${p.id}] ${p.name} - ${formatCurrencyDisplay(price, p.currency)} (${p.tier} tier)${bestMatch}`;
          }).join('\n')
        : 'No matching products found.';
      const contextInfo = [destination ? `destination: ${destination}` : null, duration ? `duration: ${duration} days` : null].filter(Boolean).join(', ');
      const textSummary = `Found ${recommendations.length} recommended product(s)${contextInfo ? ` for ${contextInfo}` : ''}:\n${productListText}\n\nTo select a product, use get_product with the product ID, or create_checkout with the product ID.`;

      const htmlContent = generateRecommendationsHtml(recommendations, destination, duration);
      const resourceUri = `ui://travel-insurance/products/recommend-${Date.now()}` as const;

      // MCP Apps resource (with adapter) - register for MCP Apps hosts to fetch
      const mcpAppsResource = createUIResource({
        uri: resourceUri,
        content: { type: "rawHtml", htmlString: htmlContent },
        encoding: "text",
        adapters: {
          mcpApps: { enabled: true },
        },
      });
      mcpAppsResources.set(resourceUri, {
        mimeType: mcpAppsResource.resource.mimeType,
        text: mcpAppsResource.resource.text || "",
      });

      // Classic MCP-UI resource (no adapter) - embed in tool result for legacy hosts
      const classicResource = createUIResource({
        uri: resourceUri as `ui://${string}`,
        content: { type: "rawHtml", htmlString: htmlContent },
        encoding: "text",
      });

      return {
        content: [
          { type: "text", text: textSummary },
          classicResource,
        ],
        _meta: {
          ui: {
            resourceUri,
          },
        },
      };
    }
  );

  if (process.env.ENABLE_LEGACY_ORDER_INTENT === "true") {
    server.tool(
      "create_order_intent",
      "Create a purchase order intent for a travel insurance product. Returns an order summary for confirmation.",
      {
        productId: z.number().describe("The product ID to purchase"),
        duration: z.number().describe("Coverage duration in days"),
        travelers: z.number().optional().describe("Number of travelers (default: 1)"),
        startDate: z.string().optional().describe("Coverage start date (ISO format)"),
        userId: z.string().optional().describe("User ID for the order"),
      },
      async ({ productId, duration, travelers = 1, startDate, userId }) => {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, productId));

        if (!product) {
          return {
            content: [{ type: "text", text: "Product not found." }],
            isError: true,
          };
        }

        const basePrice = product.discountPrice ?? product.price;
        const totalPrice = basePrice * travelers;
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

        const [order] = await db
          .insert(orders)
          .values({
            productId,
            userId: userId || "anonymous",
            duration,
            travelers,
            startDate: start,
            totalPrice,
            status: "confirmed",
          })
          .returning();

        const htmlContent = generateOrderConfirmationHtml(order, product, duration, start, end, travelers, totalPrice);
        const resourceUri = `ui://travel-insurance/order/${order.id}` as const;

        const mcpAppsResource = createUIResource({
          uri: resourceUri,
          content: { type: "rawHtml", htmlString: htmlContent },
          encoding: "text",
          adapters: {
            mcpApps: { enabled: true },
          },
        });
        mcpAppsResources.set(resourceUri, {
          mimeType: mcpAppsResource.resource.mimeType,
          text: mcpAppsResource.resource.text || "",
        });

        const classicResource = createUIResource({
          uri: resourceUri as `ui://${string}`,
          content: { type: "rawHtml", htmlString: htmlContent },
          encoding: "text",
        });

        return {
          content: [
            { type: "text", text: `Order confirmed! ID: ${order.id}, Plan: ${product.name}, Total: ${formatCurrencyDisplay(totalPrice, product.currency)}` },
            classicResource,
          ],
          _meta: {
            ui: {
              resourceUri,
            },
          },
        };
      }
    );
  }

  // ── UCP Checkout Tools (per UCP MCP Binding v2026-01-11) ──────────────

  const ucpAgentSchema = z.object({
    "ucp-agent": z.object({
      profile: z.string().describe("Platform profile URI"),
    }),
    "idempotency-key": z.string().optional().describe("UUID for retry safety"),
  });
  const ucpStrict = process.env.UCP_STRICT === "true";

  server.tool(
    "create_checkout",
    "UCP: Create a new checkout session. Provide line_items with item IDs referencing product IDs, and optionally buyer info.",
    {
      meta: ucpAgentSchema,
      checkout: z.object({
        buyer: z.object({
          email: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        }).optional().describe("Buyer contact information"),
        line_items: z.array(z.object({
          item: z.object({
            id: z.string().describe("Product ID"),
          }),
          quantity: z.number().default(1),
        })).describe("Items to purchase"),
        currency: z.string().default("USD").optional(),
        payment: z
          .object({
            instruments: z.array(z.unknown()).optional(),
          })
          .optional(),
      }),
    },
    async ({ meta, checkout }) => {
      try {
        if (ucpStrict && (!checkout.line_items || checkout.line_items.length === 0)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "line_items is required" }) }],
            isError: true,
          };
        }
        const result = await createCheckoutSession(checkout);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "create_checkout failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_checkout",
    "UCP: Get the current state of a checkout session by ID.",
    {
      meta: ucpAgentSchema,
      id: z.string().describe("Checkout session ID"),
    },
    async ({ id }) => {
      const result = await getCheckoutSession(id);
      if (!result) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Checkout session not found", id }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "update_checkout",
    "UCP: Update a checkout session (full replacement). Send buyer info and/or updated line_items.",
    {
      meta: ucpAgentSchema,
      id: z.string().describe("Checkout session ID"),
      checkout: z.object({
        buyer: z.object({
          email: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        }).optional(),
        line_items: z.array(z.object({
          item: z.object({
            id: z.string(),
          }),
          quantity: z.number().default(1),
        })).optional(),
        currency: z.string().optional(),
        payment: z
          .object({
            instruments: z.array(z.unknown()).optional(),
          })
          .optional(),
      }),
    },
    async ({ id, checkout }) => {
      try {
        if (ucpStrict && (!checkout.line_items || checkout.line_items.length === 0)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "line_items is required for update_checkout" }) }],
            isError: true,
          };
        }
        const result = await updateCheckoutSession(id, checkout);
        if (!result) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Checkout session not found", id }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "update_checkout failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "complete_checkout",
    "UCP: Finalize checkout and place the order. Requires meta.idempotency-key.",
    {
      meta: z.object({
        "ucp-agent": z.object({
          profile: z.string(),
        }),
        "idempotency-key": z.string().optional().describe("UUID for retry safety (required)"),
      }),
      id: z.string().describe("Checkout session ID"),
      checkout: z.object({
        payment: z.object({
          instruments: z.array(z.unknown()).optional(),
        }).optional(),
      }).optional(),
      idempotency_key: z.string().optional().describe("UUID for retry safety (UCP OpenRPC param)"),
    },
    async ({ meta, id, checkout, idempotency_key }) => {
      const metaKey = meta["idempotency-key"];
      const resolvedKey = idempotency_key || metaKey || "";
      if (metaKey && idempotency_key && metaKey !== idempotency_key) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "idempotency_key mismatch", id }) }],
          isError: true,
        };
      }
      if (!resolvedKey) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "idempotency_key is required", id }) }],
          isError: true,
        };
      }
      try {
        const result = await completeCheckoutSession(
          id,
          (checkout as Record<string, unknown>) || {},
          resolvedKey
        );
        if (!result) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Checkout session not found", id }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "complete_checkout failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "cancel_checkout",
    "UCP: Cancel a checkout session. Requires meta.idempotency-key.",
    {
      meta: z.object({
        "ucp-agent": z.object({
          profile: z.string(),
        }),
        "idempotency-key": z.string().optional().describe("UUID for retry safety (recommended)"),
      }),
      id: z.string().describe("Checkout session ID"),
    },
    async ({ meta, id }) => {
      const idempotencyKey = meta["idempotency-key"] || "";
      try {
        const result = await cancelCheckoutSession(id, idempotencyKey);
        if (!result) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Checkout session not found", id }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "cancel_checkout failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register a resource template for dynamically generated MCP Apps UI resources
  // This allows the SDK transport to handle resources/list and resources/read
  server.resource(
    "ui-resource",
    "ui://travel-insurance/{path}",
    {
      description: "Dynamically generated MCP UI resources",
      mimeType: "text/html;profile=mcp-app",
    },
    async (uri) => {
      const fullUri = uri.href;
      const resource = mcpAppsResources.get(fullUri);
      if (resource) {
        return {
          contents: [
            {
              uri: fullUri,
              mimeType: resource.mimeType,
              text: resource.text,
            },
          ],
        };
      }
      // Return empty if not found (resource may have expired or not been created yet)
      return {
        contents: [],
      };
    }
  );

  return server;
}

function generateProductListHtml(displayProducts: any[], totalCount: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { padding: 16px; background: white; }
    h2 { color: #1a1a1a; margin-bottom: 16px; font-size: 18px; }
    .products { display: flex; flex-wrap: nowrap; gap: 16px; width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }
    .product { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; min-height: 200px; flex: 0 0 calc((100% - 32px) / 3); min-width: 260px; }
    .product:hover { border-color: #1a1a1a; }
    .product-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .product-name { font-weight: 600; color: #1a1a1a; }
    .product-tier { font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 500; }
    .tier-budget { background: #f3f4f6; color: #6b7280; }
    .tier-standard { background: #e5e5e5; color: #1a1a1a; }
    .tier-premium { background: #1a1a1a; color: white; }
    .product-desc { color: #666; font-size: 14px; margin-bottom: 12px; flex-grow: 1; }
    .product-price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .price { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .price-original { font-size: 14px; color: #999; text-decoration: line-through; }
    .coverage { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
    .coverage-tag { background: #f9fafb; border: 1px solid #e5e5e5; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #666; }
    .btn { background: #1a1a1a; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; width: 100%; margin-top: auto; }
    .btn:hover { background: #333; }
    .empty { text-align: center; color: #888; padding: 32px; }
  </style>
</head>
<body>
  <h2>🛡️ Travel Insurance Plans</h2>
  <div class="products">
    ${
      displayProducts.length > 0
        ? displayProducts
            .map(
              (p) => `
      <div class="product">
        <div class="product-header">
          <span class="product-name">${p.name}</span>
          <span class="product-tier tier-${p.tier}">${p.tier}</span>
        </div>
        <div class="product-desc">${p.shortDescription || ""}</div>
        <div class="product-price">
          ${p.discountPrice != null ? `<span class="price">${formatCurrencyDisplay(p.discountPrice, p.currency)}</span><span class="price-original">${formatCurrencyDisplay(p.price, p.currency)}</span>` : `<span class="price">${formatCurrencyDisplay(p.price, p.currency)}</span>`}
        </div>
        <div class="coverage">
          ${((p.coverageHighlights as string[]) || []).slice(0, 4).map((c: string) => `<span class="coverage-tag">${c}</span>`).join("")}
        </div>
        <button class="btn" onclick="window.parent.postMessage({ type: 'tool', payload: { toolName: 'get_product', params: { productId: ${p.id} } } }, '*')">
          View Details
        </button>
      </div>
    `
            )
            .join("")
        : '<div class="empty">No products found. Try different filters.</div>'
    }
  </div>
  <script>
    window.parent.postMessage({ type: 'ui-lifecycle-iframe-ready' }, '*');
    let lastHeight = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const newHeight = Math.ceil(entry.contentRect.height) + 32;
        if (newHeight !== lastHeight) {
          lastHeight = newHeight;
          window.parent.postMessage({ type: "ui-size-change", payload: { height: newHeight } }, "*");
        }
      });
    });
    resizeObserver.observe(document.body);
  </script>
</body>
</html>
  `;
}

function generateProductDetailHtml(product: any, durations: number[], regions: string[], highlights: string[]): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { padding: 16px; background: white; }
    .header { margin-bottom: 20px; }
    .tier { font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 500; display: inline-block; margin-bottom: 8px; }
    .tier-budget { background: #f3f4f6; color: #6b7280; }
    .tier-standard { background: #e5e5e5; color: #1a1a1a; }
    .tier-premium { background: #1a1a1a; color: white; }
    h2 { color: #1a1a1a; margin-bottom: 4px; font-size: 22px; }
    .shop { color: #666; font-size: 13px; margin-bottom: 12px; }
    .price-section { display: flex; align-items: baseline; gap: 8px; margin-bottom: 16px; }
    .price { font-size: 28px; font-weight: 700; color: #1a1a1a; }
    .price-original { font-size: 16px; color: #999; text-decoration: line-through; }
    .desc { color: #444; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 14px; color: #1a1a1a; margin-bottom: 10px; font-weight: 600; }
    .highlights { display: flex; flex-direction: column; gap: 6px; }
    .highlight { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333; }
    .highlight::before { content: "✓"; color: #1a1a1a; font-weight: bold; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { background: #f3f4f6; border: 1px solid #e5e5e5; padding: 4px 12px; border-radius: 16px; font-size: 12px; color: #555; }
    .durations { display: flex; flex-wrap: wrap; gap: 8px; }
    .duration { background: white; border: 1px solid #e5e5e5; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .duration:hover { border-color: #1a1a1a; }
    .btn { background: #1a1a1a; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; width: 100%; margin-top: 16px; }
    .btn:hover { background: #333; }
  </style>
</head>
<body>
  <div class="header">
    <span class="tier tier-${product.tier}">${product.tier}</span>
    <h2>${product.name}</h2>
    <div class="shop">Travel Insurance</div>
    <div class="price-section">
      ${product.discountPrice != null ? `<span class="price">${formatCurrencyDisplay(product.discountPrice, product.currency)}</span><span class="price-original">${formatCurrencyDisplay(product.price, product.currency)}</span>` : `<span class="price">${formatCurrencyDisplay(product.price, product.currency)}</span>`}
    </div>
    <div class="desc">${product.description || ""}</div>
  </div>
  
  <div class="section">
    <h3>Coverage Highlights</h3>
    <div class="highlights">
      ${highlights.map((h) => `<div class="highlight">${h}</div>`).join("")}
    </div>
  </div>

  <div class="section">
    <h3>Regions Covered</h3>
    <div class="tags">
      ${regions.map((r) => `<span class="tag">${r}</span>`).join("")}
    </div>
  </div>

  <div class="section">
    <h3>Duration Options</h3>
    <div class="durations">
      ${durations.map((d) => `<span class="duration">${d} days</span>`).join("")}
    </div>
  </div>

  <button class="btn" onclick="window.parent.postMessage({ type: 'tool', payload: { toolName: 'create_checkout', params: { meta: { 'ucp-agent': { profile: 'https://chat-host.local/profiles/shopping-agent.json' } }, checkout: { line_items: [{ item: { id: '${product.id}' }, quantity: 1 }], currency: '${product.currency}' } } } }, '*')">
    Purchase This Plan
  </button>
  <script>
    window.parent.postMessage({ type: 'ui-lifecycle-iframe-ready' }, '*');
    let lastHeight = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const newHeight = Math.ceil(entry.contentRect.height) + 32;
        if (newHeight !== lastHeight) {
          lastHeight = newHeight;
          window.parent.postMessage({ type: "ui-size-change", payload: { height: newHeight } }, "*");
        }
      });
    });
    resizeObserver.observe(document.body);
  </script>
</body>
</html>
  `;
}

function generateRecommendationsHtml(recommendations: any[], destination?: string, duration?: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { padding: 16px; background: white; }
    h2 { color: #1a1a1a; margin-bottom: 8px; font-size: 18px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 16px; }
    .products { display: flex; flex-wrap: nowrap; gap: 16px; width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }
    .product { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; position: relative; display: flex; flex-direction: column; height: 100%; flex: 0 0 calc((100% - 32px) / 3); min-width: 260px; }
    .product:first-child { border-color: #1a1a1a; border-width: 2px; }
    .product:first-child::before { content: "Best Match"; position: absolute; top: -10px; left: 12px; background: #1a1a1a; color: white; font-size: 10px; padding: 2px 8px; border-radius: 4px; }
    .product:hover { border-color: #1a1a1a; }
    .product-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .product-name { font-weight: 600; color: #1a1a1a; }
    .product-tier { font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 500; }
    .tier-budget { background: #f3f4f6; color: #6b7280; }
    .tier-standard { background: #e5e5e5; color: #1a1a1a; }
    .tier-premium { background: #1a1a1a; color: white; }
    .product-desc { color: #666; font-size: 14px; margin-bottom: 12px; flex-grow: 1; }
    .product-price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .price { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .price-original { font-size: 14px; color: #999; text-decoration: line-through; }
    .btn { background: #1a1a1a; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; width: 100%; margin-top: auto; }
    .btn:hover { background: #333; }
    .empty { text-align: center; color: #888; padding: 32px; }
  </style>
</head>
<body>
  <h2>🎯 Recommended Plans</h2>
  <div class="subtitle">Based on your travel needs${destination ? ` to ${destination}` : ""}${duration ? ` for ${duration} days` : ""}</div>
  <div class="products">
    ${
      recommendations.length > 0
        ? recommendations
            .map(
              (p) => `
      <div class="product">
        <div class="product-header">
          <span class="product-name">${p.name}</span>
          <span class="product-tier tier-${p.tier}">${p.tier}</span>
        </div>
        <div class="product-desc">${p.shortDescription || ""}</div>
        <div class="product-price">
          ${p.discountPrice != null ? `<span class="price">${formatCurrencyDisplay(p.discountPrice, p.currency)}</span><span class="price-original">${formatCurrencyDisplay(p.price, p.currency)}</span>` : `<span class="price">${formatCurrencyDisplay(p.price, p.currency)}</span>`}
        </div>
        <button class="btn" onclick="window.parent.postMessage({ type: 'tool', payload: { toolName: 'get_product', params: { productId: ${p.id} } } }, '*')">
          View Details
        </button>
      </div>
    `
            )
            .join("")
        : '<div class="empty">No matching products found. Try adjusting your preferences.</div>'
    }
  </div>
  <script>
    window.parent.postMessage({ type: 'ui-lifecycle-iframe-ready' }, '*');
    let lastHeight = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const newHeight = Math.ceil(entry.contentRect.height) + 32;
        if (newHeight !== lastHeight) {
          lastHeight = newHeight;
          window.parent.postMessage({ type: "ui-size-change", payload: { height: newHeight } }, "*");
        }
      });
    });
    resizeObserver.observe(document.body);
  </script>
</body>
</html>
  `;
}

function generateOrderConfirmationHtml(
  order: any,
  product: any,
  duration: number,
  start: Date,
  end: Date,
  travelers: number,
  totalPrice: number
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { padding: 20px; background: white; }
    .success { text-align: center; padding: 20px; }
    .check { width: 64px; height: 64px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .check svg { width: 32px; height: 32px; color: white; }
    h2 { color: #1a1a1a; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    .details { background: #f9fafb; border-radius: 8px; padding: 16px; text-align: left; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e5e5; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #666; }
    .value { font-weight: 600; color: #1a1a1a; }
    .total { font-size: 22px; color: #1a1a1a; }
    .note { text-align: center; margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 6px; font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <div class="success">
    <div class="check">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    </div>
    <h2>Order Confirmed!</h2>
    <p class="subtitle">Your travel insurance is ready.</p>
  </div>
  
  <div class="details">
    <div class="detail-row">
      <span class="label">Order ID</span>
      <span class="value">#${order.id}</span>
    </div>
    <div class="detail-row">
      <span class="label">Plan</span>
      <span class="value">${product.name}</span>
    </div>
    <div class="detail-row">
      <span class="label">Coverage Period</span>
      <span class="value">${duration} days</span>
    </div>
    <div class="detail-row">
      <span class="label">Start Date</span>
      <span class="value">${start.toLocaleDateString()}</span>
    </div>
    <div class="detail-row">
      <span class="label">End Date</span>
      <span class="value">${end.toLocaleDateString()}</span>
    </div>
    <div class="detail-row">
      <span class="label">Travelers</span>
      <span class="value">${travelers}</span>
    </div>
    <div class="detail-row">
      <span class="label">Total Price</span>
      <span class="value total">${formatCurrencyDisplay(totalPrice, product.currency)}</span>
    </div>
  </div>
  
  <div class="note">
    📧 A confirmation email with your policy documents will be sent shortly.
  </div>
  <script>
    window.parent.postMessage({ type: 'ui-lifecycle-iframe-ready' }, '*');
    let lastHeight = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const newHeight = Math.ceil(entry.contentRect.height) + 32;
        if (newHeight !== lastHeight) {
          lastHeight = newHeight;
          window.parent.postMessage({ type: "ui-size-change", payload: { height: newHeight } }, "*");
        }
      });
    });
    resizeObserver.observe(document.body);
  </script>
</body>
</html>
  `;
}
