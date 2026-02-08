# Embedded Checkout (ECP)

OpenAgentShop generates a merchant app that supports the **Embedded Checkout Protocol (ECP)**. The host (e.g., `chat-host`) embeds the merchant’s `continue_url` and optionally delegates payment handling via ECP messages.

## Merchant Responsibilities

- Serve a UCP profile that advertises `transport: "embedded"` under `ucp.services["dev.ucp.shopping"]`.
- Return `continue_url` in checkout responses.
- Implement the embedded checkout page at `/checkout/[id]`:
  - Send `ec.ready` (request) with accepted delegations.
  - Send `ec.start` (notification) once ready.
  - If delegating payment, send `ec.payment.credential_request` and wait for host response.
  - Send `ec.complete` (notification) after order completion.

## Host Responsibilities

- Embed the `continue_url` in an iframe/webview.
- Append ECP query parameters:
  - `ec_version=2026-01-11` (required)
  - `ec_delegate=payment.instruments_change,payment.credential` (optional)
- Respond to delegation requests (`ec.payment.credential_request`, etc.).

## Suggested Test Flow (with chat-host)

1. Start merchant app locally: `npm run dev`
2. Ensure `/.well-known/ucp` includes `transport: "embedded"`
3. In `chat-host`, connect to merchant MCP server and open checkout
4. Verify:
   - Checkout UI loads in embedded frame
   - `ec.ready` → host responds
   - Payment delegation works (credential request)
   - `ec.complete` fires and order is created

## Notes

- ECP is **transport** only; the checkout data model is still UCP checkout.
- `UCP_STRICT=true` enforces HTTPS for non-localhost.
