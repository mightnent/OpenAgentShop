import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { CheckoutSessionManager } from "@/lib/ucp/checkout-session-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBaseUrl(requestHeaders: Headers): string {
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const host = requestHeaders.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3003";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = getBaseUrl(await headers());
  const manager = new CheckoutSessionManager({ baseUrl });
  const result = await manager.getCheckoutSession(id);
  return NextResponse.json(result);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const baseUrl = getBaseUrl(await headers());
  const manager = new CheckoutSessionManager({ baseUrl });
  const result = await manager.updateCheckoutSession(id, body.checkout ?? body);
  return NextResponse.json(result);
}
