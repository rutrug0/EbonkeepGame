/**
 * Script to create test inventory items for a specific player
 * Usage: npx tsx create-test-inventory.ts <email>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTestInventory(email: string) {
  console.log(`\n🔍 Looking for account: ${email}`);

  // Find account by email
  const account = await prisma.account.findUnique({
    where: { email },
    include: {
      profiles: true
    }
  });

  if (!account) {
    console.error(`❌ Account not found: ${email}`);
    return;
  }

  if (account.profiles.length === 0) {
    console.error(`❌ No player profile found for account: ${email}`);
    return;
  }

  const player = account.profiles[0];
  console.log(`✅ Found player: ${player.id} (Level ${player.level}, ${player.class})`);

  // Check existing inventory
  const existingItems = await prisma.inventoryItem.count({
    where: { playerId: player.id }
  });

  console.log(`📦 Current inventory: ${existingItems} items`);

  // Create test items with REAL image paths
  const testItems = [
    // Weapons - using actual files from /assets/items/generated/weapon/
    {
      name: "Plainsteel Longsword",
      level: 18,
      rarity: "uncommon",
      category: "weapon",
      weaponType: "sword",
      stats: { power: 95, critChance: 10 },
      iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_plainsteel_longsword.png"
    },
    {
      name: "Bearded War Axe",
      level: 19,
      rarity: "rare",
      category: "weapon",
      weaponType: "axe",
      stats: { power: 110, critChance: 12 },
      iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_bearded_war_axe.png"
    },
    {
      name: "Highguard Claymore",
      level: 22,
      rarity: "epic",
      category: "weapon",
      weaponType: "sword",
      stats: { power: 145, critChance: 18, armorPen: 10 },
      iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_highguard_claymore.png"
    },
    {
      name: "Stormvale Axe",
      level: 22,
      rarity: "epic",
      category: "weapon",
      weaponType: "axe",
      stats: { power: 150, critChance: 15, cleave: 20 },
      iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_stormvale_axe.png"
    },
    {
      name: "Redmark Sabre",
      level: 20,
      rarity: "rare",
      category: "weapon",
      weaponType: "sword",
      stats: { power: 115, attackSpeed: 15 },
      iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_redmark_sabre.png"
    },
    // Armor - using actual files
    {
      name: "Imperial Waistguard",
      level: 20,
      rarity: "rare",
      category: "armor",
      armorType: "heavy",
      slot: "belt",
      stats: { defense: 85, health: 150 },
      iconAssetPath: "/assets/items/generated/armor/heavy/belt/heavy_armor_imperial_waistguard.png"
    },
    {
      name: "Garrison Warbelt",
      level: 18,
      rarity: "uncommon",
      category: "armor",
      armorType: "heavy",
      slot: "belt",
      stats: { defense: 65, stamina: 100 },
      iconAssetPath: "/assets/items/generated/armor/heavy/belt/heavy_armor_garrison_warbelt.png"
    },
    {
      name: "Highguard Warbelt",
      level: 22,
      rarity: "epic",
      category: "armor",
      armorType: "heavy",
      slot: "belt",
      stats: { defense: 110, health: 200, blockChance: 5 },
      iconAssetPath: "/assets/items/generated/armor/heavy/belt/heavy_armor_highguard_warbelt.png"
    },
    // Jewelry - using actual files
    {
      name: "Star Amulet",
      level: 20,
      rarity: "rare",
      category: "jewelry",
      jewelryType: "necklace",
      stats: { power: 45, critDamage: 15 },
      iconAssetPath: "/assets/items/generated/jewelry/necklace/necklace_star_amulet.png"
    },
    {
      name: "Storm Band",
      level: 22,
      rarity: "epic",
      category: "jewelry",
      jewelryType: "ring",
      stats: { power: 55, critChance: 12, attackSpeed: 8 },
      iconAssetPath: "/assets/items/generated/jewelry/ring/ring_storm_band.png"
    },
    {
      name: "Firstlight Band",
      level: 18,
      rarity: "uncommon",
      category: "jewelry",
      jewelryType: "ring",
      stats: { health: 120, healthRegen: 8 },
      iconAssetPath: "/assets/items/generated/jewelry/ring/ring_firstlight_band.png"
    },
    {
      name: "Seraph Loop",
      level: 21,
      rarity: "rare",
      category: "jewelry",
      jewelryType: "ring",
      stats: { defense: 50, evasion: 12 },
      iconAssetPath: "/assets/items/generated/jewelry/ring/ring_seraph_loop.png"
    }
  ];

  console.log(`\n📝 Creating ${testItems.length} test items...`);

  let created = 0;
  for (const itemData of testItems) {
    try {
      const item = await prisma.inventoryItem.create({
        data: {
          playerId: player.id,
          itemCode: JSON.stringify(itemData),
          slotKey: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          quantity: 1
        }
      });

      console.log(`  ✓ Created: ${itemData.name} (${itemData.rarity} ${itemData.category})`);
      created++;
    } catch (error) {
      console.error(`  ✗ Failed to create ${itemData.name}:`, error);
    }
  }

  console.log(`\n✅ Successfully created ${created}/${testItems.length} items`);

  // Show final inventory count
  const finalCount = await prisma.inventoryItem.count({
    where: { playerId: player.id }
  });

  console.log(`📦 Final inventory: ${finalCount} items\n`);
}

// CLI execution
const email = process.argv[2] || "pat.kredatus@gmail.com";

createTestInventory(email)
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
