import { NextResponse } from "next/server";
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
