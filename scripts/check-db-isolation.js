import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkStoreIsolation() {
  try {
    // Get all stores
    const stores = await prisma.storeInformation.findMany({
      select: {
        shop: true,
        additionalInfo: true,
      }
    });

    console.log('\n📊 DATABASE ISOLATION CHECK\n');
    console.log('Total stores in database:', stores.length);
    console.log('\n');

    stores.forEach((store, idx) => {
      console.log('Store', idx + 1 + ':');
      console.log('  Shop Domain:', store.shop);
      console.log('  Has Additional Info:', store.additionalInfo ? 'Yes' : 'No');
      if (store.additionalInfo) {
        const preview = store.additionalInfo.substring(0, 100);
        console.log('  Preview:', preview + (store.additionalInfo.length > 100 ? '...' : ''));
      }
      console.log('');
    });

    // Check for duplicates
    const shopCounts = {};
    stores.forEach(store => {
      shopCounts[store.shop] = (shopCounts[store.shop] || 0) + 1;
    });

    const duplicates = Object.entries(shopCounts).filter(([shop, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('⚠️  WARNING: Duplicate shop entries found:');
      duplicates.forEach(([shop, count]) => console.log('  -', shop + ':', count, 'entries'));
    } else {
      console.log('✅ No duplicate shop entries - data is properly isolated');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkStoreIsolation();
