import type { Prisma, PrismaClient } from "@prisma/client";

import type { PlayerStatBonuses } from "@ebonkeep/shared/core";
import type { GuildRaidBonus } from "@ebonkeep/shared/guild";

import {
  EMPTY_ACADEMY_EFFECT_TOTALS,
  getGuildAcademyEffectTotals,
  mergePlayerStatBonuses,
  type AcademyEffectTotals
} from "../academy/effects.js";
import { GUILD_RAID_BOSS_CHAIN } from "./raid-config.js";

type GuildRaidDbClient = PrismaClient | Prisma.TransactionClient;

function buildStatBonus(type: GuildRaidBonus["type"], value: number): PlayerStatBonuses {
  switch (type) {
    case "strength_flat":
      return { strength: Math.round(value) };
    case "armor_flat":
      return { armor: Math.round(value) };
    case "physical_defense_flat":
      return { physicalDefense: Math.round(value) };
    case "intelligence_flat":
      return { intelligence: Math.round(value) };
    case "spell_shield_flat":
      return { spellShield: Math.round(value) };
    case "magic_defense_flat":
      return { magicDefense: Math.round(value) };
    case "dexterity_flat":
      return { dexterity: Math.round(value) };
    case "accuracy_flat":
      return { accuracy: Math.round(value) };
    case "dodge_chance_bps":
      return { dodgeChance: Math.round(value) };
    default:
      return {};
  }
}

export function applyGuildRaidBonusToTotals(
  totals: AcademyEffectTotals,
  bonus: GuildRaidBonus
): AcademyEffectTotals {
  switch (bonus.type) {
    case "stamina_regen_percent":
      return { ...totals, staminaRegenPercent: totals.staminaRegenPercent + Math.round(bonus.value) };
    case "contract_ducats_percent":
      return { ...totals, contractDucatsPercent: totals.contractDucatsPercent + Math.round(bonus.value) };
    case "contract_xp_percent":
      return { ...totals, contractXpPercent: totals.contractXpPercent + Math.round(bonus.value) };
    case "contract_item_drop_bps":
      return { ...totals, contractItemDropBps: totals.contractItemDropBps + Math.round(bonus.value) };
    case "contract_replenish_percent":
      return { ...totals, contractReplenishPercent: totals.contractReplenishPercent + Math.round(bonus.value) };
    case "rest_cost_percent":
      return { ...totals, restCostPercent: totals.restCostPercent + Math.round(bonus.value) };
    default:
      return {
        ...totals,
        statBonuses: mergePlayerStatBonuses(totals.statBonuses, buildStatBonus(bonus.type, bonus.value))
      };
  }
}

export function getUnlockedGuildRaidBonuses(highestBossIndexDefeated: number): GuildRaidBonus[] {
  if (highestBossIndexDefeated < 0) {
    return [];
  }

  return GUILD_RAID_BOSS_CHAIN.slice(0, highestBossIndexDefeated + 1).map((boss) => boss.unlockedBonus);
}

export function getGuildRaidEffectTotalsFromHighestBoss(highestBossIndexDefeated: number): AcademyEffectTotals {
  return getUnlockedGuildRaidBonuses(highestBossIndexDefeated).reduce(
    (totals, bonus) => applyGuildRaidBonusToTotals(totals, bonus),
    EMPTY_ACADEMY_EFFECT_TOTALS
  );
}

export async function getGuildRaidEffectTotals(
  prisma: GuildRaidDbClient,
  guildId: string | null | undefined
): Promise<AcademyEffectTotals> {
  if (!guildId) {
    return EMPTY_ACADEMY_EFFECT_TOTALS;
  }

  const progress = await prisma.guildRaidProgress.findUnique({
    where: { guildId },
    select: { highestBossIndexDefeated: true }
  });

  return getGuildRaidEffectTotalsFromHighestBoss(progress?.highestBossIndexDefeated ?? -1);
}

export function mergeGuildEffectTotals(
  primary: AcademyEffectTotals,
  secondary: AcademyEffectTotals
): AcademyEffectTotals {
  return {
    staminaRegenPercent: primary.staminaRegenPercent + secondary.staminaRegenPercent,
    contractDucatsPercent: primary.contractDucatsPercent + secondary.contractDucatsPercent,
    contractXpPercent: primary.contractXpPercent + secondary.contractXpPercent,
    contractItemDropBps: primary.contractItemDropBps + secondary.contractItemDropBps,
    contractReplenishPercent: primary.contractReplenishPercent + secondary.contractReplenishPercent,
    contractSlotCountFlat: primary.contractSlotCountFlat + secondary.contractSlotCountFlat,
    restCostPercent: primary.restCostPercent + secondary.restCostPercent,
    maxMembersFlat: primary.maxMembersFlat + secondary.maxMembersFlat,
    arenaOfferCountFlat: primary.arenaOfferCountFlat + secondary.arenaOfferCountFlat,
    arenaCooldownPercent: primary.arenaCooldownPercent + secondary.arenaCooldownPercent,
    arenaRatingWinFlat: primary.arenaRatingWinFlat + secondary.arenaRatingWinFlat,
    arenaRatingLossReductionFlat: primary.arenaRatingLossReductionFlat + secondary.arenaRatingLossReductionFlat,
    statBonuses: mergePlayerStatBonuses(primary.statBonuses, secondary.statBonuses)
  };
}

export async function getCombinedGuildEffectTotals(
  prisma: GuildRaidDbClient,
  guildId: string | null | undefined
): Promise<AcademyEffectTotals> {
  const [academyEffects, raidEffects] = await Promise.all([
    getGuildAcademyEffectTotals(prisma, guildId),
    getGuildRaidEffectTotals(prisma, guildId)
  ]);

  return mergeGuildEffectTotals(academyEffects, raidEffects);
}

export async function getPlayerCombinedGuildEffectTotals(
  prisma: GuildRaidDbClient,
  playerId: string
): Promise<AcademyEffectTotals> {
  const membership = await prisma.guildMember.findUnique({
    where: { playerId },
    select: { guildId: true }
  });

  return getCombinedGuildEffectTotals(prisma, membership?.guildId);
}
