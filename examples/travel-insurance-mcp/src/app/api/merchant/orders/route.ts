import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const ordersWithProducts = await db
      .select({
        id: orders.id,
        productId: orders.productId,
        productName: products.name,
        userId: orders.userId,
        duration: orders.duration,
        travelers: orders.travelers,
        startDate: orders.startDate,
        totalPrice: orders.totalPrice,
        status: orders.status,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .orderBy(desc(orders.createdAt));

    return NextResponse.json({ orders: ordersWithProducts });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
