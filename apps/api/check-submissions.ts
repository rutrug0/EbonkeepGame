import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSubmissions() {
  console.log('🔍 Checking player submissions...');
  
  const allListings = await prisma.auctionPlayerListing.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`\n📦 Total submissions: ${allListings.length}\n`);
  
  const byStatus = {
    pending: allListings.filter(l => l.status === 'pending').length,
    approved: allListings.filter(l => l.status === 'approved').length,
    rejected: allListings.filter(l => l.status === 'rejected').length,
    added: allListings.filter(l => l.auctionItemId !== null).length,
    available: allListings.filter(l => l.status === 'approved' && l.auctionItemId === null).length
  };
  
  console.log('Status breakdown:');
  console.log(`  Pending: ${byStatus.pending}`);
  console.log(`  Approved: ${byStatus.approved}`);
  console.log(`  Rejected: ${byStatus.rejected}`);
  console.log(`  Already used in auctions: ${byStatus.added}`);
  console.log(`  Available for auctions: ${byStatus.available}`);
  console.log('');
  
  if (byStatus.available > 0) {
    console.log('Available items:');
    const available = allListings.filter(l => l.status === 'approved' && l.auctionItemId === null);
    for (const item of available) {
      const itemData = JSON.parse(item.itemCode);
      console.log(`  ✓ ${itemData.name} (${item.itemRarity}) - Lv ${item.itemLevel}`);
    }
  }
  
  await prisma.$disconnect();
}

checkSubmissions().catch(console.error);
