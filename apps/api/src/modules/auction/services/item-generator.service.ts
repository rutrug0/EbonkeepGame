import { AuctionConfigService } from "./config.service.js";

/**
 * Service for generating mock auction items
 * V1: System-generated items with config-driven distribution
 */
export class AuctionItemGeneratorService {
  private config = AuctionConfigService.getInstance().getConfig();
  private rarities = ["common", "uncommon", "rare", "epic"] as const;
  private categories = ["weapon", "armor", "jewelry"] as const;
  private classes = ["warrior", "mage", "ranger"] as const;

  // Asset pools for random icon selection
  private assetPools = {
    weaponSwords: [
      "warrior_melee_brackenhilt.png",
      "warrior_melee_crestfall_greatsword.png",
      "warrior_melee_damascus_steel.png",
      "warrior_melee_gilded_bastard_sword.png",
      "warrior_melee_greyfen_blade.png",
      "warrior_melee_highguard_claymore.png",
      "warrior_melee_imperial_warblade.png",
      "warrior_melee_iron_shortsword.png",
      "warrior_melee_knight_s_arming_sword.png",
      "warrior_melee_plainsteel_longsword.png",
      "warrior_melee_redmark_sabre.png",
      "warrior_melee_rivenspire_greatsword.png",
      "warrior_melee_silvermark_longblade.png",
      "warrior_melee_tempered_longblade.png",
      "warrior_melee_valdaryn.png",
      "warrior_melee_valenmark.png"
    ],
    weaponAxes: [
      "warrior_melee_bearded_war_axe.png",
      "warrior_melee_blackmoor_cleaver.png",
      "warrior_melee_dornhal_greataxe.png",
      "warrior_melee_durnholde_axe.png",
      "warrior_melee_frosthollow_axe.png",
      "warrior_melee_harthorn.png",
      "warrior_melee_kingsreach_axe.png",
      "warrior_melee_stormvale_axe.png",
      "warrior_melee_woodcutter_s_axe.png"
    ],
    armorBelts: [
      "heavy_armor_bastion_waistguard.png",
      "heavy_armor_blackmark_girdle.png",
      "heavy_armor_crestfall_cincture.png",
      "heavy_armor_dreadmere_waistguard.png",
      "heavy_armor_durnhold_warbelt.png",
      "heavy_armor_garrison_warbelt.png",
      "heavy_armor_greyfen_girdle.png",
      "heavy_armor_highguard_warbelt.png",
      "heavy_armor_imperial_waistguard.png",
      "heavy_armor_iron_warbelt.png",
      "heavy_armor_kingsreach_girdle.png",
      "heavy_armor_plainsteel_warbelt.png",
      "heavy_armor_sentinel_s_cincture.png",
      "heavy_armor_silvermark_girdle.png",
      "heavy_armor_stormhold_waistguard.png"
    ],
    jewelryRings: [
      "ring_firstlight_band.png",
      "ring_meridian_ring.png",
      "ring_seraph_loop.png",
      "ring_storm_band.png",
      "ring_twilight_signet.png",
      "ring_valdoryn_seal.png"
    ],
    jewelryNecklaces: [
      "necklace_bastion_medal.png",
      "necklace_moon_talisman.png",
      "necklace_star_amulet.png",
      "necklace_zenith_pendant.png"
    ]
  };

  /**
   * Generate items for an auction using configured rarity distribution
   * @param levelBracketMin Minimum level for bracket
   * @param levelBracketMax Maximum level for bracket
   * @param count Number of items to generate
   */
  async generateItemsForAuction(
    levelBracketMin: number,
    levelBracketMax: number,
    count: number
  ) {
    const items = [];

    for (let i = 0; i < count; i++) {
      const rarity = this.selectRarityByDistribution();
      items.push(this.generateItem(levelBracketMin, levelBracketMax, rarity));
    }

    // Ensure class diversity (best effort)
    return this.ensureClassDiversity(items);
  }

  /**
   * Select rarity based on configured distribution
   */
  private selectRarityByDistribution(): "common" | "uncommon" | "rare" | "epic" {
    const dist = this.config.items.rarityDistribution;
    const total = dist.common + dist.uncommon + dist.rare + dist.epic;
    const roll = Math.random() * total;

    let cumulative = 0;
    if (roll < (cumulative += dist.common)) return "common";
    if (roll < (cumulative += dist.uncommon)) return "uncommon";
    if (roll < (cumulative += dist.rare)) return "rare";
    return "epic";
  }

