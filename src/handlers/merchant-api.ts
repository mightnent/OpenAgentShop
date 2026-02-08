/**
 * Merchant API Route Handler Generator
 *
 * Generates CRUD API routes for the merchant center:
 *   - GET/POST /api/merchant/products
 *   - GET/PATCH/DELETE /api/merchant/products/[id]
 *   - GET /api/merchant/orders
 */

/**
 * Generate the merchant products list/create route handler.
 */
export function generateProductsRouteSource(): string {
  return `import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productMedia } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allProducts = await db.select().from(products).orderBy(products.createdAt);
  return NextResponse.json(allProducts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const [product] = await db.insert(products).values(body).returning();
  return NextResponse.json(product, { status: 201 });
}
`;
}

/**
 * Generate the single product route handler.
 */
export function generateProductByIdRouteSource(): string {
  return `import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productMedia } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, parseInt(id, 10)))
    .limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const media = await db
    .select()
    .from(productMedia)
    .where(eq(productMedia.productId, product.id))
    .orderBy(productMedia.sortOrder);

  return NextResponse.json({ ...product, media });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const [updated] = await db
    .update(products)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(products.id, parseInt(id, 10)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(products).where(eq(products.id, parseInt(id, 10)));
  return new NextResponse(null, { status: 204 });
}
`;
}

/**
 * Generate the orders list route handler.
 */
export function generateOrdersRouteSource(): string {
return `import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const orderRows = await db.select().from(orders).orderBy(orders.createdAt);
  const productIds = Array.from(new Set(orderRows.map((o) => o.productId)));
  const productRows = productIds.length
    ? await db.select().from(products).where(inArray(products.id, productIds))
    : [];

  const productMap = new Map(productRows.map((p) => [p.id, p.name]));

  return NextResponse.json(
    orderRows.map((order) => ({
      ...order,
      productName: productMap.get(order.productId) ?? "Unknown",
    }))
  );
}
`;
}
