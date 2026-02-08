import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { updateCheckoutSession, getCheckoutSession } from "@/lib/ucp/checkout-session-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await headers();
  const result = await getCheckoutSession(id);
  return NextResponse.json(result);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await headers();
  const body = await request.json();
  const result = await updateCheckoutSession(id, body.checkout ?? body);
  return NextResponse.json(result);
}
