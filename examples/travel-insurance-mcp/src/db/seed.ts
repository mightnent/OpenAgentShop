import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { products, productMedia } from "./schema";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("Seeding database...");

  // Create products
  const productsData = [
    {
      name: "Budget Explorer",
      shortDescription: "Essential coverage for budget-conscious travelers",
      description: "Basic travel insurance coverage ideal for short domestic trips or low-risk destinations. Includes emergency medical expenses, trip cancellation, and baggage protection.",
      currency: "USD",
      price: 2999,
      discountPrice: null,
      active: true,
      coverageHighlights: ["Emergency Medical $25,000", "Trip Cancellation $1,500", "Baggage Loss $500", "24/7 Hotline"],
      regionsCovered: ["North America", "Europe"],
      durationOptions: [7, 14, 21],
      tier: "budget",
    },
    {
      name: "Standard Voyager",
      shortDescription: "Balanced protection for most travel needs",
      description: "Our most popular plan offering comprehensive coverage for international travel. Perfect for vacations, business trips, and adventure activities.",
      currency: "USD",
      price: 7999,
      discountPrice: 6999,
      active: true,
      coverageHighlights: ["Emergency Medical $100,000", "Trip Cancellation $5,000", "Baggage Loss $1,500", "Flight Delay $500", "Adventure Sports", "24/7 Hotline"],
      regionsCovered: ["Worldwide"],
      durationOptions: [7, 14, 21, 30],
      tier: "standard",
    },
    {
      name: "Premium Shield",
      shortDescription: "Maximum protection with concierge service",
      description: "Our flagship plan with the highest coverage limits and premium benefits. Includes cancel-for-any-reason, pre-existing condition waiver, and personal concierge service.",
      currency: "USD",
      price: 14999,
      discountPrice: null,
      active: true,
      coverageHighlights: ["Emergency Medical $500,000", "Trip Cancellation $10,000", "Cancel for Any Reason 75%", "Baggage Loss $3,000", "Flight Delay $1,000", "Pre-existing Conditions", "Concierge Service", "24/7 Hotline"],
      regionsCovered: ["Worldwide"],
      durationOptions: [7, 14, 21, 30, 60, 90],
      tier: "premium",
    },
    {
      name: "Essential Cover",
      shortDescription: "Simple protection for simple trips",
      description: "Straightforward coverage that won't break the bank. Great for weekend getaways and domestic travel within familiar regions.",
      currency: "USD",
      price: 2499,
      discountPrice: null,
      active: true,
      coverageHighlights: ["Emergency Medical $20,000", "Trip Cancellation $1,000", "Baggage Loss $400", "24/7 Support"],
      regionsCovered: ["North America"],
      durationOptions: [3, 7, 14],
      tier: "budget",
    },
    {
      name: "Explorer Plus",
      shortDescription: "Enhanced coverage for adventurous travelers",
      description: "Designed for those who seek adventure. Covers hiking, skiing, scuba diving, and more with generous medical and evacuation benefits.",
      currency: "USD",
      price: 8999,
      discountPrice: 7999,
      active: true,
      coverageHighlights: ["Emergency Medical $150,000", "Medical Evacuation $500,000", "Trip Cancellation $7,500", "Baggage Loss $2,000", "Adventure Activities", "Rental Car Damage", "24/7 Support"],
      regionsCovered: ["Worldwide except sanctioned countries"],
      durationOptions: [7, 14, 21, 30, 45],
      tier: "standard",
    },
    {
      name: "Elite Traveler",
      shortDescription: "Luxury coverage with no compromises",
      description: "The ultimate in travel protection. Unlimited medical coverage, first-class evacuation, and white-glove concierge services for the discerning traveler.",
      currency: "USD",
      price: 19999,
      discountPrice: null,
      active: true,
      coverageHighlights: ["Emergency Medical Unlimited", "Medical Evacuation Unlimited", "Trip Cancellation $15,000", "Cancel for Any Reason 100%", "Baggage Loss $5,000", "Flight Delay $1,500", "Pre-existing Conditions", "Luxury Concierge", "24/7 Priority Support"],
      regionsCovered: ["Worldwide"],
      durationOptions: [7, 14, 21, 30, 60, 90, 180, 365],
      tier: "premium",
    },
    // Additional products for variety
    {
      name: "Family Pack",
      shortDescription: "Complete coverage for the whole family",
      description: "Protect your entire family with one comprehensive plan. Includes coverage for children at no extra cost and family-friendly benefits.",
      currency: "USD",
      price: 19999,
      discountPrice: 17999,
      active: true,
      coverageHighlights: ["Emergency Medical $250,000/person", "Trip Cancellation $10,000", "Kids Travel Free", "Baggage Loss $2,000/person", "Trip Interruption $5,000", "Family Emergency Hotline"],
      regionsCovered: ["Worldwide"],
      durationOptions: [7, 14, 21, 30],
      tier: "standard",
    },
    {
      name: "Business Traveler",
      shortDescription: "Tailored for frequent business trips",
      description: "Annual multi-trip coverage perfect for business professionals. Includes laptop/equipment coverage and business interruption benefits.",
      currency: "USD",
      price: 34999,
      discountPrice: null,
      active: true,
      coverageHighlights: ["Emergency Medical $200,000", "Unlimited Trips (30 days each)", "Laptop/Equipment $3,000", "Business Interruption $5,000", "Baggage Loss $2,500", "Airport Lounge Access", "24/7 Business Support"],
      regionsCovered: ["Worldwide"],
      durationOptions: [365],
      tier: "premium",
    },
    {
      name: "Student Abroad",
      shortDescription: "Long-term coverage for studying overseas",
      description: "Designed for students studying abroad. Affordable long-term coverage with benefits tailored to academic life overseas.",
      currency: "USD",
      price: 12999,
      discountPrice: 9999,
      active: true,
      coverageHighlights: ["Emergency Medical $100,000", "Mental Health Coverage", "Study Interruption $5,000", "Personal Liability $50,000", "Baggage Loss $1,000", "24/7 Student Support"],
      regionsCovered: ["Worldwide"],
      durationOptions: [90, 180, 365],
      tier: "standard",
    },
    {
      name: "Senior Secure",
      shortDescription: "Specialized coverage for travelers 65+",
      description: "Comprehensive coverage designed specifically for senior travelers. No age limits and includes pre-existing condition coverage as standard.",
      currency: "USD",
      price: 15999,
      discountPrice: null,
      active: true,
      coverageHighlights: ["Emergency Medical $300,000", "Pre-existing Conditions Included", "Medical Evacuation $1,000,000", "Trip Cancellation $8,000", "Baggage Loss $2,000", "Dedicated Senior Support Line"],
      regionsCovered: ["Worldwide"],
      durationOptions: [7, 14, 21, 30, 45],
      tier: "premium",
    },
  ];

  const insertedProducts = await db.insert(products).values(productsData).returning();
  console.log(`Inserted ${insertedProducts.length} products`);

  // Add media for each product
  const mediaData = insertedProducts.map((product, index) => ({
    productId: product.id,
    type: "image",
    url: `https://placehold.co/600x400/1a1a1a/ffffff?text=${encodeURIComponent(product.name)}`,
    alt: `${product.name} travel insurance`,
    sortOrder: 0,
  }));

  const insertedMedia = await db.insert(productMedia).values(mediaData).returning();
  console.log(`Inserted ${insertedMedia.length} product media items`);

  console.log("Seeding complete!");
}

seed().catch(console.error);
