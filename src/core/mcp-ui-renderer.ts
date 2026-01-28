/**
 * MCP-UI Renderer Generator
 *
 * Generates HTML rendering functions for MCP-UI components.
 * These are embedded in tool responses and/or served via MCP resources.
 *
 * Components:
 *   - Product List: Scrollable card grid
 *   - Product Detail: Full product card with attributes
 *   - Recommendations: Ranked product suggestions
 *   - Order Confirmation: Post-checkout success page
 */

import type { ProductCatalog, CustomAttribute } from "../types/product-catalog";
import type { UiConfig } from "../types/config";

/**
 * Generate the MCP-UI renderer source code.
 */
export function generateMcpUiSource(
  catalog: ProductCatalog,
  uiConfig?: UiConfig
): string {
  const shopName = catalog.shop.name;
  const currency = catalog.shop.currency ?? "USD";
  const theme = uiConfig?.theme ?? {};
  const primaryColor = theme.primaryColor ?? catalog.shop.branding?.primary_color ?? "#1a1a1a";
  const fontFamily = theme.fontFamily ?? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const borderRadius = theme.borderRadius ?? "12px";
  const customCss = uiConfig?.customCss ?? "";

  const detailAttrs = (catalog.product_schema?.custom_attributes ?? []).filter(
    (a) => a.display_in_detail
  );
  const listAttrs = (catalog.product_schema?.custom_attributes ?? []).filter(
    (a) => a.display_in_list
  );

  return `import { formatCurrencyDisplay } from "@/lib/currency";

const CURRENCY = ${JSON.stringify(currency)};
const SHOP_NAME = ${JSON.stringify(shopName)};

// ---------------------------------------------------------------------------
// Lifecycle Script (iframe ready + ResizeObserver for sizing)
// ---------------------------------------------------------------------------

const lifecycleScript = \`
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
\`;

// ---------------------------------------------------------------------------
// Shared Styles
// ---------------------------------------------------------------------------

const baseStyles = \`
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      background: white;
      color: #1a1a1a;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: white;
      border-radius: ${borderRadius};
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn-primary {
      background: ${primaryColor};
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .price { font-weight: 700; color: ${primaryColor}; }
    .price-original { text-decoration: line-through; color: #999; font-size: 0.9em; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    ${customCss}
  </style>
\`;

// ---------------------------------------------------------------------------
// Product List
// ---------------------------------------------------------------------------

export function generateProductListHtml(products: any[]): string {
  const cards = products.map((p: any) => {
    const price = formatCurrencyDisplay(p.discountPrice ?? p.price, p.currency || CURRENCY);
    const originalPrice = p.discountPrice
      ? \`<span class="price-original">\${formatCurrencyDisplay(p.price, p.currency || CURRENCY)}</span> \`
      : "";
    const media = p.media || [];
    const imageHtml = media.length > 0
      ? \`<img src="\${media[0].url}" alt="\${media[0].alt || p.name}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px 8px 0 0; margin: -16px -16px 12px -16px; width: calc(100% + 32px);" />\`
      : "";
${listAttrs.length > 0 ? `
    const attrs = [
${listAttrs.map((a) => `      p.${camelCase(a.key)} ? \`<div class="attr"><strong>${a.label}:</strong> \${Array.isArray(p.${camelCase(a.key)}) ? p.${camelCase(a.key)}.join(", ") : p.${camelCase(a.key)}}</div>\` : "",`).join("\n")}
    ].filter(Boolean).join("");
` : '    const attrs = "";'}
    return \`
      <div class="card" style="padding: 16px; min-width: 280px; flex: 0 0 auto;">
        \${imageHtml}
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <h3 style="font-size: 16px; font-weight: 600;">\${p.name}</h3>
          \${p.tier ? \`<span class="badge" style="background: \${p.tier === 'premium' ? '#f0e6ff' : p.tier === 'budget' ? '#e8f5e9' : '#e3f2fd'}; color: \${p.tier === 'premium' ? '#7c3aed' : p.tier === 'budget' ? '#2e7d32' : '#1565c0'}">\${p.tier}</span>\` : ""}
        </div>
        <p style="color: #666; font-size: 13px; margin-bottom: 8px;">\${p.shortDescription || ""}</p>
        \${attrs}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
          <span class="price">\${originalPrice}\${price}</span>
          <button class="btn-primary" onclick="window.parent.postMessage({ type: 'tool', payload: { toolName: 'get_product', params: { productId: \${p.id} } } }, '*')">
            View Details
          </button>
        </div>
      </div>
    \`;
  }).join("");

  return \`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
\${baseStyles}
<style>
  .scroll-container {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 16px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .scroll-container > .card { scroll-snap-align: start; }
</style>
</head><body>
  <div style="padding: 8px 16px;"><h2 style="font-size: 18px;">\${SHOP_NAME} Products</h2></div>
  <div class="scroll-container">\${cards}</div>
  \${lifecycleScript}
</body></html>\`;
}

// ---------------------------------------------------------------------------
// Product Detail
// ---------------------------------------------------------------------------

export function generateProductDetailHtml(product: any, media?: any[]): string {
  const price = formatCurrencyDisplay(product.discountPrice ?? product.price, product.currency || CURRENCY);
  const originalPrice = product.discountPrice
    ? \`<span class="price-original" style="font-size: 18px;">\${formatCurrencyDisplay(product.price, product.currency || CURRENCY)}</span> \`
    : "";

  const imageHtml = media && media.length > 0
    ? \`<img src="\${media[0].url}" alt="\${media[0].alt || product.name}" style="width: 100%; height: 200px; object-fit: cover; border-radius: ${borderRadius} ${borderRadius} 0 0;" />\`
    : "";

${detailAttrs.length > 0 ? `  const attrSections = [
${detailAttrs.map((a) => `    product.${camelCase(a.key)} ? \`<div style="margin-top: 12px;"><strong>${a.label}</strong><div style="margin-top: 4px; color: #555;">\${Array.isArray(product.${camelCase(a.key)}) ? \`<ul style="margin: 0; padding-left: 20px;">\${product.${camelCase(a.key)}.map((v: string) => \`<li>\${v}</li>\`).join("")}</ul>\` : product.${camelCase(a.key)}}</div></div>\` : "",`).join("\n")}
  ].filter(Boolean).join("");
` : '  const attrSections = "";'}

  return \`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
\${baseStyles}
</head><body>
  <div class="card" style="max-width: 480px; margin: 16px auto;">
    \${imageHtml}
    <div style="padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <h2 style="font-size: 20px; font-weight: 700;">\${product.name}</h2>
        \${product.tier ? \`<span class="badge" style="background: #f0e6ff; color: #7c3aed;">\${product.tier}</span>\` : ""}
      </div>
      <p style="color: #666; margin-top: 8px;">\${product.description || product.shortDescription || ""}</p>
      \${attrSections}
      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <span class="price" style="font-size: 24px;">\${originalPrice}\${price}</span>
        <button class="btn-primary" style="padding: 12px 24px; font-size: 16px;" onclick="window.parent.postMessage({ type: 'tool', payload: { toolName: 'create_checkout', params: { meta: { 'ucp-agent': { profile: 'https://chat-host.local/profiles/shopping-agent.json' } }, checkout: { line_items: [{ item: { id: String(\${product.id}) }, quantity: 1 }] } } } }, '*')">
          Purchase
        </button>
      </div>
    </div>
  </div>
  \${lifecycleScript}
</body></html>\`;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export function generateRecommendationsHtml(products: any[]): string {
  const cards = products.map((p: any, i: number) => {
    const price = formatCurrencyDisplay(p.discountPrice ?? p.price, p.currency || CURRENCY);
    const isBest = i === 0;

    return \`
      <div class="card" style="padding: 16px; \${isBest ? 'border: 2px solid ${primaryColor};' : ''}">
        \${isBest ? '<div style="background: ${primaryColor}; color: white; text-align: center; padding: 4px; font-size: 12px; font-weight: 600; margin: -16px -16px 12px; border-radius: 0;">Best Match</div>' : ''}
        <h3 style="font-size: 16px; font-weight: 600;">\${p.name}</h3>
        <p style="color: #666; font-size: 13px; margin: 6px 0;">\${p.shortDescription || ""}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
          <span class="price">\${price}</span>
          <button class="btn-primary" onclick="window.parent.postMessage({ type: 'tool', payload: { toolName: 'get_product', params: { productId: \${p.id} } } }, '*')">
            View Details
          </button>
        </div>
      </div>
    \`;
  }).join("");

  return \`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
\${baseStyles}
<style>
  .reco-grid { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
</style>
</head><body>
  <div style="padding: 8px 16px;"><h2 style="font-size: 18px;">Recommended for You</h2></div>
  <div class="reco-grid">\${cards}</div>
  \${lifecycleScript}
</body></html>\`;
}

// ---------------------------------------------------------------------------
// Order Confirmation
// ---------------------------------------------------------------------------

export function generateOrderConfirmationHtml(orderData: any): string {
  const order = orderData.order || {};
  const lineItems = orderData.line_items || [];
  const totals = orderData.totals || [];
  const buyer = orderData.buyer || {};

  const itemRows = lineItems.map((li: any) => \`
    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
      <span>\${li.item?.title || "Item"} x\${li.quantity}</span>
      <span>\${formatCurrencyDisplay(li.totals?.find((t: any) => t.type === "total")?.amount ?? 0, CURRENCY)}</span>
    </div>
  \`).join("");

  const totalRows = totals.map((t: any) => \`
    <div style="display: flex; justify-content: space-between; padding: 4px 0; \${t.type === 'total' ? 'font-weight: 700; font-size: 18px; border-top: 2px solid #333; margin-top: 8px; padding-top: 8px;' : ''}">
      <span>\${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</span>
      <span>\${formatCurrencyDisplay(t.amount, CURRENCY)}</span>
    </div>
  \`).join("");

  return \`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
\${baseStyles}
</head><body>
  <div class="card" style="max-width: 480px; margin: 16px auto; padding: 24px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="width: 48px; height: 48px; background: #e8f5e9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h2 style="font-size: 20px; font-weight: 700;">Order Confirmed</h2>
      <p style="color: #666; margin-top: 4px;">Order #\${order.id || "—"}</p>
    </div>
    <div style="margin-bottom: 16px;">\${itemRows}</div>
    <div>\${totalRows}</div>
    \${buyer.email ? \`<p style="color: #666; font-size: 13px; margin-top: 16px; text-align: center;">Confirmation sent to \${buyer.email}</p>\` : ""}
  </div>
  \${lifecycleScript}
</body></html>\`;
}
`;
}

function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
