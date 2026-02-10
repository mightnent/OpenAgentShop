# Agentic Commerce Demo

Next.js 14 (App Router) application demonstrating agentic commerce capabilities through MCP:

- **An MCP-compatible tool server** over `POST /api/mcp`
- **An MCP-UI / MCP Apps embedded UI experience** (HTML resources rendered inside MCP hosts)
- **A Merchant Center UI** for basic product management
- **An OpenAI Commerce Feed (JSONL) endpoint** for product discovery integration

This README documents the **current as-built architecture** and explicitly calls out what is (and is not) compliant with the MCP protocol expectations you'd get when using the official MCP SDK transports.

---

## 1) Current architecture

### 1.1 High-level components

- **Next.js App Router**
  - UI routes under `src/app/*`
  - API routes under `src/app/api/*`
- **Database layer**
  - Neon Postgres client (`@neondatabase/serverless`) + Drizzle ORM
  - Schema in `src/db/schema.ts`
- **MCP server (tools + UI resources)**
  - Tool definitions implemented with `McpServer.tool(...)` in `src/lib/mcp-server.ts`
  - HTTP transport + JSON-RPC dispatch implemented manually in `src/app/api/mcp/route.ts`
- **OpenAI feed adapter**
  - Converts internal products into OpenAI feed JSONL via `src/lib/adapters/*`

### 1.2 Data flow (main paths)

#### MCP tool execution

1. Client calls `POST /api/mcp` with JSON-RPC
2. `src/app/api/mcp/route.ts` routes requests by `method`:
   - `initialize`, `notifications/initialized`, `ping`
   - `tools/list`, `tools/call`
   - `resources/list`, `resources/read`
3. For tool calls:
   - `createMcpServer()` constructs an `McpServer` and registers tools
   - `/api/mcp` looks up tools from `(server as any)._registeredTools`
   - It calls the tool handler, which queries Drizzle and returns content
4. For UI content:
   - tools call `createUIResource(...)` to generate HTML resources
   - resources are either embedded directly in the tool result (classic MCP-UI) or made available via `resources/read` (MCP Apps)

#### Merchant Center product management

- UI: `GET /merchant` lists products and allows toggling/deleting
- UI: `GET /merchant/products/[id]` edits product fields
- API: `/api/merchant/products` and `/api/merchant/products/[id]` mutate/query the `products` table

#### OpenAI commerce feed

- `GET /api/feed` reads `products` + `product_media`, transforms to JSONL, and optionally gzips

### 1.3 Code map

```
src/
  app/
    api/
      mcp/route.ts                 # Custom HTTP JSON-RPC transport + session handling
      feed/route.ts                # OpenAI Commerce Feed JSONL endpoint
      merchant/
        products/route.ts          # list + create products
        products/[id]/route.ts     # get + patch + delete a product
        shops/route.ts             # stub (shops deprecated)
    merchant/
      page.tsx                     # Merchant Center list view
      products/[id]/page.tsx       # Merchant Center edit view
    page.tsx                       # Landing page
  lib/
    mcp-server.ts                  # MCP tool registry + UI resource generation
    adapters/
      openai-feed-adapter.ts
      travel-insurance-adapter.ts
  db/
    index.ts                       # drizzle + neon connection
    schema.ts                      # products/product_media/orders tables
    seed.ts                        # seeds sample products
  types/
    openai-feed.ts                 # OpenAI feed types
```

---

## 2) How the MCP-UI server is implemented

There are **two UI delivery modes** implemented side-by-side:

### 2.1 “Classic MCP-UI” (embedded HTML resource in tool result)

In `src/lib/mcp-server.ts`, each tool typically:

- Builds an HTML string (e.g. product list, product detail, order confirmation)
- Calls `createUIResource({ uri, content: { type: "rawHtml", htmlString }, encoding: "text" })`
- Returns the resulting resource object in the tool call response `content[]`

Additionally, tool responses include:

