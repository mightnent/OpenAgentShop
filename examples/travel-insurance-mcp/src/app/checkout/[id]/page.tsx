import { db } from "@/db";
import { checkoutSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

interface CheckoutPageProps {
  params: Promise<{ id: string }>;
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

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { id } = await params;

  const [session] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id));

  if (!session) {
    notFound();
  }

  const checkout = session.checkoutData as unknown as CheckoutData;

  const statusColors: Record<string, string> = {
    incomplete: "bg-yellow-100 text-yellow-800",
    requires_escalation: "bg-orange-100 text-orange-800",
    ready_for_complete: "bg-green-100 text-green-800",
    complete_in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    canceled: "bg-gray-100 text-gray-800",
  };

  const total = checkout.totals.find((t) => t.type === "total");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                statusColors[checkout.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {checkout.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="text-sm text-gray-500 mb-6">
            Session ID: <code className="bg-gray-100 px-2 py-0.5 rounded">{checkout.id}</code>
          </div>

          {checkout.buyer?.email && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Buyer Information</h2>
              <p className="text-gray-900">
                {checkout.buyer.first_name} {checkout.buyer.last_name}
              </p>
              <p className="text-gray-600 text-sm">{checkout.buyer.email}</p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Items</h2>
            <div className="space-y-3">
              {checkout.line_items.map((item) => {
                const itemTotal = item.totals.find((t) => t.type === "line_total");
                return (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.item.title || `Product #${item.item.id}`}
                      </p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-gray-900">
                      {itemTotal
                        ? formatCurrency(itemTotal.amount, checkout.currency)
                        : "-"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {total && (
            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total.amount, checkout.currency)}</span>
              </div>
            </div>
          )}

          {checkout.messages.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Messages</h2>
              <div className="space-y-2">
                {checkout.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-sm ${
                      msg.type === "error"
                        ? "bg-red-50 text-red-700"
                        : msg.type === "warning"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    <span className="font-medium">[{msg.code}]</span> {msg.content}
                    {msg.severity && (
                      <span className="ml-2 text-xs opacity-75">({msg.severity})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {checkout.status === "completed" && checkout.order && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h2 className="text-sm font-medium text-green-800 mb-2">Order Confirmed!</h2>
              <p className="text-green-700">
                Order ID: <code className="bg-green-100 px-2 py-0.5 rounded">{checkout.order.id}</code>
              </p>
              {checkout.order.permalink_url && (
                <Link
                  href={checkout.order.permalink_url}
                  className="text-green-600 hover:text-green-800 text-sm underline mt-2 inline-block"
                >
                  View Order Details →
                </Link>
              )}
            </div>
          )}

          {checkout.status === "ready_for_complete" && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-blue-700 text-sm">
                This checkout is ready to be completed. In a real implementation, you would
                see payment options here.
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-gray-500">
              Agentic Commerce Demo - UCP Checkout
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
