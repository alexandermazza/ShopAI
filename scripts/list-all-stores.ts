// Simple script to list all stores
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listStores() {
  const stores = await prisma.storeInformation.findMany({
    select: {
      shop: true,
      storeName: true,
      pricingPlan: true,
      subscriptionStatus: true,
    },
  });

  console.log(`Total stores: ${stores.length}\n`);

  stores.forEach(s => {
    console.log(`Shop: ${s.shop}`);
    if (s.storeName) console.log(`  Name: ${s.storeName}`);
    if (s.pricingPlan) console.log(`  Plan: ${s.pricingPlan}`);
    if (s.subscriptionStatus) console.log(`  Status: ${s.subscriptionStatus}`);
    console.log('');
  });

  await prisma.$disconnect();
}

listStores().catch(console.error);
