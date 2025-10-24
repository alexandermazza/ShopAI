// Query PRODUCTION database for Minky Muffins store
import { PrismaClient } from '@prisma/client';

// Use production database URL via local proxy
const PRODUCTION_DB_URL = process.env.PRODUCTION_DB_URL || 'postgres://postgres:nafhE57XilGW5LM@localhost:5433/shop_ai_dev?sslmode=disable';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PRODUCTION_DB_URL,
    },
  },
});

async function findMinkyStore() {
  try {
    console.log('🔍 Searching PRODUCTION database for Minky Muffins store...\n');

    // Search for stores matching "minky" or "muffin"
    const stores = await prisma.storeInformation.findMany({
      where: {
        OR: [
          { shop: { contains: 'minky', mode: 'insensitive' } },
          { shop: { contains: 'muffin', mode: 'insensitive' } },
          { storeName: { contains: 'minky', mode: 'insensitive' } },
          { storeName: { contains: 'muffin', mode: 'insensitive' } },
        ],
      },
      select: {
        shop: true,
        storeName: true,
        pricingPlan: true,
        subscriptionStatus: true,
        planStartDate: true,
      },
    });

    if (stores.length === 0) {
      console.log('❌ No stores found matching "minky" or "muffin" in production\n');

      // Show all stores for reference
      console.log('📊 Showing all stores in PRODUCTION database:\n');
      const allStores = await prisma.storeInformation.findMany({
        select: {
          shop: true,
          storeName: true,
          pricingPlan: true,
          subscriptionStatus: true,
        },
        orderBy: { shop: 'asc' },
      });

      console.log(`Total stores: ${allStores.length}\n`);

      allStores.forEach((store, index) => {
        console.log(`${index + 1}. ${store.shop}`);
        if (store.storeName) console.log(`   Store Name: ${store.storeName}`);
        if (store.pricingPlan) console.log(`   Plan: ${store.pricingPlan}`);
        if (store.subscriptionStatus) console.log(`   Status: ${store.subscriptionStatus}`);
        console.log('');
      });
    } else {
      console.log(`✅ Found ${stores.length} matching store(s) in PRODUCTION:\n`);

      stores.forEach((store, index) => {
        console.log(`${index + 1}. Shop: ${store.shop}`);
        console.log(`   Store Name: ${store.storeName || 'N/A'}`);
        console.log(`   Pricing Plan: ${store.pricingPlan || 'N/A'}`);
        console.log(`   Subscription Status: ${store.subscriptionStatus || 'N/A'}`);
        console.log(`   Plan Start Date: ${store.planStartDate || 'N/A'}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error querying production database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findMinkyStore();
