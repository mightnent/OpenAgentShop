# OpenAgentShop SDK

This is the OpenAgentShop SDK - a tool for generating MCP-UI ready and UCP-compliant agentic commerce Next.js apps from a product catalog JSON.

## Key Files

- `INSTRUCTIONS.md` - **START HERE** for AI agents building shops (step-by-step workflow)
- `src/index.ts` - Main SDK entry point (exports all public APIs)
- `src/types/product-catalog.ts` - Product Catalog JSON specification types
- `src/types/config.ts` - SDK configuration types
- `src/types/ucp.ts` - UCP protocol types
- `src/core/` - Core generators (schema, MCP server, UCP checkout, MCP-UI, feed, currency)
- `src/handlers/` - Next.js route handler generators
- `src/cli/` - CLI scaffolding tool
- `templates/example-catalog.json` - Example product catalog
- `skills/SKILL.md` - Advanced AI agent patterns and code examples
- `examples/` - Complete reference implementations
- `references/` - Implementation patterns and notes
- `docs/` - Comprehensive documentation

## UCP Reference

Always check the latest UCP docs when making changes to checkout or payment logic:
- Local: /Users/mikesun/Documents/projects/agentic-commerce-discovery/ucp/docs
- Online: https://ucp.dev/2026-01-23/

## Reference Implementation

The travel-insurance-mcp at `/Users/mikesun/Documents/projects/agentic-commerce-discovery/travel-insurance-mcp` is the reference implementation. The SDK extracts patterns from this implementation and makes them reusable.

## Architecture

The SDK is a code generator. It takes a ProductCatalog JSON and generates a complete Next.js project with:
1. Drizzle ORM schema + seed file (from catalog products and custom attributes)
2. MCP server with auto-generated tools (from catalog schema)
3. MCP-UI HTML renderers (styled based on catalog branding)
4. UCP checkout session manager (with configurable tax, currency, payment handlers)
5. Merchant center UI
6. Commerce feed endpoint
7. UCP profile discovery endpoint
