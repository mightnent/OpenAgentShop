# Roadmap

This document outlines what OpenAgentShop supports today and what's planned for future releases.

## Current State (v0.1.0)

### What's Implemented

#### Core SDK
- [x] Product Catalog JSON specification with custom attributes, tiers, and categories
- [x] Code generation from catalog → complete Next.js project
- [x] CLI tool (`open-agent-shop init`)
- [x] TypeScript types for all data structures
- [x] AI agent skill for automated shop creation

#### MCP (Model Context Protocol)
- [x] MCP Streamable HTTP transport (spec 2025-11-25)
- [x] Session-per-connection server architecture
- [x] Auto-generated product discovery tools (`list_products`, `get_product`, `recommend_products`)
- [x] Auto-generated UCP checkout tools (create, get, update, complete, cancel)
- [x] CORS headers for cross-origin MCP clients

#### MCP-UI
- [x] Product list component (scrollable card grid)
- [x] Product detail component (full info card)
- [x] Recommendations component (ranked list)
- [x] Order confirmation component
- [x] Dual delivery mode (classic + MCP Apps resources)
- [x] Theme customization (colors, fonts, border radius)
- [x] Custom attribute display (list and detail views)
- [x] Interactive buttons via postMessage (tool invocation from UI)

#### UCP (Universal Commerce Protocol)
- [x] `dev.ucp.shopping.checkout` capability (v2026-01-11)
- [x] Full checkout lifecycle (incomplete → ready_for_complete → completed/canceled)
- [x] Status evaluation with structured error messages
- [x] Line item resolution (by ID and catalog slug)
- [x] Totals calculation with configurable tax rate
- [x] `/.well-known/ucp` profile discovery endpoint
- [x] Mock payment handler for development

#### Database
- [x] Drizzle ORM schema generation from catalog
- [x] Seed file generation from catalog products
- [x] Support for Neon, standard PostgreSQL, and Supabase
- [x] Custom attribute → database column mapping
- [x] Four core tables: products, product_media, orders, checkout_sessions

#### Commerce Feed
- [x] OpenAI-compatible JSONL feed endpoint (`/api/feed`)
- [x] Gzip compression support
- [x] Active-only filtering

#### Merchant Center
- [x] Product list with active/inactive toggle
- [x] Product deletion
- [x] Order list with status badges
- [x] Basic product CRUD API

---

## Near-Term (v0.2.0)

### AP2 Mandates Extension
- [ ] `dev.ucp.shopping.ap2_mandate` extension support
- [ ] JWS signature verification on checkout responses
- [ ] Checkout mandate generation and validation
- [ ] Payment mandate handling (SD-JWT-VC)
- [ ] Autonomous agent payment flow

### Fulfillment Extension
- [ ] `dev.ucp.shopping.fulfillment` extension support
- [ ] Shipping method selection in checkout
- [ ] Pickup option support
- [ ] Destination address management
- [ ] Delivery group/package handling

### Discount Extension
- [ ] `dev.ucp.shopping.discount` extension support
- [ ] Discount code submission
- [ ] Automatic discount surfacing
- [ ] Discount stacking with priority
- [ ] Per-line-item allocation

### Buyer Consent Extension
- [ ] `dev.ucp.shopping.buyer_consent` extension support
- [ ] GDPR/CCPA consent management
- [ ] Marketing opt-in/out
- [ ] Analytics consent

---

## Mid-Term (v0.3.0)

### Order Capability
- [ ] `dev.ucp.shopping.order` capability
- [ ] Order detail view with fulfillment tracking
- [ ] Fulfillment events (processing, shipped, delivered)
- [ ] Post-order adjustments (refunds, returns, cancellations)
- [ ] Order status webhooks

### Identity Linking
- [ ] `dev.ucp.common.identity_linking` capability
- [ ] OAuth 2.0 Authorization Code flow
- [ ] Token management (issuance, refresh, revocation)
- [ ] Scoped access (`ucp:scopes:checkout_session`)
- [ ] Customer account creation

### Payment Handler Integrations
- [ ] Google Pay handler (`com.google.pay`)
- [ ] Stripe tokenizer handler
- [ ] Shop Pay handler (`dev.shopify.shop_pay`)
- [ ] 3DS challenge flow support
- [ ] PCI-DSS scope management documentation

### Enhanced MCP-UI
- [ ] Image carousel component
- [ ] Product comparison view
- [ ] Cart/basket summary component
- [ ] Checkout progress stepper
- [ ] Dark mode support
- [ ] Responsive mobile layouts

---

## Long-Term (v1.0.0)

### Multi-Transport Support
- [ ] REST service binding (OpenAPI 3.x generation)
- [ ] A2A (Agent2Agent) service binding
- [ ] Embedded Protocol (iframe/webview) binding
- [ ] Webhook support for async events

### Advanced Features
- [ ] Product variants (sizes, colors, configurations)
- [ ] Inventory tracking and stock management
- [ ] Multi-currency support with live exchange rates
- [ ] Localization (i18n) for MCP-UI components
- [ ] Search with full-text indexing
- [ ] Analytics dashboard in merchant center

### SDK Improvements
- [ ] Runtime library mode (no code generation, just import and configure)
- [ ] Plugin system for extending capabilities
- [ ] Template marketplace for MCP-UI themes
- [ ] Testing utilities (mock MCP client, checkout simulators)
- [ ] Migration tools for schema changes

### Ecosystem
- [ ] Shopify catalog importer
- [ ] WooCommerce catalog importer
- [ ] Stripe/Square catalog importer
- [ ] Web scraper tool for catalog extraction
- [ ] Catalog validation tool
- [ ] MCP-UI component playground

---

## Contributing

The SDK is open source. Contributions welcome for:
- New UCP extension implementations
- Payment handler integrations
- MCP-UI component designs
- Catalog importers for popular platforms
- Documentation improvements

---

## Version Compatibility

| SDK Version | UCP Version | MCP Spec | Next.js |
|-------------|-------------|----------|---------|
| 0.1.0 | 2026-01-11 | 2025-11-25 | 14+ |
| 0.2.0 (planned) | 2026-01-11 | 2025-11-25 | 14+ |
| 0.3.0 (planned) | 2026-01-11+ | 2025-11-25+ | 14+ |
