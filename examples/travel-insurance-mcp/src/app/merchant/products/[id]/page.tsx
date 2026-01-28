"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { minorToMajor, majorToMinor } from "@/lib/currency";

type ProductForm = {
  name: string;
  shortDescription: string;
  description: string;
  price: string;
  discountPrice: string;
  tier: string;
  active: boolean;
  currency: string;
  termsUrl: string;
  policyPdfUrl: string;
};

const defaultForm: ProductForm = {
  name: "",
  shortDescription: "",
  description: "",
  price: "",
  discountPrice: "",
  tier: "standard",
  active: true,
  currency: "USD",
  termsUrl: "",
  policyPdfUrl: "",
};

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/merchant/products/${params.id}`);
        if (!res.ok) {
          throw new Error("Failed to load product");
        }
        const data = await res.json();
        const product = data.product;
        const currency = product.currency ?? "USD";
        setForm({
          name: product.name ?? "",
          shortDescription: product.shortDescription ?? "",
          description: product.description ?? "",
          price: product.price != null ? String(minorToMajor(product.price, currency)) : "",
          discountPrice: product.discountPrice != null ? String(minorToMajor(product.discountPrice, currency)) : "",
          tier: product.tier ?? "standard",
          active: product.active ?? true,
          currency,
          termsUrl: product.termsUrl ?? "",
          policyPdfUrl: product.policyPdfUrl ?? "",
        });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load product");
      } finally {
        setLoading(false);
      }
    }

    if (params?.id) {
      fetchProduct();
    }
  }, [params]);

  function updateField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/merchant/products/${params.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            price: majorToMinor(form.price || "0", form.currency),
            discountPrice: form.discountPrice ? majorToMinor(form.discountPrice, form.currency) : null,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update product");
      }

      router.push("/merchant");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/merchant" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Merchant Center
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" form="edit-product-form" disabled={saving || loading}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit Product</CardTitle>
            <CardDescription>Update the travel insurance product details.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Loading product...</div>
            ) : (
              <form id="edit-product-form" className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tier">Tier</Label>
                    <Input
                      id="tier"
                      value={form.tier}
                      onChange={(event) => updateField("tier", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(event) => updateField("price", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountPrice">Discount price</Label>
                    <Input
                      id="discountPrice"
                      type="number"
                      step="0.01"
                      value={form.discountPrice}
                      onChange={(event) => updateField("discountPrice", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={form.currency}
                      onChange={(event) => updateField("currency", event.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                    <div>
                      <Label htmlFor="active">Active listing</Label>
                      <p className="text-sm text-muted-foreground">Toggle product visibility</p>
                    </div>
                    <Switch
                      id="active"
                      checked={form.active}
                      onCheckedChange={(checked) => updateField("active", checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortDescription">Short description</Label>
                  <Textarea
                    id="shortDescription"
                    value={form.shortDescription}
                    onChange={(event) => updateField("shortDescription", event.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Full description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    rows={5}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="termsUrl">Terms URL</Label>
                    <Input
                      id="termsUrl"
                      value={form.termsUrl}
                      onChange={(event) => updateField("termsUrl", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="policyPdfUrl">Policy PDF URL</Label>
                    <Input
                      id="policyPdfUrl"
                      value={form.policyPdfUrl}
                      onChange={(event) => updateField("policyPdfUrl", event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Link href="/merchant">
                    <Button type="button" variant="ghost">Cancel</Button>
                  </Link>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