- `_meta.ui.resourceUri` pointing at the same `ui://...` URI

This is what many legacy/"classic" MCP UI hosts expect: the UI payload is returned inline as part of the tool result.

### 2.2 “MCP Apps” mode (resources/list + resources/read)

The same tools also register UI as an MCP Apps resource:

- They call `createUIResource({ ..., adapters: { mcpApps: { enabled: true }}})`
- The generated `mimeType` and `text` are stored in an in-memory map (`mcpAppsResources`)
- `src/app/api/mcp/route.ts` implements:
  - `resources/list` (lists available `ui://...` resources)
  - `resources/read` (returns the HTML for a given `ui://...` URI)

This makes the server compatible with hosts that implement the MCP Apps resource fetching flow.

### 2.3 Why there are two paths

- **Classic MCP-UI**: UI resource returned directly in the tool response
- **MCP Apps**: UI fetched later via `resources/read`

The code intentionally supports both.

---

## 3) MCP protocol compliance (Streamable HTTP 2025-11-25)

This server uses the official MCP SDK's `WebStandardStreamableHTTPServerTransport` for **full compliance** with the MCP Streamable HTTP transport specification (2025-11-25).

### 3.1 Implementation

The server now uses:
- **`McpServer`** for tool and resource registration
- **`WebStandardStreamableHTTPServerTransport`** from `@modelcontextprotocol/sdk` for HTTP handling
- **`server.connect(transport)`** pattern for proper SDK integration

### 3.2 What's handled by the SDK transport

- **Protocol version negotiation** (`MCP-Protocol-Version` header)
- **Session management** (`MCP-Session-Id` header with `crypto.randomUUID()`)
- **JSON-RPC envelope** (request/response validation)
- **`initialize`** with proper capability advertisement
- **`notifications/initialized`** returns `202 Accepted`
- **`ping`** responds correctly
- **`tools/list`** and **`tools/call`** via registered tools
- **`resources/list`** and **`resources/read`** via registered resource templates
- **Session lifecycle** (`DELETE` returns `204` or `404`)
- **Error responses** (400 for missing session, 404 for invalid session)

### 3.3 Configuration

```typescript
new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true,  // JSON instead of SSE for simple request/response
})
```

### 3.4 Compliance matrix

| Area | Status | Notes |
|------|--------|-------|
| Streamable HTTP transport | ✅ Compliant | Uses SDK's `WebStandardStreamableHTTPServerTransport` |
| Protocol version (2025-11-25) | ✅ Compliant | SDK handles version negotiation |
| Session ID (`crypto.randomUUID`) | ✅ Compliant | Cryptographically secure UUIDs |
| `initialize` | ✅ Compliant | Proper capabilities and headers |
| `notifications/initialized` | ✅ Compliant | Returns `202 Accepted` |
| Invalid session handling | ✅ Compliant | Returns `404 Not Found` |
| `tools/list` / `tools/call` | ✅ Compliant | SDK handles JSON schema conversion |
| `resources/list` / `resources/read` | ✅ Compliant | Registered via `server.resource()` template |
| SSE streaming | ✅ Supported | Available via `GET` with existing session |
| JSON response mode | ✅ Enabled | `enableJsonResponse: true` |
| Prompts | ❌ Not implemented | Not needed for this use case |
| Progress/cancellation | ❌ Not implemented | Not needed for this use case |

---

## Running locally

### Prerequisites

- Node.js 18+
- Postgres (Neon recommended)

### Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

App runs at `http://localhost:3002`.

---

## Available MCP tools

The current tool surface is implemented in `src/lib/mcp-server.ts`:

- **`list_products`**
- **`get_product`**
- **`recommend_products`**

UCP checkout tools:

- **`create_checkout`**
- **`get_checkout`**
- **`update_checkout`**
- **`complete_checkout`**
- **`cancel_checkout`**

These tools return either **UCP JSON** (checkout tools) or **UI resources** (HTML) designed to render in MCP UI hosts.

