import { db } from "@/db";
import { checkoutSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CheckoutClient } from "./CheckoutClient";

interface CheckoutPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface CheckoutData {
  id: string;
  status: string;
  buyer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  line_items: Array<{
    id: string;
    item: { id: string; title?: string; price?: number };
    quantity: number;
    totals: Array<{ type: string; amount: number; display_text?: string }>;
  }>;
  currency: string;
  totals: Array<{ type: string; amount: number; display_text?: string }>;
  messages: Array<{
    type: string;
    code: string;
    content: string;
    severity?: string;
  }>;
  order?: { id: string; permalink_url?: string };
}

const ALLOWED_DELEGATES = ["payment.instruments_change", "payment.credential"];

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const [session] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id));

  if (!session) {
    notFound();
  }

  const checkout = session.checkoutData as unknown as CheckoutData;
  const ecVersion = typeof query.ec_version === "string" ? query.ec_version : undefined;
  const ecDelegate = typeof query.ec_delegate === "string" ? query.ec_delegate : undefined;

  return (
    <CheckoutClient
      initialCheckout={checkout}
      ecVersion={ecVersion}
      ecDelegate={ecDelegate}
      allowedDelegates={ALLOWED_DELEGATES}
    />
  );
}
