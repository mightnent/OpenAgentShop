# Migration Guide (OpenAgentShop UCP Revamp)

This release updates OpenAgentShop’s UCP shapes and generated checkout behavior to match the official schemas and ECP flow.

## Breaking Changes

### 1) UCP JSON shapes
- `messages[].message` → `messages[].content`
- `links[].href` → `links[].url`
- `/.well-known/ucp` is now nested under a top-level `ucp` object

### 2) Checkout tools input shape
- `update_checkout` now accepts `checkout` object (not top-level `buyer`/`line_items`)
- `complete_checkout` now accepts `checkout` object and `idempotency_key`

### 3) ECP default
- Generated shops **always** provide a `continue_url` and embedded checkout page.

## How to Update Existing Hosts

- Update any parsing logic to use `messages[].content`.
- Update link parsing to use `links[].url`.
- Update compliance validators to read `profile.ucp.services` instead of top-level `services`.

## How to Update Existing Merchants

- Regenerate the project with the latest OpenAgentShop.
- Ensure `/.well-known/ucp` includes `transport: "embedded"`.
- Update any custom checkout UI to handle ECP messages.
