import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get("debug") === "1";

    // NOTE: Drizzle's select-mapping + leftJoin has shown inconsistent results with neon-http
    // in this project (joined_rows < plain_rows). Use explicit SQL here to ensure correctness.
    const raw = await db.execute(sql`
      select
        o.id as "id",
        o.product_id as "productId",
        p.name as "productName",
        o.user_id as "userId",
        o.duration as "duration",
        o.travelers as "travelers",
        o.start_date as "startDate",
        o.total_price as "totalPrice",
        o.status as "status",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt"
      from orders o
      left join products p on o.product_id = p.id
      order by o.created_at desc
    `);

    const ordersWithProducts = raw.rows as Array<Record<string, unknown>>;

    let meta: Record<string, unknown> | undefined;
    if (debug) {
      const plain = await db
        .select({
          id: orders.id,
          productId: orders.productId,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt));
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders);
      const dbInfo = await db.execute(
        sql`select current_database() as database, current_schema() as schema`
      );
      meta = {
        orders_count: countRow?.count ?? null,
        plain_rows: plain.length,
        joined_rows: ordersWithProducts.length,
        plain_ids: plain.slice(0, 10).map((r) => r.id),
        joined_ids: ordersWithProducts.slice(0, 10).map((r) => r.id),
        db: dbInfo?.rows?.[0] ?? null,
      };
    }

    return NextResponse.json(
      { orders: ordersWithProducts, ...(meta ? { meta } : {}) },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
