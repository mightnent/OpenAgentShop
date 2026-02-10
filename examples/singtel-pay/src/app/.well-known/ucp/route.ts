import { NextResponse } from "next/server";
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
    return `${forwardedProto}://${forwardedHost}`;
  }
  
  // Check standard host header
  const host = requestHeaders.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  
  // Fall back to environment variable or configured URL
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3003";
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
  };

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
  const STRICT = process.env.UCP_STRICT === "true";
  let BASE_URL = getBaseUrl(requestHeaders);
  if (STRICT && BASE_URL.startsWith("http://") && !BASE_URL.includes("localhost")) {
    BASE_URL = BASE_URL.replace("http://", "https://");
  }

  const services = {
    "dev.ucp.shopping": [
      {
        version: "2026-01-11",
        transport: "mcp",
        endpoint: `${BASE_URL}/api/mcp`,
        spec: "https://ucp.dev/specification/checkout-mcp",
        schema: "https://ucp.dev/services/shopping/mcp.openrpc.json",
      },
      {
        version: "2026-01-11",
        transport: "embedded",
        endpoint: `${BASE_URL}/checkout`,
        spec: "https://ucp.dev/specification/embedded-checkout",
        schema: "https://ucp.dev/services/shopping/embedded.openrpc.json",
        config: {
          continue_url_template: `${BASE_URL}/checkout/{id}`,
        },
      },
    ],
  };

  const ucpProfile: Record<string, unknown> = {
    ucp: {
      version: "2026-01-11",
      services,
      capabilities: {
    "dev.ucp.shopping.checkout": [
        {
            "version": "2026-01-11",
            "spec": "https://ucp.dev/specification/checkout",
            "schema": "https://ucp.dev/schemas/shopping/checkout.json"
        }
    ]
},
      payment_handlers: {
    "com.demo.mock_payment": [
        {
            "id": "dev_localhost_handler_1",
            "version": "2026-01-11",
            "config": {}
        }
    ]
},
    },
  };

  if (!STRICT) {
    ucpProfile["business"] = {
      name: "Singtel Bill Payment",
      url: BASE_URL,
    };
  }

  return NextResponse.json(ucpProfile, {
    headers: CORS_HEADERS,
  });
}
