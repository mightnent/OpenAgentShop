import { db } from "./index";
import { products, productMedia } from "./schema";

async function seed() {
  console.log("Seeding database...");

  // Insert products
  const inserted = await db
    .insert(products)
    .values([
    {
      catalogId: "bill-sample-1",
      name: "Mobile Bill - 81132253",
      price: 8500,
      active: true,
      description: "Outstanding mobile bill for account 81132253. Includes data, calls, and SMS charges for the current billing period.",
      tier: "postpaid",
      category: "Mobile Bill",
      accountNumber: "81132253",
      billAmount: 8500,
      dueDate: "2026-02-15",
      billingPeriod: "Jan 1 - Jan 31, 2026",
      planType: "XO Plus 50GB",
      dataUsage: "38GB / 50GB",
      overdue: false,
    },
    {
      catalogId: "bill-sample-2",
      name: "Mobile Bill - 91234567",
      price: 12500,
      active: true,
      description: "Outstanding mobile bill for account 91234567. Standard postpaid plan with additional roaming charges.",
      tier: "postpaid",
      category: "Mobile Bill",
      accountNumber: "91234567",
      billAmount: 12500,
      dueDate: "2026-02-10",
      billingPeriod: "Jan 1 - Jan 31, 2026",
      planType: "Combo 12",
      dataUsage: "15GB / 20GB",
      overdue: true,
    }
    ])
    .returning({ id: products.id, catalogId: products.catalogId });

  // Build a map of catalogId → DB id for media references
  const productMap: Record<string, number> = {};
  for (const row of inserted) {
    productMap[row.catalogId] = row.id;
  }

  console.log(`Inserted ${inserted.length} products`);

  // Insert product media
  await db.insert(productMedia).values([
    { productId: productMap["bill-sample-1"], type: "image", url: "https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Singtel+Bill", alt: "Singtel Mobile Bill", sortOrder: 0 },
    { productId: productMap["bill-sample-2"], type: "image", url: "https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Singtel+Bill", alt: "Singtel Mobile Bill", sortOrder: 0 }
  ]);

  console.log("Inserted product media");

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
