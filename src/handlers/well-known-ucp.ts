/**
 * UCP Well-Known Profile Generator
 *
 * Generates the /.well-known/ucp route handler that serves
 * the UCP platform profile for capability discovery.
 */

import type { ProductCatalog } from "../types/product-catalog";
import type { UcpConfig } from "../types/config";

/**
 * Derive UCP namespace from URL or use provided namespace
 * e.g., "https://myshop.com" -> "com.myshop"
 */
function deriveUcpNamespace(url: string, providedNamespace?: string): string {
  if (providedNamespace) return providedNamespace;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // Handle localhost/development
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "dev.localhost";
    }
    
    // Reverse the domain parts: myshop.com -> com.myshop
    const parts = hostname.replace(/^www\./, "").split(".");
    return parts.reverse().join(".");
  } catch {
    return "dev.localhost";
  }
}

/**
 * Generate the /.well-known/ucp route handler source code.
 */
export function generateWellKnownUcpSource(
  catalog: ProductCatalog,
  ucpConfig?: UcpConfig
): string {
  const ucpVersion = ucpConfig?.version ?? "2026-01-11";
  const shopName = catalog.shop.name;
  const shopUrl = catalog.shop.url;
  const ucpNamespace = deriveUcpNamespace(shopUrl, catalog.shop.ucp_namespace);

  // Use namespace-based capability
  const defaultCapability = ucpNamespace.startsWith("dev.") 
    ? "dev.ucp.shopping.checkout" 
    : `${ucpNamespace}.checkout`;
  const capabilities: Record<string, Array<{ version: string }>> = {
    [defaultCapability]: [{ version: ucpVersion }],
  };

  // Add extension capabilities (namespace-aware)
  if (ucpConfig?.extensions) {
    const extPrefix = ucpNamespace.startsWith("dev.") ? "dev.ucp.shopping" : ucpNamespace;
    for (const ext of ucpConfig.extensions) {
      capabilities[`${extPrefix}.${ext}`] = [{ version: ucpVersion }];
    }
  }

  // Use namespace-based payment handler
  const defaultPaymentHandler = ucpNamespace.startsWith("dev.")
    ? "com.demo.mock_payment"
    : `${ucpNamespace}.payment`;
  const paymentHandlers = ucpConfig?.paymentHandlers ?? {
    [defaultPaymentHandler]: [
      {
        id: `${ucpNamespace.replace(/\./g, "_")}_handler_1`,
        version: ucpVersion,
        config: {},
      },
    ],
  };

  return `import { NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ${JSON.stringify(shopUrl)};

export async function GET() {
  return NextResponse.json({
    version: ${JSON.stringify(ucpVersion)},
    business: {
      name: ${JSON.stringify(shopName)},
      url: BASE_URL,
    },
    capabilities: ${JSON.stringify(capabilities, null, 4)},
    services: {
      "dev.ucp.mcp": [
        {
          version: "2025-11-25",
          endpoint: \`\${BASE_URL}/api/mcp\`,
        },
      ],
      "dev.ucp.rest": [
        {
          version: ${JSON.stringify(ucpVersion)},
          endpoint: \`\${BASE_URL}/api\`,
        },
      ],
    },
    payment_handlers: ${JSON.stringify(paymentHandlers, null, 4)},
  });
}
`;
}
