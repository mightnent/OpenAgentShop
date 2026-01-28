import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ shops: [] });
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "Shops are no longer supported." },
    { status: 410 }
  );
}
