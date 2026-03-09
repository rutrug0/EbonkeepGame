import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPlayers() {
  console.log('🔍 Checking test players...\n');
  
  const testPlayers = await prisma.playerProfile.findMany({
    where: {
      id: { startsWith: 'test_player_' }
    }
  });
  
  console.log(`📦 Found ${testPlayers.length} test players\n`);
  
  for (const player of testPlayers) {
    console.log(`  ✓ ${player.id} - Level ${player.level}`);
  }
  
  await prisma.$disconnect();
}

checkPlayers().catch(console.error);
