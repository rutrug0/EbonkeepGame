import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAuctionItems() {
  console.log('🔍 Checking auction items...');
  
  const items = await prisma.auctionItem.findMany({
    take: 10,
    include: { auctionInstance: true },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`\n📦 Found ${items.length} auction items:\n`);
  
  for (const item of items) {
    const itemData = JSON.parse(item.itemCode);
    console.log(`  ✓ ${itemData.name} (${item.itemRarity})`);
    console.log(`    Category: ${item.itemCategory} | Level: ${item.itemLevel}`);
    console.log(`    Icon: ${itemData.iconAssetPath || 'MISSING!'}`);
    console.log(`    Starting bid: ${item.startingBid} ducats`);
    console.log(`    Auction: ${item.auctionInstance?.startsAt} - ${item.auctionInstance?.endsAt}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

checkAuctionItems().catch(console.error);
