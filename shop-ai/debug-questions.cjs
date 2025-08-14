// Debug script to test question storage and retrieval
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testQuestionStorage() {
  console.log('🔍 Testing question storage and retrieval...\n');

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');

    // Get all shops that have questions
    console.log('2. Checking all shops with questions...');
    const allQuestions = await prisma.customerQuestion.findMany({
      select: {
        shop: true,
        question: true,
        times: true,
        askedAt: true
      },
      orderBy: {
        askedAt: 'desc'
      }
    });
    
    if (allQuestions.length === 0) {
      console.log('❌ No questions found in database');
    } else {
      console.log(`✅ Found ${allQuestions.length} questions:`);
      allQuestions.forEach((q, i) => {
        console.log(`   ${i + 1}. Shop: ${q.shop}`);
        console.log(`      Question: "${q.question}"`);
        console.log(`      Times asked: ${q.times}`);
        console.log(`      Last asked: ${q.askedAt.toISOString()}`);
        console.log('');
      });
    }

    // Test inserting a sample question
    console.log('3. Testing question insertion...');
    const testShop = 'test-shop.myshopify.com';
    const testQuestion = 'what are your shipping rates?';
    
    const result = await prisma.customerQuestion.upsert({
      where: {
        shop_question: {
          shop: testShop,
          question: testQuestion
        }
      },
      update: {
        times: { increment: 1 },
        askedAt: new Date()
      },
      create: {
        shop: testShop,
        question: testQuestion
      }
    });
    
    console.log('✅ Test question upserted successfully:', {
      id: result.id,
      shop: result.shop,
      question: result.question,
      times: result.times
    });

    // Get questions grouped by shop
    console.log('\n4. Questions grouped by shop:');
    const questionsByShop = await prisma.customerQuestion.groupBy({
      by: ['shop'],
      _count: {
        _all: true
      },
      _sum: {
        times: true
      }
    });

    questionsByShop.forEach(shop => {
      console.log(`   📍 ${shop.shop}: ${shop._count._all} unique questions, ${shop._sum.times} total asks`);
    });

  } catch (error) {
    console.error('❌ Error during testing:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Also export functions for manual testing
async function getQuestionsForShop(shop) {
  try {
    const questions = await prisma.customerQuestion.findMany({
      where: { shop },
      orderBy: { times: 'desc' }
    });
    console.log(`Questions for ${shop}:`, questions);
    return questions;
  } catch (error) {
    console.error('Error fetching questions for shop:', error);
    return [];
  }
}

async function deleteTestData() {
  try {
    const deleted = await prisma.customerQuestion.deleteMany({
      where: {
        shop: 'test-shop.myshopify.com'
      }
    });
    console.log(`Deleted ${deleted.count} test questions`);
    return deleted;
  } catch (error) {
    console.error('Error deleting test data:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testQuestionStorage();
}

module.exports = {
  testQuestionStorage,
  getQuestionsForShop,
  deleteTestData
};