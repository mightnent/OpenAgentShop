import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const productIds = Array.from(new Set(orderRows.map((o) => o.productId)));
    const productRows = productIds.length
      ? await db.select().from(products).where(inArray(products.id, productIds))
      : [];
    const productMap = new Map(productRows.map((p) => [p.id, p.name]));

    return NextResponse.json({
      orders: orderRows.map((order) => ({
        ...order,
        productName: productMap.get(order.productId) ?? "Unknown",
      })),
    });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
