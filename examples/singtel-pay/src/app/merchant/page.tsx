"use client";

import { useEffect, useState } from "react";

interface Product {
  id: number;
  catalogId: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  discountPrice: number | null;
  active: boolean;
  tier?: string | null;
  currency: string;
}

interface Order {
  id: number;
  productName: string | null;
  userId: string;
  quantity: number;
  totalPrice: number | null;
  status: string;
  createdAt: string;
}

export default function MerchantPage() {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: "", shortDescription: "", description: "", price: 0, discountPrice: 0 });

  useEffect(() => {
    fetch("/api/merchant/products").then(r => r.json()).then(setProducts);
    fetch("/api/merchant/orders").then(r => r.json()).then(setOrders);
  }, []);

  const formatPrice = (amount: number, currency: string) => {
    const exp = currency === "JPY" ? 0 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: exp,
    }).format(amount / Math.pow(10, exp));
  };

  const toggleActive = async (id: number, active: boolean) => {
    await fetch(`/api/merchant/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setProducts(products.map(p => p.id === id ? { ...p, active } : p));
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    await fetch(`/api/merchant/products/${id}`, { method: "DELETE" });
    setProducts(products.filter(p => p.id !== id));
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      shortDescription: product.shortDescription || "",
      description: product.description || "",
      price: product.price,
      discountPrice: product.discountPrice || 0,
    });
  };

  const saveProduct = async () => {
    if (!editingProduct) return;
    const res = await fetch(`/api/merchant/products/${editingProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...updated } : p));
      setEditingProduct(null);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Singtel Bill Payment - Merchant Center</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Pay your Singtel mobile bills quickly and securely</p>

      {/* Edit Modal */}
      {editingProduct && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 12, width: "100%", maxWidth: 500 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Edit Product</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Name</label>
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Short Description</label>
              <input value={editForm.shortDescription} onChange={e => setEditForm({ ...editForm, shortDescription: e.target.value })} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Price (minor units)</label>
                <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Discount Price</label>
                <input type="number" value={editForm.discountPrice} onChange={e => setEditForm({ ...editForm, discountPrice: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingProduct(null)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveProduct} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#1a1a1a", color: "white", cursor: "pointer", fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setTab("products")}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: tab === "products" ? "#1a1a1a" : "white", color: tab === "products" ? "white" : "#333", cursor: "pointer", fontWeight: 600 }}
        >Products ({products.length})</button>
        <button
          onClick={() => setTab("orders")}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: tab === "orders" ? "#1a1a1a" : "white", color: tab === "orders" ? "white" : "#333", cursor: "pointer", fontWeight: 600 }}
        >Orders ({orders.length})</button>
      </div>

      {tab === "products" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Price</th>
              <th style={{ padding: 8 }}>Active</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "#666" }}>{p.shortDescription}</div>
                </td>
                <td style={{ padding: 8 }}>
                  {p.discountPrice ? (
                    <><span style={{ textDecoration: "line-through", color: "#999" }}>{formatPrice(p.price, p.currency)}</span> {formatPrice(p.discountPrice, p.currency)}</>
                  ) : formatPrice(p.price, p.currency)}
                </td>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => toggleActive(p.id, !p.active)}
                    style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: p.active ? "#e8f5e9" : "#fce4ec", color: p.active ? "#2e7d32" : "#c62828", cursor: "pointer", fontSize: 12 }}
                  >{p.active ? "Active" : "Inactive"}</button>
                </td>
                <td style={{ padding: 8, display: "flex", gap: 4 }}>
                  <button onClick={() => openEditModal(p)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: 12, color: "#1565c0" }}>
                    Edit
                  </button>
                  <button onClick={() => deleteProduct(p.id)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: 12, color: "#c62828" }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "orders" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Order ID</th>
              <th style={{ padding: 8 }}>Product</th>
              <th style={{ padding: 8 }}>Customer</th>
              <th style={{ padding: 8 }}>Total</th>
              <th style={{ padding: 8 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 8, fontWeight: 600 }}>#{o.id}</td>
                <td style={{ padding: 8 }}>{o.productName || "—"}</td>
                <td style={{ padding: 8 }}>{o.userId}</td>
                <td style={{ padding: 8 }}>{o.totalPrice ? formatPrice(o.totalPrice, "USD") : "—"}</td>
                <td style={{ padding: 8 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: o.status === "confirmed" ? "#e8f5e9" : o.status === "canceled" ? "#fce4ec" : "#fff3e0", color: o.status === "confirmed" ? "#2e7d32" : o.status === "canceled" ? "#c62828" : "#e65100" }}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
