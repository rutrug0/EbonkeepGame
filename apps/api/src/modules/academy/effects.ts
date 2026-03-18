import type { Prisma, PrismaClient } from "@prisma/client";

import type { ContractRewardPreview } from "@ebonkeep/shared/combat";
import type { PlayerStatBonuses } from "@ebonkeep/shared/core";
import type { AcademyActiveEffect, AcademyReward } from "@ebonkeep/shared/guild";

import { ACADEMY_TREE_CONFIG } from "./academy-tree.config.js";

type AcademyNodeProgress = {
  currentLevel: number;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

export type AcademyEffectTotals = {
  staminaRegenPercent: number;
  contractDucatsPercent: number;
  contractXpPercent: number;
  contractItemDropBps: number;
  contractReplenishPercent: number;
  contractSlotCountFlat: number;
  restCostPercent: number;
  maxMembersFlat: number;
  arenaOfferCountFlat: number;
  arenaCooldownPercent: number;
  arenaRatingWinFlat: number;
  arenaRatingLossReductionFlat: number;
  statBonuses: PlayerStatBonuses;
};

const EMPTY_STAT_BONUSES: PlayerStatBonuses = {};

export const EMPTY_ACADEMY_EFFECT_TOTALS: AcademyEffectTotals = {
  staminaRegenPercent: 0,
  contractDucatsPercent: 0,
  contractXpPercent: 0,
  contractItemDropBps: 0,
  contractReplenishPercent: 0,
  contractSlotCountFlat: 0,
  restCostPercent: 0,
  maxMembersFlat: 0,
  arenaOfferCountFlat: 0,
  arenaCooldownPercent: 0,
  arenaRatingWinFlat: 0,
  arenaRatingLossReductionFlat: 0,
  statBonuses: EMPTY_STAT_BONUSES
};

function addStatBonus(
  statBonuses: PlayerStatBonuses,
  key: keyof PlayerStatBonuses,
  value: number
): PlayerStatBonuses {
  return {
    ...statBonuses,
    [key]: Math.round((statBonuses[key] ?? 0) + value)
  };
}

function buildNodeProgressMap(
  rows: ReadonlyArray<{ nodeId: string; currentLevel: number }>
): Map<string, AcademyNodeProgress> {
  return new Map(rows.map((row) => [row.nodeId, { currentLevel: row.currentLevel }]));
}

function collectUnlockedEffects(
  nodeProgressMap: Map<string, AcademyNodeProgress>
): AcademyActiveEffect[] {
  const activeEffects: AcademyActiveEffect[] = [];

  for (const node of ACADEMY_TREE_CONFIG.nodes) {
    const currentLevel = nodeProgressMap.get(node.id)?.currentLevel ?? 0;
    if (currentLevel <= 0) {
      continue;
    }

    for (const level of node.levels) {
      if (level.level > currentLevel) {
        break;
      }
      activeEffects.push(...level.rewards);
    }

    if (node.completionReward && currentLevel >= node.maxLevel) {
      activeEffects.push(node.completionReward);
    }
  }

  for (const branch of ACADEMY_TREE_CONFIG.branches) {
    if (!branch.completionReward) {
      continue;
    }

    const branchNodes = ACADEMY_TREE_CONFIG.nodes.filter((node) => node.branchId === branch.id);
    if (
      branchNodes.length > 0 &&
      branchNodes.every((node) => (nodeProgressMap.get(node.id)?.currentLevel ?? 0) >= node.maxLevel)
    ) {
      activeEffects.push(branch.completionReward);
    }
  }

  return activeEffects;
}

function sumActiveEffects(activeEffects: ReadonlyArray<AcademyReward>): AcademyEffectTotals {
  let totals = EMPTY_ACADEMY_EFFECT_TOTALS;

  for (const effect of activeEffects) {
    switch (effect.type) {
      case "stamina_regen_percent":
        totals = { ...totals, staminaRegenPercent: totals.staminaRegenPercent + Math.round(effect.value) };
        break;
      case "contract_ducats_percent":
        totals = { ...totals, contractDucatsPercent: totals.contractDucatsPercent + Math.round(effect.value) };
        break;
      case "contract_xp_percent":
        totals = { ...totals, contractXpPercent: totals.contractXpPercent + Math.round(effect.value) };
        break;
      case "contract_item_drop_bps":
        totals = { ...totals, contractItemDropBps: totals.contractItemDropBps + Math.round(effect.value) };
        break;
      case "contract_replenish_percent":
        totals = { ...totals, contractReplenishPercent: totals.contractReplenishPercent + Math.round(effect.value) };
        break;
      case "contract_slot_count_flat":
        totals = { ...totals, contractSlotCountFlat: totals.contractSlotCountFlat + Math.round(effect.value) };
        break;
      case "rest_cost_percent":
        totals = { ...totals, restCostPercent: totals.restCostPercent + Math.round(effect.value) };
        break;
      case "max_members_flat":
        totals = { ...totals, maxMembersFlat: totals.maxMembersFlat + Math.round(effect.value) };
        break;
      case "arena_offer_count_flat":
        totals = { ...totals, arenaOfferCountFlat: totals.arenaOfferCountFlat + Math.round(effect.value) };
        break;
      case "arena_cooldown_percent":
        totals = { ...totals, arenaCooldownPercent: totals.arenaCooldownPercent + Math.round(effect.value) };
        break;
      case "arena_rating_win_flat":
        totals = { ...totals, arenaRatingWinFlat: totals.arenaRatingWinFlat + Math.round(effect.value) };
        break;
      case "arena_rating_loss_reduction_flat":
        totals = {
          ...totals,
          arenaRatingLossReductionFlat: totals.arenaRatingLossReductionFlat + Math.round(effect.value)
        };
        break;
      case "strength_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "strength", effect.value) };
        break;
      case "armor_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "armor", effect.value) };
        break;
      case "physical_defense_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "physicalDefense", effect.value) };
        break;
      case "intelligence_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "intelligence", effect.value) };
        break;
      case "spell_shield_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "spellShield", effect.value) };
        break;
      case "magic_defense_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "magicDefense", effect.value) };
        break;
      case "dexterity_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "dexterity", effect.value) };
        break;
      case "accuracy_flat":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "accuracy", effect.value) };
        break;
      case "dodge_chance_bps":
        totals = { ...totals, statBonuses: addStatBonus(totals.statBonuses, "dodgeChance", effect.value) };
        break;
    }
  }

  return totals;
}

