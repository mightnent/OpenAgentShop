/**
 * UCP (Universal Commerce Protocol) Types
 *
 * Re-exports canonical types from @ucp-js/sdk.
 * Adds MCP-binding-specific types not covered by the SDK.
 */

// Re-export all SDK types and schemas
export * from "@ucp-js/sdk";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

import type { CheckoutResponseStatus } from "@ucp-js/sdk";

export const TERMINAL_STATUSES: CheckoutResponseStatus[] = [
  "completed",
  "canceled",
];

// ---------------------------------------------------------------------------
// MCP Binding Types (not in the SDK)
// ---------------------------------------------------------------------------

/** MCP request metadata — required on all UCP MCP tool calls */
export interface UcpMcpMeta {
  "ucp-agent": {
    profile: string;
  };
  "idempotency-key"?: string;
}

/**
 * UCP sub-object in checkout responses.
 *
 * This is the `ucp` block inside a checkout response, NOT the discovery
 * profile. It contains capabilities and payment handlers but NOT services
 * (services are discovery-only at /.well-known/ucp).
 *
 * Capabilities are keyed by name (Record), matching the spec wire format.
 */
export interface CheckoutUcp {
  version: string;
  capabilities: Record<string, Array<{ version: string }>>;
  payment_handlers?: Record<
    string,
    Array<{
      id: string;
      version: string;
      available_instruments?: Array<{
        type: string;
        constraints?: Record<string, unknown>;
      }>;
      config: Record<string, unknown>;
    }>
  >;
}
