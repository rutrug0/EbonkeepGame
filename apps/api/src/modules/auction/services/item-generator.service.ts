import type { ItemRarity } from "@ebonkeep/shared";

import { allDefinedItemTemplates, rollInventoryItem } from "../../inventory/item-service.js";
import { AuctionConfigService } from "./config.service.js";

type AuctionItemTemplateScope = "all" | "warriorHeavyAndMelee";

const AUCTION_SYSTEM_PLAYER_ID = "auction_system";
const AUCTION_PLAYER_CLASSES = ["warrior", "mage", "ranger"] as const;

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
      const itemData = rollInventoryItem({
        playerId: AUCTION_SYSTEM_PLAYER_ID,
        templateId: template.id,
        rarity,
        itemLevel
      });

      classCounts.set(template.allowedClass, (classCounts.get(template.allowedClass) ?? 0) + 1);
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
    const classTemplates = templates.filter((template) => template.allowedClass === playerClass);
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

