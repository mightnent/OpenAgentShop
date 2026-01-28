#!/usr/bin/env node
/**
 * OpenAgentShop CLI
 *
 * Usage:
 *   npx open-agent-shop init --catalog catalog.json --output ./my-shop
 *   npx open-agent-shop init --catalog catalog.json  # outputs to ./shop-name
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

Commands:
  init    Generate a new Next.js project from a product catalog JSON

Options:
  --catalog   Path to product catalog JSON file (required)
  --output    Output directory (default: ./<shop-name>)
  --provider  Database provider: neon, postgres, supabase (default: neon)
  --help      Show this help message

Examples:
  open-agent-shop init --catalog my-products.json
  open-agent-shop init --catalog catalog.json --output ./my-store --provider postgres
`);
}

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
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
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}
