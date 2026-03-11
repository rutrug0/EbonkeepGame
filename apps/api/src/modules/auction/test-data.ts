import type { PrismaClient } from "@prisma/client";

/**
 * Test data generator for auction system
 * Creates mock data for testing without needing a full game state
 */
export class AuctionTestDataGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create test players with varying levels and currency
   */
  async createTestPlayers(count: number = 10): Promise<string[]> {
    const playerIds: string[] = [];

    for (let i = 1; i <= count; i++) {
      const level = Math.floor(Math.random() * 100) + 1;
      const ducats = 10000 + Math.floor(Math.random() * 90000); // 10k-100k ducats

      // Create test account first
      const account = await this.prisma.account.upsert({
        where: { email: `test_account_${i}@auction.test` },
        update: {},
        create: {
          id: `test_account_${i}`,
          provider: "local",
          providerUserId: `test_user_${i}`,
          email: `test_account_${i}@auction.test`,
          passwordHash: "test_hash",
          emailVerified: true
        }
      });

      // Create player profile
      const player = await this.prisma.playerProfile.upsert({
        where: { id: `test_player_${i}` },
        update: { level, gearScore: level * 10 },
        create: {
          id: `test_player_${i}`,
          accountId: account.id,
          class: "warrior",
          level,
          gearScore: level * 10,
          preferredLocale: "en"
        }
      });

      // Create currency balance
      await this.prisma.currencyBalance.upsert({
        where: { playerId: player.id },
        update: { ducats },
        create: {
          playerId: player.id,
          ducats,
          imperials: 0
        }
      });

      playerIds.push(player.id);
      console.log(`Created test player: ${player.id} (Level ${level}, ${ducats} ducats)`);
    }

    return playerIds;
  }

  /**
   * Create test player submissions (items to auction)
   */
  async createTestSubmissions(playerIds: string[], count: number = 5): Promise<void> {
    const testItems = [
      // Swords (epic/rare)
      {
        name: "Valdaryn",
        level: 25,
        rarity: "epic",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 160, critChance: 20, armorPen: 12 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_valdaryn.png"
      },
      {
        name: "Crestfall Greatsword",
        level: 24,
        rarity: "epic",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 155, critChance: 18, cleave: 10 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_crestfall_greatsword.png"
      },
      {
        name: "Rivenspire Greatsword",
        level: 23,
        rarity: "epic",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 150, cleave: 15, armorPen: 10 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_rivenspire_greatsword.png"
      },
      {
        name: "Gilded Bastard Sword",
        level: 22,
        rarity: "rare",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 125, critChance: 14 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_gilded_bastard_sword.png"
      },
      {
        name: "Damascus Steel",
        level: 21,
        rarity: "rare",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 118, attackSpeed: 12 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_damascus_steel.png"
      },
      {
        name: "Imperial Warblade",
        level: 22,
        rarity: "rare",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 128, critDamage: 20 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_imperial_warblade.png"
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
        name: "Greyfen Blade",
        level: 20,
        rarity: "rare",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 115, critChance: 12 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_greyfen_blade.png"
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
      {
        name: "Plainsteel Longsword",
        level: 18,
        rarity: "uncommon",
        category: "weapon",
        weaponType: "sword",
        stats: { power: 95, critChance: 10 },
        iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_plainsteel_longsword.png"
      },
      // Axes (epic/rare)
      {
        name: "Harthorn",
        level: 22,
        rarity: "epic",
        category: "weapon",
        weaponType: "axe",
        stats: { power: 140, critChance: 16, cleave: 15 },
        iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_harthorn.png"
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
        name: "Dornhal Greataxe",
        level: 24,
        rarity: "epic",
        category: "weapon",
        weaponType: "axe",
        stats: { power: 158, cleave: 22, armorPen: 8 },
        iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_dornhal_greataxe.png"
      },
      {
        name: "Kingsreach Axe",
        level: 21,
        rarity: "rare",
        category: "weapon",
        weaponType: "axe",
        stats: { power: 120, critChance: 13, cleave: 12 },
        iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_kingsreach_axe.png"
      },
      {
        name: "Blackmoor Cleaver",
        level: 20,
        rarity: "rare",
        category: "weapon",
        weaponType: "axe",
        stats: { power: 118, cleave: 14 },
        iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_blackmoor_cleaver.png"
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
      // Armor (epic/rare)
      {
        name: "Dreadmere Waistguard",
        level: 22,
        rarity: "epic",
        category: "armor",
        armorType: "heavy",
        slot: "belt",
        stats: { defense: 115, health: 220, blockChance: 8 },
        iconAssetPath: "/assets/items/generated/armor/heavy/belt/heavy_armor_dreadmere_waistguard.png"
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
      {
        name: "Crestfall Cincture",
        level: 21,
        rarity: "rare",
        category: "armor",
        armorType: "heavy",
        slot: "belt",
        stats: { defense: 95, stamina: 120 },
        iconAssetPath: "/assets/items/generated/armor/heavy/belt/heavy_armor_crestfall_cincture.png"
      },
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
      // Jewelry (epic/rare)
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
        name: "Star Amulet",
        level: 20,
        rarity: "rare",
        category: "jewelry",
        jewelryType: "necklace",
        stats: { power: 45, critDamage: 15 },
        iconAssetPath: "/assets/items/generated/jewelry/necklace/necklace_star_amulet.png"
      },
      {
        name: "Moon Talisman",
        level: 21,
        rarity: "rare",
        category: "jewelry",
        jewelryType: "necklace",
        stats: { power: 48, manaRegen: 15 },
        iconAssetPath: "/assets/items/generated/jewelry/necklace/necklace_moon_talisman.png"
      },
      {
        name: "Meridian Ring",
        level: 20,
        rarity: "rare",
        category: "jewelry",
        jewelryType: "ring",
        stats: { power: 50, critDamage: 18 },
        iconAssetPath: "/assets/items/generated/jewelry/ring/ring_meridian_ring.png"
      },
      {
        name: "Seraph Loop",
        level: 21,
        rarity: "rare",
        category: "jewelry",
        jewelryType: "ring",
        stats: { health: 180, healthRegen: 12 },
        iconAssetPath: "/assets/items/generated/jewelry/ring/ring_seraph_loop.png"
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
        name: "Bastion Medal",
        level: 19,
        rarity: "uncommon",
        category: "jewelry",
        jewelryType: "necklace",
        stats: { defense: 40, health: 100 },
        iconAssetPath: "/assets/items/generated/jewelry/necklace/necklace_bastion_medal.png"
      }
    ];

    for (let i = 0; i < Math.min(count, testItems.length); i++) {
      const playerId = playerIds[Math.floor(Math.random() * playerIds.length)];
      const itemData = testItems[i];

      await this.prisma.auctionPlayerListing.create({
        data: {
          playerId,
          inventoryItemId: `temp_${i}`,
          itemCode: JSON.stringify(itemData),
          itemLevel: itemData.level,
          itemRarity: itemData.rarity,
          minimumBid: 300 + i * 150,
          status: "pending"
        }
      });

      console.log(`Created test submission: ${itemData.name} by ${playerId}`);
    }
  }

  /**
   * Auto-approve all pending submissions
   */
  async approveAllSubmissions(adminId: string = "admin"): Promise<number> {
    const result = await this.prisma.auctionPlayerListing.updateMany({
      where: { status: "pending" },
      data: {
        status: "approved",
        approvedBy: adminId,
        approvedAt: new Date()
      }
    });

    console.log(`Approved ${result.count} submissions`);
    return result.count;
  }

  /**
   * Simulate random bids on active auction items
   */
  async simulateRandomBids(playerIds: string[], bidCount: number = 20): Promise<void> {
    const activeItems = await this.prisma.auctionItem.findMany({
      where: {
        auctionInstance: { status: "active" }
      },
      take: 10
    });

    if (activeItems.length === 0) {
      console.log("No active items to bid on. Create auctions first.");
      return;
    }

    for (let i = 0; i < bidCount; i++) {
      const item = activeItems[Math.floor(Math.random() * activeItems.length)];
      const playerId = playerIds[Math.floor(Math.random() * playerIds.length)];

      // Calculate minimum bid
      const minBid = item.currentBid === 0 ? item.startingBid : item.currentBid + 50;
      const bidAmount = minBid + Math.floor(Math.random() * 200);

      try {
        await this.prisma.auctionBid.create({
          data: {
            itemId: item.id,
            playerId,
            bidAmount,
            status: "active"
          }
        });

        await this.prisma.auctionItem.update({
          where: { id: item.id },
          data: {
            currentBid: bidAmount,
            currentWinnerId: playerId,
            bidCount: { increment: 1 }
          }
        });

        console.log(`Bid ${bidAmount} ducats on ${item.id} by ${playerId}`);
      } catch (error) {
        // Skip errors (e.g., insufficient funds)
        console.log(`Bid failed: ${error}`);
      }
    }
  }

  /**
   * Clean up all test data
   */
  async cleanupTestData(): Promise<void> {
    console.log("Cleaning up test data...");

    await this.prisma.auctionBid.deleteMany({});
    await this.prisma.auctionItem.deleteMany({});
    await this.prisma.auctionInstance.deleteMany({});
    await this.prisma.auctionPendingReward.deleteMany({});
    await this.prisma.auctionParticipation.deleteMany({});
    await this.prisma.auctionPlayerListing.deleteMany({});

    // Clean up test players
    await this.prisma.currencyBalance.deleteMany({
      where: { playerId: { startsWith: "test_player_" } }
    });
    await this.prisma.playerProfile.deleteMany({
      where: { id: { startsWith: "test_player_" } }
    });
    await this.prisma.account.deleteMany({
      where: { email: { contains: "@auction.test" } }
    });

    console.log("Test data cleaned up");
  }

  /**
   * Full test data setup workflow
   */
  async setupFullTestEnvironment(): Promise<void> {
    console.log("\n=== Setting up test environment ===\n");

    // 1. Create test players
    const playerIds = await this.createTestPlayers(10);
    console.log(`\n✓ Created ${playerIds.length} test players\n`);

    // 2. Create test submissions (need enough for all level brackets)
    // With 10 level brackets * 6 items per bracket = 60 items needed
    // We have 28 unique items, so create multiple copies
    const submissionsNeeded = 60;
    for (let batch = 0; batch < Math.ceil(submissionsNeeded / 28); batch++) {
      await this.createTestSubmissions(playerIds, Math.min(28, submissionsNeeded - batch * 28));
    }
    console.log(`\n✓ Created ${submissionsNeeded} test submissions\n`);

    // 3. Auto-approve submissions
    await this.approveAllSubmissions("admin");
    console.log("\n✓ Approved all submissions\n");

    console.log("=== Test environment ready ===");
    console.log("\nNext steps:");
    console.log("1. POST /v1/auction/test/create-auctions");
    console.log("2. GET /v1/auction/active (with any test player token)");
    console.log("3. POST /v1/auction/bid");
    console.log("\n");
  }
}

/**
 * CLI script to setup test data
 * Run with: npx tsx src/modules/auction/test-data.ts
 */

// Auto-execute if run directly
(async () => {
  // Import prisma (adjust path as needed)
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const generator = new AuctionTestDataGenerator(prisma);

  const command = process.argv[2] || "setup";

  switch (command) {
    case "setup":
      await generator.setupFullTestEnvironment();
      break;
    case "cleanup":
      await generator.cleanupTestData();
      break;
    case "bids": {
      const playerCount = parseInt(process.argv[3] || "10");
      const bidCount = parseInt(process.argv[4] || "20");
      const playerIds = Array.from({ length: playerCount }, (_, i) => `test_player_${i + 1}`);
      await generator.simulateRandomBids(playerIds, bidCount);
      break;
    }
    default:
      console.log("Usage: npx tsx test-data.ts [setup|cleanup|bids]");
  }

  await prisma.$disconnect();
})();
