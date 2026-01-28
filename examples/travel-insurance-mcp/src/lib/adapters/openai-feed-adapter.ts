import { OpenAIProductFeed, FeedAdapterConfig } from "@/types/openai-feed";
import { formatPriceForFeed } from "@/lib/currency";

/**
 * Abstract base class for transforming internal product data to OpenAI feed format.
 * Extend this class for each domain (travel insurance, EV charging, etc.)
 */
export abstract class OpenAIFeedAdapter<TProduct> {
  constructor(protected config: FeedAdapterConfig) {}

  /**
   * Transform internal product to OpenAI feed format.
   * Must be implemented by subclasses.
   */
  abstract transform(product: TProduct): OpenAIProductFeed;

  /**
   * Generate JSONL output (one JSON object per line).
   * This is the format required by OpenAI.
   */
  toJSONL(products: TProduct[]): string {
    return products.map((p) => JSON.stringify(this.transform(p))).join("\n");
  }

  /**
   * Format price in minor units for feed output (e.g., 7999 USD → "79.99 USD")
   */
  protected formatPrice(minorUnits: number, currency: string): string {
    return formatPriceForFeed(minorUnits, currency);
  }

  /**
   * Map availability status to OpenAI enum values
   */
  protected mapAvailability(
    active: boolean,
    stock?: number
  ): OpenAIProductFeed["availability"] {
    if (!active) return "out_of_stock";
    if (stock !== undefined && stock <= 0) return "out_of_stock";
    return "in_stock";
  }
}
