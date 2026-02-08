/**
 * MCP Route Handler Generator
 *
 * Generates the /api/mcp route handler that implements
 * MCP Streamable HTTP transport (spec 2025-11-25).
 */

import type { ProductCatalog } from "../types/product-catalog";

/**
 * Generate the MCP route handler source code.
 */
export function generateMcpRouteSource(catalog: ProductCatalog): string {
  return `import { NextRequest, NextResponse } from "next/server";
import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";

// Session management: one MCP server + transport per session
const sessions = new Map<
  string,
  {
    server: ReturnType<typeof createMcpServer>;
    transport: WebStandardStreamableHTTPServerTransport;
  }
>();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, MCP-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "MCP-Session-Id, MCP-Protocol-Version",
};

function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return \`\${forwardedProto}://\${forwardedHost}\`;
  }
  const host = request.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return \`\${proto}://\${host}\`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || ${JSON.stringify(catalog.shop.url)};
}

function withCors(response: NextResponse | Response) {
  const res = response instanceof NextResponse ? response : new NextResponse(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  const sessionId = request.headers.get("mcp-session-id");

  if (!sessionId) {
    return withCors(
      NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "MCP server is running" } },
        { status: 200 }
      )
    );
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return withCors(
      NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32001, message: "Session not found" } },
        { status: 404 }
      )
    );
  }

  const response = await session.transport.handleRequest(request);
  return withCors(response);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const isInitialize =
    body?.method === "initialize" ||
    (Array.isArray(body) && body.some((m: any) => m.method === "initialize"));

  if (isInitialize) {
    // Create new session
    const server = createMcpServer({ baseUrl: getBaseUrl(request) });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    });

    await server.connect(transport);

    const newRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(body),
    });

    const response = await transport.handleRequest(newRequest as any);

    const sessionId = transport.sessionId;
    if (sessionId) {
      sessions.set(sessionId, { server, transport });
      transport.onclose = () => {
        sessions.delete(sessionId);
      };
    }

    return withCors(response);
  }

  // Existing session
  const sessionId = request.headers.get("mcp-session-id");

  if (!sessionId || !sessions.has(sessionId)) {
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session not found. Send initialize first." },
          id: body?.id ?? null,
        },
        { status: 404 }
      )
    );
  }

  const session = sessions.get(sessionId)!;
  const newRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  });

  const response = await session.transport.handleRequest(newRequest as any);

  // Handle notifications (e.g., notifications/initialized) → 202
  if (body?.method?.startsWith("notifications/")) {
    return withCors(new NextResponse(null, { status: 202 }));
  }

  return withCors(response);
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.close();
    sessions.delete(sessionId);
  }
  return withCors(new NextResponse(null, { status: 204 }));
}
`;
}
