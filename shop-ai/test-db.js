// shop-ai/test-db.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Attempting to connect to the database...');
  try {
    await prisma.$connect();
    console.log('Database connection successful.');

    const shop = 'test-shop.myshopify.com';
    const question = `test question from script at ${new Date().toISOString()}`;

    console.log(`Attempting to create record: { shop: "${shop}", question: "${question}" }`);

    const result = await prisma.customerQuestion.create({
      data: {
        shop: shop,
        question: question,
        times: 1,
      },
    });

    console.log('✅ Successfully created test question!', result);
  } catch (e) {
    console.error('❌ DATABASE SCRIPT FAILED:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
