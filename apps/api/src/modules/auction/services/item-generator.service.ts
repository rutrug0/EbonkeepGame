import { getForgeDamageBonusBps } from "@ebonkeep/shared/forge";
import {
  inventoryItemSchema,
  itemEnchantingSchema,
  weaponDamageRollSchema,
  type InventoryItem,
  type ItemEnchanting,
  type ItemRarity,
  type WeaponDamageRoll
} from "@ebonkeep/shared/inventory";

import { allDefinedItemTemplates, rollInventoryItem } from "../../inventory/item-service.js";
import { AuctionConfigService } from "./config.service.js";

type AuctionItemTemplateScope = "all" | "warriorHeavyAndMelee";

const AUCTION_SYSTEM_PLAYER_ID = "auction_system";
const AUCTION_PLAYER_CLASSES = ["warrior", "mage", "ranger"] as const;
const WEAPON_DAMAGE_POWER_SCALE = 0.35;

function scaleDamageRollByBonus(
  damageRoll: WeaponDamageRoll,
  bonusScaleBps: number
): WeaponDamageRoll {
  const multiplier = 1 + (Math.max(0, bonusScaleBps) / 10_000);
  const scaleInt = (value: number) => Math.max(0, Math.round(value * multiplier));
  const scaleFloat = (value: number) => Math.max(0, Math.round(value * multiplier * 100) / 100);

  return weaponDamageRollSchema.parse({
    minRollRange: [scaleInt(damageRoll.minRollRange[0]), scaleInt(damageRoll.minRollRange[1])],
    rolledMin: scaleInt(damageRoll.rolledMin),
    rolledMax: scaleInt(damageRoll.rolledMax),
    maxRollRange: [scaleInt(damageRoll.maxRollRange[0]), scaleInt(damageRoll.maxRollRange[1])],
    averageDamage: scaleFloat(damageRoll.averageDamage)
  });
}

/**
 * Service for generating auction items from the canonical CSV-backed item tables.
 */
export class AuctionItemGeneratorService {
  private config = AuctionConfigService.getInstance().getConfig();

  async generateItemsForAuction(
    levelBracketMin: number,
    levelBracketMax: number,
    count: number,
    options?: {
      templateScope?: AuctionItemTemplateScope;
    }
  ) {
    const items = [];
    const eligibleTemplates = this.getEligibleTemplates(
      levelBracketMin,
      levelBracketMax,
      options?.templateScope ?? "all"
    );
    const classCounts = new Map<string, number>();

    for (let index = 0; index < count; index += 1) {
      const rarity = this.selectRarityByDistribution();
      const preferredClass = this.getLeastRepresentedClass(classCounts);
      const template = this.pickTemplateForClass(eligibleTemplates, preferredClass) ?? this.randomChoice(eligibleTemplates);
      const itemLevel = this.rollItemLevel(template, levelBracketMin, levelBracketMax);
      const baseItemData = rollInventoryItem({
        playerId: AUCTION_SYSTEM_PLAYER_ID,
        templateId: template.id,
        rarity,
        itemLevel
      });
      const itemData = this.applyAuctionEnchant(baseItemData, this.rollAuctionEnchantLevel());

      const classCountKey = template.allowedClass === "all" ? preferredClass : template.allowedClass;
      classCounts.set(classCountKey, (classCounts.get(classCountKey) ?? 0) + 1);
      items.push({
        itemLevel: itemData.levelRequirement,
        itemRarity: itemData.rarity,
        itemCategory: itemData.category,
        itemData,
        startingBid: this.calculateStartingBid(itemData.levelRequirement, itemData.rarity)
      });
    }

    return items;
  }

  calculateStartingBid(itemLevel: number, rarity: string): number {
    return AuctionConfigService.getInstance().calculateStartingBid(
      itemLevel,
      rarity as ItemRarity
    );
  }

  private selectRarityByDistribution(): ItemRarity {
    const dist = this.config.items.rarityDistribution;
    const total = dist.common + dist.uncommon + dist.rare + dist.epic;
    const roll = Math.random() * total;

    let cumulative = 0;
    if (roll < (cumulative += dist.common)) return "common";
    if (roll < (cumulative += dist.uncommon)) return "uncommon";
    if (roll < (cumulative += dist.rare)) return "rare";
    return "epic";
  }