  /**
   * Generate a single item
   */
  private generateItem(
    levelMin: number,
    levelMax: number,
    rarity: "common" | "uncommon" | "rare" | "epic"
  ) {
    const itemLevel = this.randomInt(levelMin, levelMax);
    const category = this.randomChoice(this.categories);
    const targetClass = this.randomChoice(this.classes);

    const itemData = {
      name: this.generateItemName(category, rarity, targetClass),
      level: itemLevel,
      rarity,
      category,
      targetClass,
      // Mock stats (replace with real item generation later)
      stats: this.generateMockStats(itemLevel, rarity, category),
      iconAssetPath: this.getRandomIconPath(category, targetClass)
    };

    const startingBid = this.calculateStartingBid(itemLevel, rarity);

    return {
      itemLevel,
      itemRarity: rarity,
      itemCategory: category,
      itemData,
      startingBid
    };
  }

  /**
   * Calculate starting bid for an item using config
   */
  calculateStartingBid(itemLevel: number, rarity: string): number {
    return AuctionConfigService.getInstance().calculateStartingBid(
      itemLevel,
      rarity as "common" | "uncommon" | "rare" | "epic"
    );
  }

  /**
   * Generate mock item name
   */
  private generateItemName(
    category: string,
    rarity: string,
    targetClass: string
  ): string {
    const prefixes: Record<string, string[]> = {
      common: ["Simple", "Basic", "Plain"],
      uncommon: ["Sturdy", "Quality", "Fine"],
      rare: ["Superior", "Exceptional", "Masterwork"],
      epic: ["Legendary", "Mythical", "Ancient"]
    };

    const weaponTypes: Record<string, string[]> = {
      warrior: ["Sword", "Axe"],
      mage: ["Staff", "Wand"],
      ranger: ["Bow", "Sling"]
    };

    const armorTypes = ["Helmet", "Chestplate", "Gloves", "Boots"];
    const jewelryTypes = ["Ring", "Amulet"];

    const prefix = this.randomChoice(prefixes[rarity] || prefixes.common);
    let type: string;

    if (category === "weapon") {
      type = this.randomChoice(weaponTypes[targetClass]);
    } else if (category === "armor") {
      type = this.randomChoice(armorTypes);
    } else {
      type = this.randomChoice(jewelryTypes);
    }

    return `${prefix} ${type}`;
  }

  /**
   * Generate mock stats for an item
   */
  private generateMockStats(itemLevel: number, rarity: string, category: string) {
    const statValue = Math.floor(itemLevel * 2 + Math.random() * itemLevel);
    
    const rarityBonus: Record<string, number> = {
      common: 1,
      uncommon: 1.5,
      rare: 2,
      epic: 3
    };

    const bonus = rarityBonus[rarity] || 1;

    if (category === "weapon") {
      return {
        minDamage: Math.floor(statValue * bonus),
        maxDamage: Math.floor(statValue * bonus * 1.5),
        str: Math.floor(itemLevel * bonus)
      };
    } else if (category === "armor") {
      return {
        armor: Math.floor(statValue * bonus),
        vitality: Math.floor(itemLevel * bonus)
      };
    } else {
      return {
        luck: Math.floor(itemLevel * bonus * 0.5),
        initiative: Math.floor(itemLevel * bonus * 0.5)
      };
    }
  }

  /**
   * Ensure 2 items per class in the auction
   */
  private ensureClassDiversity(items: any[]) {
    const classCounts = { warrior: 0, mage: 0, ranger: 0 };
    
    items.forEach((item) => {
      classCounts[item.itemData.targetClass as keyof typeof classCounts]++;
    });

    // If imbalanced, regenerate some items
    // For V1, we'll keep it simple and just return as-is
    // V2 can add more sophisticated balancing
    return items;
  }

  /**
   * Utility: random integer between min and max (inclusive)
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Utility: random choice from array
   */
  private randomChoice<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get random icon path based on category and class
   */
  private getRandomIconPath(category: string, targetClass: string): string {
    let pool: string[];
    let basePath: string;

    if (category === "weapon") {
      // For weapons, alternate between sword and axe
      const weaponType = Math.random() > 0.5 ? "sword" : "axe";
      if (weaponType === "sword") {
        pool = this.assetPools.weaponSwords;
        basePath = "/assets/items/generated/weapon/melee/sword/";
      } else {
        pool = this.assetPools.weaponAxes;
        basePath = "/assets/items/generated/weapon/melee/axe/";
      }
    } else if (category === "armor") {
      pool = this.assetPools.armorBelts;
      basePath = "/assets/items/generated/armor/heavy/belt/";
    } else {
      // Jewelry - alternate between ring and necklace
      const jewelryType = Math.random() > 0.5 ? "ring" : "necklace";
      if (jewelryType === "ring") {
        pool = this.assetPools.jewelryRings;
        basePath = "/assets/items/generated/jewelry/ring/";
      } else {
        pool = this.assetPools.jewelryNecklaces;
        basePath = "/assets/items/generated/jewelry/necklace/";
      }
    }

    const randomFile = this.randomChoice(pool);
    return basePath + randomFile;
  }
}
