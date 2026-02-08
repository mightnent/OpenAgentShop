#!/usr/bin/env node
/**
 * OpenAgentShop CLI
 *
 * Usage:
 *   npx open-agent-shop init --catalog catalog.json --output ./my-shop
 *   npx open-agent-shop init --catalog catalog.json  # outputs to ./shop-name
 *   npx open-agent-shop ucp:check https://your-shop.com
 */

import * as fs from "fs";
import * as path from "path";
import { generateProject } from "./scaffold";
import type { ProductCatalog } from "../types/product-catalog";

const args = process.argv.slice(2);
const command = args[0];

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

function printHelp() {
  console.log(`
OpenAgentShop CLI - Build agentic commerce apps

Usage:
  open-agent-shop init --catalog <path> [--output <dir>] [--provider <neon|postgres>]
  open-agent-shop ucp:check <baseUrl>

Commands:
  init    Generate a new Next.js project from a product catalog JSON
  ucp:check  Validate /.well-known/ucp and print compliance hints

Options:
  --catalog   Path to product catalog JSON file (required)
  --output    Output directory (default: ./<shop-name>)
  --provider  Database provider: neon, postgres, supabase (default: neon)
  --help      Show this help message

Examples:
  open-agent-shop init --catalog my-products.json
  open-agent-shop init --catalog catalog.json --output ./my-store --provider postgres
  open-agent-shop ucp:check http://localhost:3000
`);
}

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

async function runUcpCheck(baseUrl: string) {
  const profileUrl = new URL("/.well-known/ucp", baseUrl).toString();
  const res = await fetch(profileUrl);
  if (!res.ok) {
    console.error(`Error: Failed to fetch ${profileUrl} (${res.status})`);
    process.exit(1);
  }
  const profile = (await res.json()) as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  const ucp = (profile.ucp || {}) as Record<string, unknown>;
  const version = typeof ucp.version === "string" ? ucp.version : undefined;
  if (!version) errors.push("Missing ucp.version");

  const services = (ucp.services || {}) as Record<string, unknown>;
  const shoppingServices = Array.isArray(services["dev.ucp.shopping"])
    ? (services["dev.ucp.shopping"] as Array<Record<string, unknown>>)
    : [];

  const isUcpDevUrl = (url?: string) => {
    if (!url) return false;
    try {
      return new URL(url).origin === "https://ucp.dev";
    } catch {
      return false;
    }
  };

  const mcpService = shoppingServices.find((svc) => svc.transport === "mcp");
  const embeddedService = shoppingServices.find((svc) => svc.transport === "embedded");
  if (!mcpService) {
    errors.push("Missing dev.ucp.shopping MCP service entry");
  } else {
    if (!isUcpDevUrl(mcpService.spec as string)) errors.push("MCP service spec must be a https://ucp.dev URL");
    if (!isUcpDevUrl(mcpService.schema as string)) errors.push("MCP service schema must be a https://ucp.dev URL");
    if (typeof mcpService.endpoint !== "string") errors.push("MCP service missing endpoint");
  }

  if (!embeddedService) {
    warnings.push("Missing dev.ucp.shopping embedded service entry (ECP)");
  } else {
    if (!isUcpDevUrl(embeddedService.spec as string)) errors.push("Embedded service spec must be a https://ucp.dev URL");
    if (!isUcpDevUrl(embeddedService.schema as string)) errors.push("Embedded service schema must be a https://ucp.dev URL");
  }

  const capabilities = (ucp.capabilities || {}) as Record<string, unknown>;
  const checkoutCaps = Array.isArray(capabilities["dev.ucp.shopping.checkout"])
    ? (capabilities["dev.ucp.shopping.checkout"] as Array<Record<string, unknown>>)
    : [];
  const checkoutCap = checkoutCaps[0];
  if (!checkoutCap) {
    errors.push("Missing dev.ucp.shopping.checkout capability");
  } else {
    if (!isUcpDevUrl(checkoutCap.schema as string)) errors.push("Checkout capability schema must be a https://ucp.dev URL");
    if (!isUcpDevUrl(checkoutCap.spec as string)) errors.push("Checkout capability spec must be a https://ucp.dev URL");
  }

  console.log(`\nUCP check for ${baseUrl}`);
  console.log(`Profile: ${profileUrl}`);
  if (version) console.log(`UCP version: ${version}`);

  if (errors.length === 0) {
    console.log("✅ Passed required checks");
  } else {
    console.log("❌ Required checks failed:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  if (warnings.length > 0) {
    console.log("⚠️  Warnings:");
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

if (command === "init") {
  const catalogPath = getArg("--catalog");
  if (!catalogPath) {
    console.error("Error: --catalog flag is required");
    console.error("Usage: open-agent-shop init --catalog <path>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(catalogPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Catalog file not found: ${resolvedPath}`);
    process.exit(1);
  }

  let catalog: ProductCatalog;
  try {
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    catalog = JSON.parse(raw);
  } catch (err) {
    console.error(`Error: Failed to parse catalog JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!catalog.shop || !catalog.products) {
    console.error("Error: Catalog must contain 'shop' and 'products' fields");
    process.exit(1);
  }

  const shopSlug = catalog.shop.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const outputDir = getArg("--output") ?? `./${shopSlug}`;
  const provider = (getArg("--provider") as "neon" | "postgres" | "supabase") ?? "neon";

  generateProject(catalog, outputDir, {
    database: { provider },
  });
} else if (command === "ucp:check") {
  const baseUrl = args[1];
  if (!baseUrl) {
    console.error("Error: baseUrl is required");
    console.error("Usage: open-agent-shop ucp:check <baseUrl>");
    process.exit(1);
  }
  runUcpCheck(baseUrl)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    });
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}
