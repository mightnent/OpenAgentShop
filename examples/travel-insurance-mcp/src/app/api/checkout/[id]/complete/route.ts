import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { completeCheckoutSession } from "@/lib/ucp/checkout-session-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await headers();
  const body = await request.json();
  const result = await completeCheckoutSession(
    id,
    body.checkout ?? body,
    body.idempotency_key ?? ""
  );
  return NextResponse.json(result);
}
