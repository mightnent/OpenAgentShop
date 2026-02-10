import { NextResponse } from "next/server";
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
