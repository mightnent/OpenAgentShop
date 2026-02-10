import { NextRequest, NextResponse } from "next/server";
import { completeCheckoutSession } from "@/lib/ucp/checkout-session-manager";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const idempotencyKey = body?.idempotencyKey || body?.idempotency_key || "";
  if (!idempotencyKey) {
    return NextResponse.json({ error: "idempotencyKey is required" }, { status: 400 });
  }

  const checkout = await completeCheckoutSession(params.id, body || {}, idempotencyKey);
  if (!checkout) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  return NextResponse.json(checkout);
}
