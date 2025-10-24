// Script to find Minky Muffins store in database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findMinkyStore() {
  try {
    console.log('🔍 Searching for Minky Muffins store...\n');

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
      console.log('❌ No stores found matching "minky" or "muffin"\n');

      // Show all stores for reference
      console.log('📊 Showing all stores in database:\n');
      const allStores = await prisma.storeInformation.findMany({
        select: {
          shop: true,
          storeName: true,
          pricingPlan: true,
          subscriptionStatus: true,
        },
        orderBy: { shop: 'asc' },
      });

      allStores.forEach((store, index) => {
        console.log(`${index + 1}. ${store.shop}`);
        console.log(`   Store Name: ${store.storeName || 'N/A'}`);
        console.log(`   Plan: ${store.pricingPlan || 'N/A'}`);
        console.log(`   Status: ${store.subscriptionStatus || 'N/A'}\n`);
      });
    } else {
      console.log(`✅ Found ${stores.length} matching store(s):\n`);

      stores.forEach((store, index) => {
        console.log(`${index + 1}. Shop: ${store.shop}`);
        console.log(`   Store Name: ${store.storeName || 'N/A'}`);
        console.log(`   Pricing Plan: ${store.pricingPlan || 'N/A'}`);
        console.log(`   Subscription Status: ${store.subscriptionStatus || 'N/A'}`);
        console.log(`   Plan Start Date: ${store.planStartDate || 'N/A'}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findMinkyStore();
