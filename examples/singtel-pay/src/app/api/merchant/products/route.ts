import { NextResponse } from "next/server";
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
