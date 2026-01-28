/**
 * UCP Well-Known Profile Generator
 *
 * Generates the /.well-known/ucp route handler that serves
 * the UCP platform profile for capability discovery.
 *
 * UCP Namespace Rules:
 * - The `spec` and `schema` fields are REQUIRED for all capabilities
 * - The origin of these URLs MUST match the namespace authority:
 *   - `dev.ucp.*` namespace → `https://ucp.dev/...`
 *   - `com.example.*` namespace → `https://example.com/...`
 *
 * Dynamic URL Detection:
 * - The merchant's deployed URL is detected at runtime from request headers
 * - Falls back to NEXT_PUBLIC_BASE_URL env var, then configured shop.url
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
 * Get the spec/schema URL authority for a given namespace.
 * - dev.ucp.* → https://ucp.dev
 * - com.example.* → https://example.com
 * - dev.localhost → null (local development, no spec hosting)
 */
function getNamespaceAuthority(namespace: string): string | null {
  if (namespace === "dev.localhost") {
    return null; // Local dev doesn't require spec hosting
  }
  if (namespace.startsWith("dev.ucp")) {
    return "https://ucp.dev";
  }
  // Convert namespace to URL: com.example -> https://example.com
  const parts = namespace.split(".");
  if (parts.length >= 2) {
    // Reverse and join: com.example.shopping -> example.com
    const tld = parts[0];
    const domain = parts[1];
    return `https://${domain}.${tld}`;
  }
  return null;
}

/**
 * Generate the /.well-known/ucp route handler source code.
 */
export function generateWellKnownUcpSource(
  catalog: ProductCatalog,
  ucpConfig?: UcpConfig
): string {
  const ucpVersion = ucpConfig?.version ?? "2026-01-11";
  const mcpVersion = "2025-11-25"; // MCP transport version
  const shopName = catalog.shop.name;
  const shopUrl = catalog.shop.url;
  const ucpNamespace = deriveUcpNamespace(shopUrl, catalog.shop.ucp_namespace);
  const namespaceAuthority = getNamespaceAuthority(ucpNamespace);

  // Determine if using standard UCP namespace (dev.ucp.*)
  const useStandardNamespace = ucpNamespace.startsWith("dev.") || ucpNamespace === "dev.localhost";
  
  // Capability names
  const checkoutCapability = useStandardNamespace 
    ? "dev.ucp.shopping.checkout" 
    : `${ucpNamespace}.checkout`;
  
  // Service name - the shopping service that exposes MCP transport
  const shoppingService = useStandardNamespace
    ? "dev.ucp.shopping"
    : ucpNamespace;

  // Build capabilities with required spec/schema fields
  // For dev.ucp.* namespace, spec/schema point to https://ucp.dev/...
  const specAuthority = useStandardNamespace ? "https://ucp.dev" : namespaceAuthority;
  
  interface CapabilityDeclaration {
    version: string;
    spec?: string;
    schema?: string;
  }
  
  const capabilities: Record<string, CapabilityDeclaration[]> = {
    [checkoutCapability]: [{
      version: ucpVersion,
      ...(specAuthority && {
        spec: `${specAuthority}/specs/shopping/checkout`,
        schema: `${specAuthority}/schemas/shopping/checkout.json`,
      }),
    }],
  };

  // Add extension capabilities (namespace-aware)
  if (ucpConfig?.extensions) {
    const extPrefix = useStandardNamespace ? "dev.ucp.shopping" : ucpNamespace;
    for (const ext of ucpConfig.extensions) {
      capabilities[`${extPrefix}.${ext}`] = [{
        version: ucpVersion,
        ...(specAuthority && {
          spec: `${specAuthority}/specs/shopping/${ext}`,
          schema: `${specAuthority}/schemas/shopping/${ext}.json`,
        }),
      }];
    }
  }

  // Use namespace-based payment handler
  const defaultPaymentHandler = useStandardNamespace
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

  // CORS headers for UCP discovery
  const corsHeaders = `{
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
  }`;

  return `import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Detect the base URL from request headers at runtime.
 * This handles dynamic deployments where the URL isn't known until runtime.
 */
function getBaseUrl(requestHeaders: Headers): string {
  // Check for forwarded host (behind proxy/CDN)
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return \`\${forwardedProto}://\${forwardedHost}\`;
  }
  
  // Check standard host header
  const host = requestHeaders.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return \`\${proto}://\${host}\`;
  }
  
  // Fall back to environment variable or configured URL
  return process.env.NEXT_PUBLIC_BASE_URL || ${JSON.stringify(shopUrl)};
}

const CORS_HEADERS = ${corsHeaders};

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET handler for UCP profile discovery
 */
export async function GET() {
  const requestHeaders = await headers();
  const BASE_URL = getBaseUrl(requestHeaders);

  const ucpProfile = {
    ucp: {
      version: ${JSON.stringify(ucpVersion)},
    },
    business: {
      name: ${JSON.stringify(shopName)},
      url: BASE_URL,
    },
    capabilities: ${JSON.stringify(capabilities, null, 4)},
    services: {
      "${shoppingService}": [
        {
          version: ${JSON.stringify(mcpVersion)},
          endpoint: \`\${BASE_URL}/api/mcp\`,
          transport: "mcp",
        },
      ],
    },
    payment_handlers: ${JSON.stringify(paymentHandlers, null, 4)},
  };

  return NextResponse.json(ucpProfile, {
    headers: CORS_HEADERS,
  });
}
`;
}
