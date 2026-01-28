import { NextRequest, NextResponse } from "next/server";
import { gzipSync } from "zlib";
import { db } from "@/db";
import { products, productMedia } from "@/db/schema";
import { TravelInsuranceAdapter, ProductWithMedia } from "@/lib/adapters/travel-insurance-adapter";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";

const adapter = new TravelInsuranceAdapter({
  baseUrl: BASE_URL,
  merchantName: "TravelGuard Insurance",
  merchantUrl: BASE_URL,
  termsUrl: `${BASE_URL}/terms`,
  privacyPolicyUrl: `${BASE_URL}/privacy`,
  returnPolicyUrl: `${BASE_URL}/returns`,
  defaultBrand: "TravelGuard",
  enableCheckout: false,
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const compress = searchParams.get("compress") === "true";
  const format = searchParams.get("format") || "jsonl";

  try {
    let allProducts = await db.select().from(products);
    const allMedia = await db.select().from(productMedia);

    // Filter by active status
    if (activeOnly) {
      allProducts = allProducts.filter((p) => p.active);
    }

    // Join media to products
    const productsWithMedia: ProductWithMedia[] = allProducts.map((p) => ({
      ...p,
      media: allMedia.find((m) => m.productId === p.id) || null,
    }));

    // Generate JSONL (OpenAI-compliant format)
    const jsonl = adapter.toJSONL(productsWithMedia);

    // Optionally compress (OpenAI expects .jsonl.gz)
    if (compress) {
      const gzipped = gzipSync(Buffer.from(jsonl));
      return new NextResponse(gzipped, {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": 'attachment; filename="products.jsonl.gz"',
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // Return uncompressed JSONL
    return new NextResponse(jsonl, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": 'attachment; filename="products.jsonl"',
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Feed generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate feed" },
      { status: 500 }
    );
  }
}
