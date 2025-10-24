// Check sessions to see installed stores
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSessions() {
  const sessions = await prisma.session.findMany({
    select: {
      shop: true,
      isOnline: true,
      expires: true,
    },
    distinct: ['shop'],
  });

  console.log(`Total unique shops with sessions: ${sessions.length}\n`);

  sessions.forEach(s => {
    console.log(`Shop: ${s.shop}`);
    console.log(`  Online: ${s.isOnline}`);
    console.log(`  Expires: ${s.expires || 'Never'}\n`);
  });

  // Also check if Minky is in sessions
  const minkySession = await prisma.session.findFirst({
    where: {
      shop: { contains: 'minky', mode: 'insensitive' }
    }
  });

  if (minkySession) {
    console.log('✅ Found Minky session!');
    console.log(`Shop: ${minkySession.shop}`);
  } else {
    console.log('❌ No Minky session found');
  }

  await prisma.$disconnect();
}

checkSessions().catch(console.error);