---

## UCP checkout flow (current demo)

This demo uses the UCP checkout capability end-to-end. The chat-host client renders the checkout card UI and invokes the MCP tools listed below as the user proceeds.

**Diagram:** `docs/ucp-checkout-flow.excalidraw` (open in Excalidraw)
**ECP Guide:** `docs/ucp-ecp.md`
**Compliance Notes:** `docs/ucp-compliance.md`
**Checkout API Notes:** `docs/ucp-checkout.md`

### Flow summary

1. **Browse & select plan**
   - The user discovers a product via `list_products`, `get_product`, or `recommend_products`.
2. **Start checkout**
   - The chat-host calls **`create_checkout`** with `line_items` (product ID as string).
   - The travel-insurance-mcp creates a checkout session and returns UCP JSON with `status` and `messages`.
3. **Ensure buyer info is present**
   - The chat-host injects mock buyer info (John Doe) on **`create_checkout`** and **`update_checkout`** requests.
   - If buyer data is missing or needs correction, the platform calls **`update_checkout`** to fix recoverable errors.
4. **Review + pay (trusted platform UI)**
   - The chat-host renders the checkout card and displays a mock **Pay Now** button when `status = ready_for_complete`.
   - Clicking Pay Now calls **`complete_checkout`** (after a short simulated delay).
5. **Order confirmation**
   - The MCP server returns a `completed` checkout with `order` metadata.
   - The chat-host renders the completed checkout card and order summary.
6. **Cancel (optional)**
   - If the user cancels, the chat-host calls **`cancel_checkout`**.

### Where each UCP checkout tool is called

- **`create_checkout`**
  - Triggered when the user clicks “Purchase this plan” in chat-host.
- **`get_checkout`**
  - Used by the assistant when it needs to refresh the checkout state (not currently invoked by UI buttons).
- **`update_checkout`**
  - Used to patch buyer data or recoverable issues from `messages`.
- **`complete_checkout`**
  - Invoked by the in-chat **Pay Now (Mock)** button when the checkout is `ready_for_complete`.
- **`cancel_checkout`**
  - Invoked if the user requests cancellation from the assistant.

> Note: UCP only defines the JSON checkout contract. In this demo, the platform (chat-host) renders a trusted UI and calls the UCP tools. The merchant UI handoff via `continue_url` is still supported for `requires_escalation` and as a fallback.

### Embedded Checkout (ECP) mode

When the checkout response includes an embedded service binding (`ucp.services[transport="embedded"]`), the platform should embed the merchant’s `continue_url` in an iframe and use ECP messages to delegate payment.

- Merchant-hosted checkout: `GET /checkout/[id]` (this app)
- Host embedding: `continue_url?ec_version=2026-01-11&ec_delegate=payment.instruments_change,payment.credential`
- Delegated payment: host responds to `ec.payment.instruments_change_request` and `ec.payment.credential_request` with tokenized credentials

---

## HTTP endpoints (current)

### MCP

- `POST /api/mcp`
- `GET /api/mcp` (status)
- `DELETE /api/mcp` (session cleanup)
- `OPTIONS /api/mcp` (CORS)

### Feed

- `GET /api/feed`
  - Returns JSONL (`application/x-ndjson`)
  - Optional gzip: `?compress=true` returns `application/gzip`

### Merchant

- `GET /merchant` (UI)
- `GET /merchant/products/[id]` (UI)
- `GET /api/merchant/products`
- `POST /api/merchant/products`
- `GET /api/merchant/products/:id`
- `PATCH /api/merchant/products/:id`
- `DELETE /api/merchant/products/:id`

---

## Database (current)

### Tables

- `products`
- `product_media`
- `orders`

Notes:

- `products.price` and `products.discountPrice` are stored as **decimal strings** (Drizzle `decimal(10,2)`)
- `orders.totalPrice` is also decimal

---

## License

MIT