  private rollAuctionEnchantLevel(): number {
    const roll = Math.random() * 100;

    if (roll < 50) return 0;
    if (roll < 75) return 1;
    if (roll < 85) return 2;
    if (roll < 95) return 3;
    return 4;
  }

  private applyAuctionEnchant(item: InventoryItem, enchantLevel: number): InventoryItem {
    if (enchantLevel <= 0 || item.archetype.majorCategory !== "weapon" || !item.damageRoll) {
      return item;
    }

    const bonusScaleBps = getForgeDamageBonusBps(enchantLevel);
    const nextDamageRoll = scaleDamageRollByBonus(item.damageRoll, bonusScaleBps);
    const damageDelta = Math.max(0, nextDamageRoll.averageDamage - item.damageRoll.averageDamage);
    const nextPower = Math.max(item.power, Math.round(item.power + (damageDelta * WEAPON_DAMAGE_POWER_SCALE)));

    return inventoryItemSchema.parse({
      ...item,
      power: nextPower,
      damageRoll: nextDamageRoll,
      enchanting: itemEnchantingSchema.parse({
        track: "weapon",
        level: enchantLevel,
        bonusScaleBps
      } satisfies ItemEnchanting)
    });
  }

  private getEligibleTemplates(
    levelBracketMin: number,
    levelBracketMax: number,
    templateScope: AuctionItemTemplateScope
  ) {
    const eligibleTemplates = allDefinedItemTemplates.filter((template) => {
      if (template.dropMaxLevel < levelBracketMin || template.dropMinLevel > levelBracketMax) {
        return false;
      }

      if (templateScope === "warriorHeavyAndMelee") {
        return (
          template.allowedClass === "warrior" &&
          ((template.archetype.majorCategory === "armor" && template.archetype.armorArchetype === "heavy") ||
            (template.archetype.majorCategory === "weapon" && template.archetype.weaponArchetype === "melee"))
        );
      }

      return true;
    });

    if (eligibleTemplates.length > 0) {
      return eligibleTemplates;
    }

    if (templateScope === "warriorHeavyAndMelee") {
      const restrictedFallback = allDefinedItemTemplates.filter(
        (template) =>
          template.allowedClass === "warrior" &&
          ((template.archetype.majorCategory === "armor" && template.archetype.armorArchetype === "heavy") ||
            (template.archetype.majorCategory === "weapon" && template.archetype.weaponArchetype === "melee"))
      );
      if (restrictedFallback.length > 0) {
        return restrictedFallback;
      }
    }

    return [...allDefinedItemTemplates];
  }

  private getLeastRepresentedClass(classCounts: Map<string, number>): string {
    let selectedClass: string = AUCTION_PLAYER_CLASSES[0];
    let lowestCount = classCounts.get(selectedClass) ?? 0;

    for (const playerClass of AUCTION_PLAYER_CLASSES.slice(1)) {
      const currentCount = classCounts.get(playerClass) ?? 0;
      if (currentCount < lowestCount) {
        selectedClass = playerClass;
        lowestCount = currentCount;
      }
    }

    return selectedClass;
  }

  private pickTemplateForClass<T extends { allowedClass: string }>(templates: readonly T[], playerClass: string): T | null {
    const classTemplates = templates.filter(
      (template) => template.allowedClass === playerClass || template.allowedClass === "all"
    );
    if (classTemplates.length === 0) {
      return null;
    }
    return this.randomChoice(classTemplates);
  }

  private rollItemLevel(
    template: { dropMinLevel: number; dropMaxLevel: number; levelRequirement: number },
    levelBracketMin: number,
    levelBracketMax: number
  ): number {
    const minLevel = Math.max(1, levelBracketMin, template.dropMinLevel, template.levelRequirement);
    const maxLevel = Math.max(minLevel, Math.min(levelBracketMax, template.dropMaxLevel));
    return this.randomInt(minLevel, maxLevel);
  }

  private randomInt(min: number, max: number): number {
    if (max <= min) {
      return min;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private randomChoice<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

