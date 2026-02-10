import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";

  const profile = {
    ucp: {
      version: "2026-01-11",
      services: {
        "dev.ucp.shopping": [
          {
            version: "2026-01-11",
            spec: "https://ucp.dev/specification/overview",
            transport: "mcp",
            endpoint: `${baseUrl}/api/mcp`,
            schema: "https://ucp.dev/services/shopping/mcp.openrpc.json",
          },
          {
            version: "2026-01-11",
            spec: "https://ucp.dev/specification/embedded-checkout",
            transport: "embedded",
            schema: "https://ucp.dev/services/shopping/embedded.openrpc.json",
            endpoint: `${baseUrl}/checkout`,
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
            spec: "https://example.com/specs/mock-payment",
            schema: "https://example.com/schemas/mock-payment.json",
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
