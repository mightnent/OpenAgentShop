import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";

/**
 * MCP Streamable HTTP Transport (spec 2025-11-25 compliant)
 * 
 * Uses the official MCP SDK's WebStandardStreamableHTTPServerTransport which handles:
 * - Protocol version negotiation
 * - Session management with MCP-Session-Id header
 * - Proper 202 Accepted for notifications
 * - 404 for invalid sessions
 * - SSE streaming support (optional)
 * - JSON response mode
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Session-Id, MCP-Protocol-Version",
};

// Store active sessions: sessionId -> { server, transport }
const sessions = new Map<string, { server: ReturnType<typeof createMcpServer>; transport: WebStandardStreamableHTTPServerTransport }>();

/**
 * Create a new MCP session with server and transport
 */
function createSession(sessionId: string) {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    enableJsonResponse: true, // Return JSON instead of SSE for simple request/response
    onsessioninitialized: (id) => {
      console.log(`MCP session initialized: ${id}`);
    },
    onsessionclosed: (id) => {
      console.log(`MCP session closed: ${id}`);
      sessions.delete(id);
    },
  });

  // Connect server to transport
  server.connect(transport).catch((err) => {
    console.error("Failed to connect MCP server to transport:", err);
  });

  sessions.set(sessionId, { server, transport });
  return { server, transport };
}

/**
 * Get or create session for a request
 */
function getOrCreateSession(sessionId: string | null, isInitialize: boolean): { transport: WebStandardStreamableHTTPServerTransport; isNew: boolean } {
  // For initialize requests, always create a new session
  if (isInitialize) {
    const newSessionId = crypto.randomUUID();
    const { transport } = createSession(newSessionId);
    return { transport, isNew: true };
  }

  // For other requests, use existing session
  if (sessionId && sessions.has(sessionId)) {
    return { transport: sessions.get(sessionId)!.transport, isNew: false };
  }

  // No valid session - will be handled by transport (returns 400/404)
  // Create a temporary transport to handle the error response
  const tempTransport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId || "invalid",
    enableJsonResponse: true,
  });
  return { transport: tempTransport, isNew: false };
}

/**
 * Add CORS headers to a response
 */
function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Check if this is an initialize request by peeking at the body
 */
async function isInitializeRequest(request: Request): Promise<{ isInitialize: boolean; body: unknown }> {
  try {
    const cloned = request.clone();
    const body = await cloned.json();
    return { isInitialize: body?.method === "initialize", body };
  } catch {
    return { isInitialize: false, body: null };
  }
}

export async function POST(request: NextRequest) {
  const sessionId = request.headers.get("MCP-Session-Id") || request.headers.get("mcp-session-id");
  
  // Check if this is an initialize request
  const { isInitialize, body } = await isInitializeRequest(request);
  
  // Get or create session
  const { transport } = getOrCreateSession(sessionId, isInitialize);

  // Let the SDK transport handle the request with pre-parsed body
  const response = await transport.handleRequest(request as unknown as Request, {
    parsedBody: body,
  });

  return addCorsHeaders(response);
}

export async function GET(request: NextRequest) {
  const sessionId = request.headers.get("MCP-Session-Id") || request.headers.get("mcp-session-id");
  
  // For GET requests (SSE stream), need an existing session
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    const response = await transport.handleRequest(request as unknown as Request);
    return addCorsHeaders(response);
  }

  // No session - return server info (non-MCP response for health checks)
  const accept = request.headers.get("accept");
  if (accept?.includes("text/event-stream")) {
    // SSE requested but no session - return 400
    return new Response(JSON.stringify({ error: "MCP-Session-Id header required for SSE" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Health check / info endpoint
  return new Response(
    JSON.stringify({
      status: "Travel Insurance MCP Server running",
      version: "1.0.0",
      protocol: "MCP Streamable HTTP (2025-11-25)",
      capabilities: ["tools", "resources"],
      activeSessions: sessions.size,
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.headers.get("MCP-Session-Id") || request.headers.get("mcp-session-id");

  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    const response = await transport.handleRequest(request as unknown as Request);
    return addCorsHeaders(response);
  }

  return new Response(null, { status: 404, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
