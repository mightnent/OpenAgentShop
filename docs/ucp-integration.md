# UCP Integration

OpenAgentShop implements the [Universal Commerce Protocol (UCP)](https://ucp.dev) for standardized agentic commerce. This document covers the UCP implementation details and how to configure it for production use.

## UCP Overview

UCP is an open standard protocol (version 2026-01-11) that enables AI agents, apps, and services to discover businesses and complete purchases. OpenAgentShop implements the **Checkout** capability via MCP transport.

### Key Concepts

- **Capabilities:** Standalone features (Checkout, Order, Identity Linking)
- **Extensions:** Optional modules (Fulfillment, Discounts, AP2 Mandates, Buyer Consent)
- **Payment Handlers:** Specifications for how payment instruments are acquired and processed
- **Services:** Transport bindings (REST, MCP, A2A, Embedded)

## Implemented Capability

### `dev.ucp.shopping.checkout`

The Checkout capability enables platforms to create, manage, and complete checkout sessions.

**Status lifecycle:**

```
incomplete ──────────► ready_for_complete ──────► completed
     │
     ├──► requires_escalation (needs buyer action via continue_url)
     │
     └──► canceled (from any non-terminal state)
```

**MCP Tool mapping:**

| MCP Tool | UCP Operation | REST Equivalent |
|----------|---------------|-----------------|
| `create_checkout` | Create session | `POST /checkout-sessions` |
| `get_checkout` | Read session | `GET /checkout-sessions/{id}` |
| `update_checkout` | Update session | `PUT /checkout-sessions/{id}` |
| `complete_checkout` | Complete/place order | `POST /checkout-sessions/{id}/complete` |
| `cancel_checkout` | Cancel session | `POST /checkout-sessions/{id}/cancel` |

### Checkout Data Structure

Every checkout response follows the UCP envelope format:

```json
{
  "ucp": {
    "version": "2026-01-11",
    "capabilities": {
      "dev.ucp.shopping.checkout": [{ "version": "2026-01-11" }]
    },
    "payment_handlers": {
      "com.demo.mock_payment": [{
        "id": "mock_handler_1",
        "version": "2026-01-11",
        "config": {}
      }]
    }
  },
  "id": "checkout_abc123",
  "status": "incomplete",
  "currency": "USD",
  "buyer": { "email": "...", "first_name": "...", "last_name": "..." },
  "line_items": [
    {
      "id": "li_1",
      "item": { "id": "42", "title": "Product", "price": 2999 },
      "quantity": 1,
      "totals": [
        { "type": "subtotal", "amount": 2999 },
        { "type": "total", "amount": 2999 }
      ]
    }
  ],
  "totals": [
    { "type": "subtotal", "amount": 2999 },
    { "type": "tax", "amount": 240 },
    { "type": "total", "amount": 3239 }
  ],
  "messages": [],
  "continue_url": "http://localhost:3000/checkout/checkout_abc123"
}
```

### Error Messages

The checkout manager returns structured error messages with severity levels:

| Code | Severity | Description |
|------|----------|-------------|
| `empty_cart` | `recoverable` | No line items in checkout |
| `item_not_found` | `recoverable` | Product ID doesn't exist |
| `item_unavailable` | `recoverable` | Product is inactive |
| `missing_buyer_email` | `requires_buyer_input` | Email not provided |
| `missing_buyer_first_name` | `requires_buyer_input` | First name not provided |
| `missing_buyer_last_name` | `requires_buyer_input` | Last name not provided |
| `checkout_immutable` | `recoverable` | Attempting to modify completed/canceled checkout |
| `checkout_not_ready` | `recoverable` | Attempting to complete when status != ready_for_complete |
| `checkout_not_cancelable` | `recoverable` | Attempting to cancel completed/canceled checkout |

Platforms handle severity as follows:
- `recoverable` - Fix via API and retry automatically
- `requires_buyer_input` - Prompt the buyer for information
- `requires_buyer_review` - Direct buyer to `continue_url`

## UCP Profile Discovery

The generated app serves a UCP profile at `/.well-known/ucp`:

```json
{
  "version": "2026-01-11",
  "business": {
    "name": "My Store",
    "url": "http://localhost:3000"
  },
  "capabilities": {
    "dev.ucp.shopping.checkout": [{ "version": "2026-01-11" }]
  },
  "services": {
    "dev.ucp.mcp": [{
      "version": "2025-11-25",
      "endpoint": "http://localhost:3000/api/mcp"
    }]
  },
  "payment_handlers": { ... }
}
```

## Configuration

### UCP Settings

```typescript
generateProject(catalog, "./my-store", {
  ucp: {
    version: "2026-01-11",
    capabilities: ["dev.ucp.shopping.checkout"],
    extensions: ["fulfillment", "discount"],
    paymentHandlers: {
      "com.google.pay": [{
        id: "gpay_production",
        version: "2026-01-11",
        config: {
          api_version: 2,
          merchant_id: "your_merchant_id",
          environment: "PRODUCTION"
        }
      }]
    }
  }
});
```

### Payment Handlers

By default, a mock payment handler is configured for development. For production, replace it with a real payment handler:

**Google Pay:**
```json
{
  "com.google.pay": [{
    "id": "gpay_1",
    "version": "2026-01-11",
    "spec": "https://pay.google.com/ucp/handler-spec",
    "config": {
      "api_version": 2,
      "merchant_id": "YOUR_MERCHANT_ID",
      "environment": "PRODUCTION",
      "allowed_card_networks": ["VISA", "MASTERCARD"],
      "allowed_auth_methods": ["PAN_ONLY", "CRYPTOGRAM_3DS"]
    }
  }]
}
```

**Stripe Tokenizer:**
```json
{
  "com.stripe.tokenizer": [{
    "id": "stripe_1",
    "version": "2026-01-11",
    "config": {
      "publishable_key": "pk_live_..."
    }
  }]
}
```

### Extensions

Enable UCP extensions for additional functionality:

| Extension | Key | Description |
|-----------|-----|-------------|
| Fulfillment | `fulfillment` | Shipping methods, pickup options, delivery destinations |
| Discount | `discount` | Discount codes and automatic discounts |
| AP2 Mandates | `ap2_mandate` | Cryptographic proof of authorization for autonomous agents |
| Buyer Consent | `buyer_consent` | GDPR/CCPA privacy consent management |

## Production Checklist

- [ ] Replace mock payment handler with a production handler
- [ ] Restrict CORS origins (modify `next.config.js`)
- [ ] Add authentication to merchant API routes
- [ ] Implement proper idempotency for checkout completion
- [ ] Set `NEXT_PUBLIC_BASE_URL` to your production domain
- [ ] Configure SSL/TLS (UCP requires HTTPS in production)
- [ ] Implement webhook endpoints for order fulfillment updates
- [ ] Add monitoring and logging

## UCP Resources

- [UCP Specification](https://ucp.dev/2026-01-23/) - Full protocol specification
- [UCP Checkout Reference](https://ucp.dev/specification/checkout) - Checkout capability details
- [Payment Handler Guide](https://ucp.dev/specification/payment-handler-guide) - Building payment integrations
