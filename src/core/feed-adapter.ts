/**
 * Commerce Feed Adapter Generator
 *
 * Generates an OpenAI-compatible commerce feed adapter based on
 * the product catalog. Outputs JSONL format at /api/feed.
 */

import type { ProductCatalog } from "../types/product-catalog";
import type { FeedConfig } from "../types/config";

/**
 * Generate the feed adapter and route handler source code.
 */
export function generateFeedAdapterSource(
  catalog: ProductCatalog,
  feedConfig?: FeedConfig
): string {
  const shopName = catalog.shop.name;
  const shopUrl = catalog.shop.url;
  const merchantName = feedConfig?.merchantName ?? shopName;
  const defaultBrand = feedConfig?.defaultBrand ?? shopName;
  const enableCheckout = feedConfig?.enableCheckout ?? false;
  const productCategory = feedConfig?.productCategory ?? "General";
  const termsUrl = catalog.shop.policies?.terms_url ?? `${shopUrl}/terms`;
  const privacyUrl = catalog.shop.policies?.privacy_url ?? `${shopUrl}/privacy`;
  const returnUrl = catalog.shop.policies?.return_url ?? `${shopUrl}/returns`;
  const returnWindowDays = catalog.shop.policies?.return_window_days ?? 14;
  const currency = catalog.shop.currency ?? "USD";

  return `import { formatPriceForFeed } from "@/lib/currency";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ${JSON.stringify(shopUrl)};
const CURRENCY = ${JSON.stringify(currency)};

interface FeedProduct {
  id: number;
  catalogId: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  discountPrice: number | null;
  active: boolean;
  currency: string;
  category?: string | null;
  media?: Array<{ url: string; alt: string | null }>;
}

interface OpenAIProductFeed {
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;
  item_id: string;
  title: string;
  description: string;
  url: string;
  image_url: string;
  price: string;
  sale_price?: string;
  availability: "in_stock" | "out_of_stock";
  brand: string;
  condition: "new";
  product_category: string;
  group_id: string;
  listing_has_variations: boolean;
  merchant_name: string;
  merchant_url: string;
  terms_url: string;
  privacy_policy_url: string;
  is_returnable: boolean;
  return_window_days: number;
  return_policy_url: string;
}

export function transformProductToFeed(product: FeedProduct): OpenAIProductFeed {
  const itemId = product.catalogId || \`PROD-\${product.id}\`;
  const imageUrl = product.media?.[0]?.url || \`\${BASE_URL}/placeholder.png\`;

  const description = [
    product.description || product.shortDescription || product.name,
  ].join(" ");

  const feed: OpenAIProductFeed = {
    is_eligible_search: product.active,
    is_eligible_checkout: ${enableCheckout},
    item_id: itemId,
    title: product.name,
    description,
    url: \`\${BASE_URL}/products/\${product.id}\`,
    image_url: imageUrl,
    price: formatPriceForFeed(product.price, product.currency || CURRENCY),
    availability: product.active ? "in_stock" : "out_of_stock",
    brand: ${JSON.stringify(defaultBrand)},
    condition: "new",
    product_category: product.category || ${JSON.stringify(productCategory)},
    group_id: itemId,
    listing_has_variations: false,
    merchant_name: ${JSON.stringify(merchantName)},
    merchant_url: BASE_URL,
    terms_url: ${JSON.stringify(termsUrl)},
    privacy_policy_url: ${JSON.stringify(privacyUrl)},
    is_returnable: true,
    return_window_days: ${returnWindowDays},
    return_policy_url: ${JSON.stringify(returnUrl)},
  };

  if (product.discountPrice) {
    feed.sale_price = formatPriceForFeed(product.discountPrice, product.currency || CURRENCY);
  }

  return feed;
}

export function toJSONL(products: FeedProduct[]): string {
  return products
    .map((p) => JSON.stringify(transformProductToFeed(p)))
    .join("\\n");
}
`;
}

/**
 * Generate the /api/feed route handler source code.
 */
export function generateFeedRouteSource(): string {
  return `import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productMedia } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toJSONL } from "@/lib/feed-adapter";
import { gzipSync } from "zlib";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const compress = searchParams.get("compress") === "true";

  const allProducts = await db
    .select()
    .from(products)
    .where(activeOnly ? eq(products.active, true) : undefined);

  // Fetch media for all products
  const allMedia = await db.select().from(productMedia).orderBy(productMedia.sortOrder);
  const mediaMap = new Map<number, typeof allMedia>();
  for (const m of allMedia) {
    const existing = mediaMap.get(m.productId) ?? [];
    existing.push(m);
    mediaMap.set(m.productId, existing);
  }

  const productsWithMedia = allProducts.map((p) => ({
    ...p,
    media: mediaMap.get(p.id) ?? [],
  }));

  const jsonl = toJSONL(productsWithMedia);

  if (compress) {
    const compressed = gzipSync(Buffer.from(jsonl));
    return new NextResponse(compressed, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Encoding": "gzip",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return new NextResponse(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "public, max-age=300",
    },
  });
}
`;
}
