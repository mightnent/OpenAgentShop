# UCP Checkout (MCP Binding) – Implementation Notes

This document describes how `travel-insurance-mcp` implements the UCP Checkout capability and how hosts should call it.

## 1) Tools and parameters

Required tools:

- `create_checkout(meta, checkout)`
- `get_checkout(meta, id)`
- `update_checkout(meta, id, checkout)`
- `complete_checkout(meta, id, checkout, idempotency_key)`
- `cancel_checkout(meta, id)`

### `meta`

```json
{
  "ucp-agent": { "profile": "https://platform.example/profiles/agent.json" },
  "idempotency-key": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `checkout` (request shape)

Minimal create payload:

```json
{
  "line_items": [{ "item": { "id": "123" }, "quantity": 1 }],
  "buyer": { "email": "jane@example.com", "first_name": "Jane", "last_name": "Doe" }
}
```

Complete payload for `complete_checkout`:

```json
{
  "payment": {
    "instruments": [
      {
        "id": "payment_instrument_123",
        "handler_id": "mock_handler_1",
        "type": "token",
        "selected": true,
        "credential": { "type": "mock_token", "token": "tok_demo" }
      }
    ]
  }
}
```

## 2) Strict vs compat mode

Environment:

- `UCP_STRICT=true` enforces strict request requirements:
  - `update_checkout` requires `line_items`
  - `complete_checkout` requires `payment.instruments[*].credential`
  - `NEXT_PUBLIC_BASE_URL` must be `https://...`
- `UCP_STRICT=false` allows compatibility with older clients

## 3) Checkout response expectations

Every response includes:

- `ucp`, `id`, `line_items`, `status`, `currency`, `totals`, `links`
- `continue_url` for escalation or embedded checkout
- `expires_at` for TTL

Terminal statuses (`completed`, `canceled`) omit `continue_url`.

## 4) Embedded Checkout (ECP)

If `ucp.services[transport="embedded"]` is present in the checkout response, hosts should embed:

```
{continue_url}?ec_version=2026-01-11&ec_delegate=payment.instruments_change,payment.credential
```

See `docs/ucp-ecp.md` for the ECP message flow.
