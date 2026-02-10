import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession, updateCheckoutSession } from "@/lib/ucp/checkout-session-manager";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const checkout = await getCheckoutSession(params.id);
  if (!checkout) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  return NextResponse.json(checkout);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const checkout = await updateCheckoutSession(params.id, body || {});
  if (!checkout) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  return NextResponse.json(checkout);
}