export function mergePlayerStatBonuses(
  primary: PlayerStatBonuses,
  secondary: PlayerStatBonuses
): PlayerStatBonuses {
  const merged: PlayerStatBonuses = { ...primary };
  const statKeys = new Set<keyof PlayerStatBonuses>([
    ...(Object.keys(primary) as Array<keyof PlayerStatBonuses>),
    ...(Object.keys(secondary) as Array<keyof PlayerStatBonuses>)
  ]);

  for (const key of statKeys) {
    const total = (primary[key] ?? 0) + (secondary[key] ?? 0);
    if (total !== 0) {
      merged[key] = total;
    }
  }

  return merged;
}

export function applyAcademyBonusesToContractRewardPreview(
  rewardPreview: ContractRewardPreview,
  effects: AcademyEffectTotals
): ContractRewardPreview {
  const xpMultiplier = Math.max(0, 100 + effects.contractXpPercent);
  const ducatMultiplier = Math.max(0, 100 + effects.contractDucatsPercent);
  const experienceMin = Math.max(0, Math.round((rewardPreview.experienceMin * xpMultiplier) / 100));
  const experienceMax = Math.max(experienceMin, Math.round((rewardPreview.experienceMax * xpMultiplier) / 100));
  const ducatsMin = Math.max(0, Math.round((rewardPreview.ducatsMin * ducatMultiplier) / 100));
  const ducatsMax = Math.max(ducatsMin, Math.round((rewardPreview.ducatsMax * ducatMultiplier) / 100));

  return {
    ...rewardPreview,
    experienceMin,
    experienceMax,
    ducatsMin,
    ducatsMax,
    itemDropChanceBps: Math.max(
      0,
      Math.min(10_000, rewardPreview.itemDropChanceBps + effects.contractItemDropBps)
    )
  };
}

export function applyAcademyRestCostDiscount(baseCost: number, effects: AcademyEffectTotals): number {
  const effectivePercent = Math.max(0, 100 - effects.restCostPercent);
  return Math.max(0, Math.ceil((Math.max(0, baseCost) * effectivePercent) / 100));
}

export function applyAcademyContractReplenishDuration(baseDurationMs: number, effects: AcademyEffectTotals): number {
  const effectivePercent = Math.max(0, 100 - effects.contractReplenishPercent);
  return Math.max(1_000, Math.ceil((Math.max(0, baseDurationMs) * effectivePercent) / 100));
}

export function getEffectiveContractSlotCount(baseSlotCount: number, effects: AcademyEffectTotals): number {
  return Math.max(1, baseSlotCount + effects.contractSlotCountFlat);
}

export function getEffectiveArenaOfferCount(baseOfferCount: number, effects: AcademyEffectTotals): number {
  return Math.max(1, baseOfferCount + effects.arenaOfferCountFlat);
}

export function applyAcademyArenaCooldownDuration(baseDurationMs: number, effects: AcademyEffectTotals): number {
  const effectivePercent = Math.max(0, 100 - effects.arenaCooldownPercent);
  return Math.max(5_000, Math.ceil((Math.max(0, baseDurationMs) * effectivePercent) / 100));
}

export function resolveAcademyActiveEffectsFromRows(
  rows: ReadonlyArray<{ nodeId: string; currentLevel: number }>
): AcademyActiveEffect[] {
  return collectUnlockedEffects(buildNodeProgressMap(rows));
}

export async function getGuildAcademyActiveEffects(
  prisma: DbClient,
  guildId: string | null | undefined
): Promise<AcademyActiveEffect[]> {
  if (!guildId) {
    return [];
  }

  const rows = await prisma.guildAcademyNode.findMany({
    where: { guildId },
    select: {
      nodeId: true,
      currentLevel: true
    }
  });

  return resolveAcademyActiveEffectsFromRows(rows);
}

export async function getGuildAcademyEffectTotals(
  prisma: DbClient,
  guildId: string | null | undefined
): Promise<AcademyEffectTotals> {
  if (!guildId) {
    return EMPTY_ACADEMY_EFFECT_TOTALS;
  }

  return sumActiveEffects(await getGuildAcademyActiveEffects(prisma, guildId));
}

export async function getPlayerAcademyEffectTotals(
  prisma: DbClient,
  playerId: string
): Promise<AcademyEffectTotals> {
  const membership = await prisma.guildMember.findUnique({
    where: { playerId },
    select: { guildId: true }
  });

  return getGuildAcademyEffectTotals(prisma, membership?.guildId);
}

export async function getEffectiveGuildMaxMembers(
  prisma: DbClient,
  guildId: string,
  baseMaxMembers: number
): Promise<number> {
  const effects = await getGuildAcademyEffectTotals(prisma, guildId);
  return Math.max(1, baseMaxMembers + effects.maxMembersFlat);
}
