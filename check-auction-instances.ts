import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkItems() {
  console.log('🔍 Checking auction instances and items...\n');
  
  const instances = await prisma.auctionInstance.findMany({
    include: {
      items: {
        take: 3
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  
  console.log(`📦 Found ${instances.length} auction instances\n`);
  
  for (const instance of instances) {
    console.log(`Auction [${instance.levelBracketMin}-${instance.levelBracketMax}]: ${instance.items.length} items`);
    console.log(`  Status: ${instance.status}`);
    console.log(`  Ends: ${instance.endTime}`);
    
    for (const item of instance.items.slice(0, 3)) {
      const itemData = JSON.parse(item.itemCode);
      console.log(`  ✓ ${itemData.name} (${item.itemRarity})`);
      console.log(`    Icon: ${itemData.iconAssetPath || 'MISSING!'}`);
    }
    console.log('');
  }
  
  await prisma.$disconnect();
}

checkItems().catch(console.error);
