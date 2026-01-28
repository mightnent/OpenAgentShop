import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatCurrencyDisplay } from "@/lib/currency";

interface OrderDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isFinite(orderId)) {
    notFound();
  }

  const [order] = await db
    .select({
      id: orders.id,
      productId: orders.productId,
      productName: products.name,
      productDescription: products.shortDescription,
      userId: orders.userId,
      duration: orders.duration,
      travelers: orders.travelers,
      startDate: orders.startDate,
      totalPrice: orders.totalPrice,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, orderId));

  if (!order) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Order #{order.id}</div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">Order Details</h1>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  order.status === "confirmed"
                    ? "bg-green-100 text-green-800"
                    : order.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : order.status === "canceled"
                    ? "bg-gray-100 text-gray-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {order.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}
            </p>
          </div>

          <div className="p-6 space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Coverage Plan
              </h2>
              <div className="mt-3 bg-gray-50 rounded-lg p-4">
                <p className="text-lg font-medium text-gray-900">
                  {order.productName || `Product #${order.productId}`}
                </p>
                {order.productDescription && (
                  <p className="text-sm text-gray-600 mt-1">
                    {order.productDescription}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700">
                  <div>
                    <span className="font-medium">Duration:</span> {order.duration} days
                  </div>
                  <div>
                    <span className="font-medium">Travelers:</span> {order.travelers || 1}
                  </div>
                  <div>
                    <span className="font-medium">Start date:</span> {order.startDate ? new Date(order.startDate).toLocaleDateString() : "TBD"}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Buyer
              </h2>
              <div className="mt-3 text-sm text-gray-700">
                <p>{order.userId}</p>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Payment Summary
              </h2>
              <div className="mt-3 flex items-center justify-between text-lg font-semibold">
                <span>Total Paid</span>
                <span>
                  {order.totalPrice != null
                    ? formatCurrencyDisplay(order.totalPrice, "USD")
                    : "-"}
                </span>
              </div>
            </section>
          </div>

          <div className="px-6 py-4 border-t text-xs text-muted-foreground">
            Last updated {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : "-"}
          </div>
        </div>
      </main>
    </div>
  );
}
