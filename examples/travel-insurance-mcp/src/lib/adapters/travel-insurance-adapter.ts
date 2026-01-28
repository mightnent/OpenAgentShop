import { Product, ProductMedia } from "@/db/schema";
import { OpenAIFeedAdapter } from "./openai-feed-adapter";
import { OpenAIProductFeed } from "@/types/openai-feed";

export interface ProductWithMedia extends Product {
  media?: ProductMedia | null;
}

/**
 * Adapter for transforming travel insurance products to OpenAI feed format
 */
export class TravelInsuranceAdapter extends OpenAIFeedAdapter<ProductWithMedia> {
  transform(product: ProductWithMedia): OpenAIProductFeed {
    const itemId = `TI-${product.id}`;
    const highlights = (product.coverageHighlights as string[]) || [];
    const regions = (product.regionsCovered as string[]) || [];

    // Build description with coverage highlights
    let description = product.description || product.shortDescription || "";
    if (highlights.length > 0) {
      description += ` Coverage includes: ${highlights.join(", ")}.`;
    }
    if (regions.length > 0) {
      description += ` Regions covered: ${regions.join(", ")}.`;
    }

    return {
      // OpenAI Flags (Required)
      is_eligible_search: product.active,
      is_eligible_checkout: this.config.enableCheckout,

      // Basic Product Data (Required)
      item_id: itemId,
      title: product.name,
      description: description.trim(),
      url: `${this.config.baseUrl}/products/${product.id}`,

      // Media (Required)
      image_url:
        product.media?.url ||
        `https://placehold.co/600x400/1a1a1a/ffffff?text=${encodeURIComponent(product.name)}`,

      // Price (Required)
      price: this.formatPrice(product.price, product.currency),
      sale_price: product.discountPrice
        ? this.formatPrice(product.discountPrice, product.currency)
        : undefined,

      // Availability (Required)
      availability: this.mapAvailability(product.active),

      // Item Information
      brand: this.config.defaultBrand,
      condition: "new",
      product_category: "Insurance > Travel Insurance",

      // Variants (Required - single-SKU products)
      group_id: itemId,
      listing_has_variations: false,

      // Merchant Info
      merchant_name: this.config.merchantName,
      merchant_url: this.config.merchantUrl,
      terms_url: product.termsUrl || this.config.termsUrl,
      privacy_policy_url: this.config.privacyPolicyUrl,

      // Returns (insurance-specific: cooling-off period)
      is_returnable: true,
      return_window_days: 14,
      return_policy_url: this.config.returnPolicyUrl,
    };
  }
}
