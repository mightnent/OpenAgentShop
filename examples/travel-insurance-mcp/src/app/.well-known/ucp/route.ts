import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
  const strict = process.env.UCP_STRICT === "true";
  const resolvedBaseUrl =
    strict && baseUrl.startsWith("http://") && !baseUrl.includes("localhost")
      ? baseUrl.replace("http://", "https://")
      : baseUrl;

  const profile = {
    ucp: {
      version: "2026-01-11",
      services: {
        "dev.ucp.shopping": [
          {
            version: "2026-01-11",
            transport: "mcp",
            endpoint: `${resolvedBaseUrl}/api/mcp`,
            spec: "https://ucp.dev/specification/checkout-mcp",
            schema: "https://ucp.dev/services/shopping/mcp.openrpc.json",
          },
          {
            version: "2026-01-11",
            transport: "embedded",
            endpoint: `${resolvedBaseUrl}/checkout`,
            spec: "https://ucp.dev/specification/embedded-checkout",
            schema: "https://ucp.dev/services/shopping/embedded.openrpc.json",
            config: {
              continue_url_template: `${resolvedBaseUrl}/checkout/{id}`,
            },
          },
        ],
      },
      capabilities: {
        "dev.ucp.shopping.checkout": [
          {
            version: "2026-01-11",
            spec: "https://ucp.dev/specification/checkout",
            schema: "https://ucp.dev/schemas/shopping/checkout.json",
          },
        ],
      },
      payment_handlers: {
        "com.demo.mock_payment": [
          {
            id: "mock_handler_1",
            version: "2026-01-11",
            config: {},
          },
        ],
      },
    },
  };

  return NextResponse.json(profile, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
