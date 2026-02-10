# UCP Compliance Notes (travel-insurance-mcp)

This project implements the UCP Checkout capability over MCP and provides an Embedded Checkout (ECP) page at `GET /checkout/[id]`.

## 1) Required tools (UCP MCP binding)

The server must expose the following tools:

- `create_checkout`
- `get_checkout`
- `update_checkout`
- `complete_checkout`
- `cancel_checkout`

## 2) Discovery profile

The merchant profile lives at:

```
/.well-known/ucp
```

It must include:

- `services["dev.ucp.shopping"]` entries for:
  - `transport: "mcp"`
  - `transport: "embedded"` (ECP)
- `capabilities["dev.ucp.shopping.checkout"]`
- `payment_handlers` (at least one handler)

## 3) Checkout response requirements

Each checkout response must include:

- `ucp`, `id`, `line_items`, `status`, `currency`, `totals`, `links`
- `continue_url` when status is `requires_escalation`
- `expires_at` (recommended)

For terminal statuses (`completed`, `canceled`) the `continue_url` should be omitted.

## 4) Strict vs compat mode

Environment flags:

- `UCP_STRICT=true` enforces strict request requirements
- `UCP_STRICT=false` allows compatibility with older clients

When strict is enabled:

- `update_checkout` requires `line_items`
- `complete_checkout` requires a `payment.instruments[*].credential` token
- `NEXT_PUBLIC_BASE_URL` must be `https://...`

## 5) ECP (Embedded Checkout)

If the checkout response includes `ucp.services[transport="embedded"]`, the host should embed the merchant `continue_url` and use ECP message delegation for payment.

See `docs/ucp-ecp.md` for the detailed message flow.
