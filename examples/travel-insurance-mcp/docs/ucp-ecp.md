# Embedded Checkout (ECP) Guide

This app acts as the **merchant** and hosts the embedded checkout page at:

- `GET /checkout/[id]` → used as the UCP `continue_url`

The platform/host (chat-host) **embeds** that page and optionally delegates payment via the ECP message protocol.

---

## 1) Merchant responsibilities (travel-insurance-mcp)

### Discovery

The merchant advertises embedded support in `/.well-known/ucp`:

- `services["dev.ucp.shopping"][transport="embedded"]`

### Checkout response

Checkout responses include a per-session embedded service binding:

```json
{
  "ucp": {
    "services": {
      "dev.ucp.shopping": [
        {
          "transport": "embedded",
          "config": {
            "delegate": ["payment.instruments_change", "payment.credential"]
          }
        }
      ]
    }
  },
  "continue_url": "https://merchant.example/checkout/{id}"
}
```

### Embedded checkout page

The embedded checkout (`/checkout/[id]`) implements:

The embedded checkout (`/checkout/[id]`) handles:

- `ec.ready` (handshake)
- `ec.start` (start event)
- `ec.payment.instruments_change_request` (delegated payment selection)
- `ec.payment.credential_request` (delegated payment authorization)
- `ec.complete` (success)

If the host does not delegate payment, the merchant page can run a local (non-delegated) completion flow.

---

## 2) Host responsibilities (chat-host)

### Embed the merchant checkout URL

```text
{continue_url}?ec_version=2026-01-11&ec_delegate=payment.instruments_change,payment.credential
```

### Respond to delegated payment requests

The host handles:

- `ec.payment.instruments_change_request`
  - Show payment selection UI
  - Return selected instrument (tokenized handler)
- `ec.payment.credential_request`
  - Show trusted payment UI
  - Return token credential

### Minimal payment instrument example

```json
{
  "payment": {
    "instruments": [
      {
        "id": "payment_instrument_123",
        "handler_id": "mock_handler_1",
        "type": "token",
        "selected": true,
        "credential": {
          "type": "mock_token",
          "token": "tok_demo"
        }
      }
    ]
  }
}
```

---

## 3) Environment flags

- `ECP_ENABLED` (default: true): enable/disable embedded binding in checkout responses
- `UCP_STRICT` (default: false): enforce strict request/response rules
- `NEXT_PUBLIC_BASE_URL` must be `https://...` when `UCP_STRICT=true`

## 4) Troubleshooting

**Compliance scan says "Missing dev.ucp.shopping embedded service entry (ECP)"**
- This means the `/ .well-known/ucp` profile does not advertise the embedded service binding.
- Ensure `services["dev.ucp.shopping"][]` contains `transport: "embedded"` with `spec` and `schema` pointing to `https://ucp.dev/...`.

**Embedded checkout doesn’t respond to messages**
- Confirm `ec_version` is present in the URL.
- Ensure the host is posting JSON‑RPC to the embedded iframe’s origin.
- Verify that `ec_delegate` only includes delegations allowed by the merchant (`config.delegate`).
