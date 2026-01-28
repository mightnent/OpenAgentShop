/**
 * OpenAI/ChatGPT Product Feed Specification Types
 * Reference: https://developers.openai.com/commerce/specs/feed/
 */

export interface OpenAIProductFeed {
  // OpenAI Flags (Required)
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;

  // Basic Product Data (Required)
  item_id: string;
  title: string;
  description: string;
  url: string;

  // Optional identifiers
  gtin?: string;
  mpn?: string;

  // Media (Required)
  image_url: string;
  additional_image_urls?: string;
  video_url?: string;
  "3d_model_url"?: string;

  // Price & Promotions (Required: price)
  price: string; // Format: "XX.XX CUR"
  sale_price?: string;
  sale_price_effective_date_start?: string;
  sale_price_effective_date_end?: string;
  unit_pricing_measure?: string;
  price_drop_tag?: string;

  // Availability (Required)
  availability: "in_stock" | "out_of_stock" | "pre_order" | "backorder" | "unknown";
  availability_date?: string;
  pickup_method?: "in_store" | "reserve" | "not_supported";
  pickup_sla?: string;

  // Item Information (Required: brand)
  brand: string;
  condition?: "new" | "used" | "refurbished";
  product_category?: string;
  material?: string;
  product_dimensions?: string;
  length?: number;
  width?: number;
  height?: number;
  dimensions_unit?: "in" | "cm";
  weight?: number;
  item_weight_unit?: "lb" | "kg";
  age_group?: "newborn" | "infant" | "toddler" | "kids" | "adult";

  // Variants (Required: group_id, listing_has_variations)
  group_id: string;
  listing_has_variations: boolean;
  variant_attributes?: Record<string, string>;
  item_group_title?: string;
  color?: string;
  size?: string;
  size_system?: string;
  gender?: "male" | "female" | "unisex";
  variant_id?: string;

  // Fulfillment
  shipping?: string;
  ships_by_date?: string;
  free_shipping?: boolean;
  same_day_delivery?: boolean;
  next_day_delivery?: boolean;

  // Merchant Info
  merchant_name?: string;
  merchant_url?: string;
  privacy_policy_url?: string;
  terms_url?: string;

  // Returns
  is_returnable?: boolean;
  free_returns?: boolean;
  return_window_days?: number;
  return_policy_url?: string;

  // Performance Signals
  popularity_score?: number;
  return_rate?: string;

  // Compliance
  compliance_warning?: string;
  minimum_age?: number;

  // Reviews and Q&A
  review_count?: number;
  average_rating?: number;
  rating_count?: number;
  qa?: Array<{ q: string; a: string }>;
  reviews?: Array<{
    title: string;
    content: string;
    minRating: number;
    maxRating: number;
    rating: number;
  }>;

  // Related Products
  related_product_id?: string;
  related_product_type?:
    | "part_of_set"
    | "required_part"
    | "often_bought_with"
    | "substitute"
    | "different_brand"
    | "accessory";

  // Geo Tagging
  country?: string;
  region_price?: string;
  region_availability?: string;
}

/**
 * Configuration for feed adapters
 */
export interface FeedAdapterConfig {
  baseUrl: string;
  merchantName: string;
  merchantUrl?: string;
  termsUrl?: string;
  privacyPolicyUrl?: string;
  returnPolicyUrl?: string;
  defaultBrand: string;
  enableCheckout: boolean;
}
