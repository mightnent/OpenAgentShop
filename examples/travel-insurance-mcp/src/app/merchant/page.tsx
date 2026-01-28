"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Package, Plus, Edit, ArrowLeft, Trash2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { formatCurrencyDisplay } from "@/lib/currency";

interface Product {
  id: number;
  name: string;
  shortDescription: string | null;
  price: number;
  discountPrice: number | null;
  currency: string;
  active: boolean;
  tier: string | null;
}

interface Order {
  id: number;
  productId: number;
  productName: string | null;
  userId: string;
  duration: number;
  travelers: number | null;
  startDate: string | null;
  totalPrice: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function MerchantCenter() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/merchant/products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrders() {
    try {
      const res = await fetch("/api/merchant/orders");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function toggleProductActive(productId: number, active: boolean) {
    try {
      await fetch(`/api/merchant/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      setProducts(products.map(p => p.id === productId ? { ...p, active } : p));
    } catch (error) {
      console.error("Failed to update product:", error);
    }
  }

  async function deleteProduct(productId: number) {
    try {
      await fetch(`/api/merchant/products/${productId}`, { method: "DELETE" });
      setProducts(products.filter((p) => p.id !== productId));
      setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  }

  async function deleteSelectedProducts() {
    try {
      await Promise.all(
        selectedProductIds.map((productId) =>
          fetch(`/api/merchant/products/${productId}`, { method: "DELETE" })
        )
      );
      setProducts(products.filter((p) => !selectedProductIds.includes(p.id)));
      setSelectedProductIds([]);
    } catch (error) {
      console.error("Failed to delete selected products:", error);
    }
  }

  const allSelected = products.length > 0 && selectedProductIds.length === products.length;
  const hasSelections = selectedProductIds.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              <span className="font-bold text-xl">Merchant Center</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/merchant/products/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Products</CardTitle>
                    <CardDescription>
                      Manage your product catalog
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasSelections}
                      onClick={deleteSelectedProducts}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products found.{" "}
                <Link href="/merchant/products/new" className="text-foreground underline">
                  Add your first product
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48px]">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(event) =>
                          setSelectedProductIds(
                            event.target.checked ? products.map((product) => product.id) : []
                          )
                        }
                        aria-label="Select all products"
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const isSelected = selectedProductIds.includes(product.id);
                    return (
                      <TableRow key={product.id} data-state={isSelected ? "selected" : undefined}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) =>
                              setSelectedProductIds((prev) =>
                                event.target.checked
                                  ? [...prev, product.id]
                                  : prev.filter((id) => id !== product.id)
                              )
                            }
                            aria-label={`Select ${product.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {product.shortDescription?.slice(0, 50)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              product.tier === "premium"
                                ? "bg-gray-900 text-white"
                                : product.tier === "standard"
                                ? "bg-gray-200 text-gray-900"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {product.tier}
                          </span>
                        </TableCell>
                        <TableCell>
                          {product.discountPrice != null ? (
                            <div>
                              <span className="font-medium">{formatCurrencyDisplay(product.discountPrice, product.currency)}</span>
                              <span className="text-sm text-muted-foreground line-through ml-2">
                                {formatCurrencyDisplay(product.price, product.currency)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-medium">{formatCurrencyDisplay(product.price, product.currency)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={product.active}
                            onCheckedChange={(checked) => toggleProductActive(product.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link href={`/merchant/products/${product.id}`}>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Orders</CardTitle>
                <CardDescription>
                  View and manage customer orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No orders yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Travelers</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">#{order.id}</TableCell>
                          <TableCell>
                            <div className="font-medium">{order.productName || "N/A"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{order.userId}</div>
                          </TableCell>
                          <TableCell>{order.duration} days</TableCell>
                          <TableCell>{order.travelers || 1}</TableCell>
                          <TableCell>
                            {order.totalPrice != null
                              ? formatCurrencyDisplay(order.totalPrice, "USD")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                order.status === "completed"
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
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
