import { formatPriceForFeed } from "@/lib/currency";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3003";
const CURRENCY = "SGD";

interface FeedProduct {
  id: number;
  catalogId: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  discountPrice: number | null;
  active: boolean;
  currency: string;
  category?: string | null;
  media?: Array<{ url: string; alt: string | null }>;
}

interface OpenAIProductFeed {
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;
  item_id: string;
  title: string;
  description: string;
  url: string;
  image_url: string;
  price: string;
  sale_price?: string;
  availability: "in_stock" | "out_of_stock";
  brand: string;
  condition: "new";
  product_category: string;
  group_id: string;
  listing_has_variations: boolean;
  merchant_name: string;
  merchant_url: string;
  terms_url: string;
  privacy_policy_url: string;
  is_returnable: boolean;
  return_window_days: number;
  return_policy_url: string;
}

export function transformProductToFeed(product: FeedProduct): OpenAIProductFeed {
  const itemId = product.catalogId || `PROD-${product.id}`;
  const imageUrl = product.media?.[0]?.url || `${BASE_URL}/placeholder.png`;

  const description = [
    product.description || product.shortDescription || product.name,
  ].join(" ");

  const feed: OpenAIProductFeed = {
    is_eligible_search: product.active,
    is_eligible_checkout: false,
    item_id: itemId,
    title: product.name,
    description,
    url: `${BASE_URL}/products/${product.id}`,
    image_url: imageUrl,
    price: formatPriceForFeed(product.price, product.currency || CURRENCY),
    availability: product.active ? "in_stock" : "out_of_stock",
    brand: "Singtel Bill Payment",
    condition: "new",
    product_category: product.category || "General",
    group_id: itemId,
    listing_has_variations: false,
    merchant_name: "Singtel Bill Payment",
    merchant_url: BASE_URL,
    terms_url: "https://singtel.com/terms",
    privacy_policy_url: "https://singtel.com/privacy",
    is_returnable: true,
    return_window_days: 14,
    return_policy_url: "http://localhost:3003/returns",
  };

  if (product.discountPrice) {
    feed.sale_price = formatPriceForFeed(product.discountPrice, product.currency || CURRENCY);
  }

  return feed;
}

export function toJSONL(products: FeedProduct[]): string {
  return products
    .map((p) => JSON.stringify(transformProductToFeed(p)))
    .join("\n");
}
