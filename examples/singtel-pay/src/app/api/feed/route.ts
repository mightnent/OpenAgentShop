import { NextResponse } from "next/server";
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
