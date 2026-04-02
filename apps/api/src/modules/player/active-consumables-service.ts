import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import type { ContractRewardPreview } from "@ebonkeep/shared/combat";
import type { PlayerStatBonuses, PlayerStatSnapshot } from "@ebonkeep/shared/core";
import {
  consumableEffectSchema,
  type ConsumableCatalogEntry,
  type ConsumableEffect,
  type ConsumableType
} from "@ebonkeep/shared/consumables";
import { activeConsumableSchema, type ActiveConsumable } from "@ebonkeep/shared/player";

const CONSUMABLE_STACK_LIMIT = 3;
const ACTIVATION_LIMITED_TYPES = new Set<ConsumableType>(["tonic", "elixir"]);

type ActiveConsumablesDbClient = PrismaClient | Prisma.TransactionClient;

type ActiveConsumableRow = {
  id: string;
  itemCode: string;
  consumableType: string;
  consumableFamily: string;
  effects: Prisma.JsonValue;
  appliedAt: Date;
  expiresAt: Date | null;
  remainingEncounters: number | null;
  originalDurationKind: string;
  originalDurationValue: number;
};

export type ActiveConsumableEffectTotals = {
  statFlatBonuses: PlayerStatBonuses;
  statPercentBonusesBps: PlayerStatBonuses;
  contractXpPercent: number;
  contractDucatsPercent: number;
  contractItemDropBps: number;
  contractReplenishPercent: number;
  contractStaminaCostPercent: number;
  contractTravelDurationPercent: number;
  afflictionResistBps: number;
  clearAfflictionCharges: number;
};

export const EMPTY_ACTIVE_CONSUMABLE_EFFECT_TOTALS: ActiveConsumableEffectTotals = {
  statFlatBonuses: {},
  statPercentBonusesBps: {},
  contractXpPercent: 0,
  contractDucatsPercent: 0,
  contractItemDropBps: 0,
  contractReplenishPercent: 0,
  contractStaminaCostPercent: 0,
  contractTravelDurationPercent: 0,
  afflictionResistBps: 0,
  clearAfflictionCharges: 0
};

export type ActiveConsumableActivationValidation =
  | { valid: true }
  | { valid: false; reason: "cap_reached" | "family_conflict" };

function parseConsumableEffects(value: Prisma.JsonValue): ConsumableEffect[] {
  return consumableEffectSchema.array().parse(value);
}

function parseActiveConsumable(row: ActiveConsumableRow): ActiveConsumable {
  return activeConsumableSchema.parse({
    id: row.id,
    itemCode: row.itemCode,
    type: row.consumableType,
    family: row.consumableFamily,
    effects: parseConsumableEffects(row.effects),
    appliedAt: row.appliedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    remainingEncounters: row.remainingEncounters,
    originalDuration: {
      kind: row.originalDurationKind,
      value: row.originalDurationValue
    }
  });
}

function buildStatBonusesWithDelta(
  source: PlayerStatBonuses,
  statKey: keyof PlayerStatBonuses,
  delta: number
): PlayerStatBonuses {
  const currentValue = source[statKey] ?? 0;
  const nextValue = Math.round(currentValue + delta);
  if (nextValue === 0) {
    const nextBonuses = { ...source };
    delete nextBonuses[statKey];
    return nextBonuses;
  }

  return {
    ...source,
    [statKey]: nextValue
  };
}

function resolveDurationExpiration(definition: ConsumableCatalogEntry, now: Date): Date | null {
  if (definition.durationKind !== "hours") {
    return null;
  }

  const durationHours = Math.max(0, definition.durationValue);
  return new Date(now.getTime() + (durationHours * 60 * 60 * 1000));
}

function resolveDurationEncounters(definition: ConsumableCatalogEntry): number | null {
  if (definition.durationKind !== "encounters") {
    return null;
  }

  return Math.max(0, definition.durationValue);
}

function isLimitedActivationType(type: ConsumableType): boolean {
  return ACTIVATION_LIMITED_TYPES.has(type);
}

function getEffectStatKey(effect: ConsumableEffect): keyof PlayerStatBonuses | null {
  if (effect.type !== "stat_flat" && effect.type !== "stat_bps") {
    return null;
  }

  return effect.target as keyof PlayerStatBonuses;
}

async function queryActiveConsumableRows(
  prisma: ActiveConsumablesDbClient,
  playerId: string
): Promise<ActiveConsumableRow[]> {
  return prisma.$queryRaw<ActiveConsumableRow[]>`
    SELECT
      "id",
      "itemCode",
      "consumableType",
      "consumableFamily",
      "effects",
      "appliedAt",
      "expiresAt",
      "remainingEncounters",
      "originalDurationKind",
      "originalDurationValue"
    FROM "player_active_consumables"
    WHERE "playerId" = ${playerId}
    ORDER BY "appliedAt" ASC
  `;
}

export function aggregateActiveConsumableEffects(consumables: readonly ActiveConsumable[]): ActiveConsumableEffectTotals {
  let totals = EMPTY_ACTIVE_CONSUMABLE_EFFECT_TOTALS;

  for (const consumable of consumables) {
    for (const effect of consumable.effects) {
      switch (effect.type) {
        case "stat_flat": {
          const statKey = getEffectStatKey(effect);
          if (!statKey) {
            break;
          }
          totals = {
            ...totals,
            statFlatBonuses: buildStatBonusesWithDelta(totals.statFlatBonuses, statKey, effect.value)
          };
          break;
        }
        case "stat_bps": {
          const statKey = getEffectStatKey(effect);
          if (!statKey) {
            break;
          }
          totals = {
            ...totals,
            statPercentBonusesBps: buildStatBonusesWithDelta(totals.statPercentBonusesBps, statKey, effect.value)
          };
          break;
        }
        case "contract_xp_percent":
          totals = { ...totals, contractXpPercent: totals.contractXpPercent + Math.round(effect.value) };
          break;
        case "contract_ducats_percent":
          totals = { ...totals, contractDucatsPercent: totals.contractDucatsPercent + Math.round(effect.value) };
          break;
        case "contract_item_drop_bps":
          totals = { ...totals, contractItemDropBps: totals.contractItemDropBps + Math.round(effect.value) };
          break;
        case "contract_replenish_percent":
          totals = { ...totals, contractReplenishPercent: totals.contractReplenishPercent + Math.round(effect.value) };
          break;
        case "contract_stamina_cost_percent":
          totals = {
            ...totals,
            contractStaminaCostPercent: totals.contractStaminaCostPercent + Math.round(effect.value)
          };
          break;
        case "contract_travel_duration_percent":
          totals = {
            ...totals,
            contractTravelDurationPercent: totals.contractTravelDurationPercent + Math.round(effect.value)
          };
          break;
        case "affliction_resist_bps":
          totals = { ...totals, afflictionResistBps: totals.afflictionResistBps + Math.round(effect.value) };
          break;
        case "clear_affliction":
          totals = { ...totals, clearAfflictionCharges: totals.clearAfflictionCharges + Math.round(effect.value) };
          break;
        default:
          break;
      }
    }
  }

  return totals;
}

export function applyActiveConsumableContractModifiers(
  rewardPreview: ContractRewardPreview,
  totals: ActiveConsumableEffectTotals
): ContractRewardPreview {
  const xpMultiplier = Math.max(0, 100 + totals.contractXpPercent);
  const ducatMultiplier = Math.max(0, 100 + totals.contractDucatsPercent);
  const staminaCostMultiplier = Math.max(0, 100 - totals.contractStaminaCostPercent);

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
    itemDropChanceBps: Math.max(0, Math.min(10_000, rewardPreview.itemDropChanceBps + totals.contractItemDropBps)),
    staminaCost: Math.max(0, Math.ceil((rewardPreview.staminaCost * staminaCostMultiplier) / 100))
  };
}

export function applyActiveConsumableTravelDuration(
  baseDurationSeconds: number,
  totals: ActiveConsumableEffectTotals
): number {
  const effectivePercent = Math.max(0, 100 - totals.contractTravelDurationPercent);
  return Math.max(1, Math.ceil((Math.max(1, baseDurationSeconds) * effectivePercent) / 100));
}

export function applyActiveConsumableStatEffectsToSnapshot(
  snapshot: PlayerStatSnapshot,
  totals: ActiveConsumableEffectTotals
): PlayerStatSnapshot {
  const nextSnapshot: PlayerStatSnapshot = {
    ...snapshot,
    guild: { ...snapshot.guild },
    total: { ...snapshot.total }
  };

  const statKeys = new Set<keyof PlayerStatBonuses>([
    ...(Object.keys(totals.statFlatBonuses) as Array<keyof PlayerStatBonuses>),
    ...(Object.keys(totals.statPercentBonusesBps) as Array<keyof PlayerStatBonuses>)
  ]);

  for (const statKey of statKeys) {
    const totalStatKey = statKey as keyof PlayerStatSnapshot["total"];
    const currentValue = nextSnapshot.total[totalStatKey] ?? 0;
    const flatBonus = totals.statFlatBonuses[statKey] ?? 0;
    const percentBonusBps = totals.statPercentBonusesBps[statKey] ?? 0;
    const percentDelta = Math.round((currentValue * percentBonusBps) / 10_000);
    const delta = Math.round(flatBonus + percentDelta);

    if (delta === 0) {
      continue;
    }

    const nextValue = Math.max(0, currentValue + delta);
    const appliedDelta = nextValue - currentValue;

    if (appliedDelta === 0) {
      continue;
    }

    nextSnapshot.total[totalStatKey] = nextValue;
    nextSnapshot.guild[totalStatKey] = Math.max(0, (nextSnapshot.guild[totalStatKey] ?? 0) + appliedDelta);
  }

  return nextSnapshot;
}

export async function cleanupExpiredActiveConsumables(
  prisma: ActiveConsumablesDbClient,
  playerId: string,
  now = new Date()
): Promise<number> {
  const deletedCount = await prisma.$executeRaw`
    DELETE FROM "player_active_consumables"
    WHERE "playerId" = ${playerId}
      AND (
        ("expiresAt" IS NOT NULL AND "expiresAt" <= ${now})
        OR ("remainingEncounters" IS NOT NULL AND "remainingEncounters" <= 0)
      )
  `;

  return Number(deletedCount);
}

export async function getPlayerActiveConsumables(
  prisma: ActiveConsumablesDbClient,
  playerId: string,
  now = new Date()
): Promise<ActiveConsumable[]> {
  await cleanupExpiredActiveConsumables(prisma, playerId, now);
  const rows = await queryActiveConsumableRows(prisma, playerId);
  return rows.map((row) => parseActiveConsumable(row));
}

export async function getPlayerActiveConsumableEffectTotals(
  prisma: ActiveConsumablesDbClient,
  playerId: string,
  now = new Date()
): Promise<ActiveConsumableEffectTotals> {
  const activeConsumables = await getPlayerActiveConsumables(prisma, playerId, now);
  return aggregateActiveConsumableEffects(activeConsumables);
}

export async function validateActiveConsumableActivation(
  prisma: ActiveConsumablesDbClient,
  playerId: string,
  definition: ConsumableCatalogEntry,
  now = new Date()
): Promise<ActiveConsumableActivationValidation> {
  if (!isLimitedActivationType(definition.type)) {
    return { valid: true };
  }

  const activeConsumables = await getPlayerActiveConsumables(prisma, playerId, now);
  const activeOfType = activeConsumables.filter((entry) => entry.type === definition.type);

  if (activeOfType.length >= CONSUMABLE_STACK_LIMIT) {
    return { valid: false, reason: "cap_reached" };
  }

  const hasFamilyConflict = activeOfType.some((entry) => entry.family === definition.family);
  if (hasFamilyConflict) {
    return { valid: false, reason: "family_conflict" };
  }

  return { valid: true };
}

export async function activateDurationConsumable(args: {
  prisma: ActiveConsumablesDbClient;
  playerId: string;
  definition: ConsumableCatalogEntry;
  now?: Date;
}): Promise<ActiveConsumable> {
  const now = args.now ?? new Date();
  const id = `pac_${randomUUID().replaceAll("-", "")}`;
  const expiresAt = resolveDurationExpiration(args.definition, now);
  const remainingEncounters = resolveDurationEncounters(args.definition);

  const insertedRows = await args.prisma.$queryRaw<ActiveConsumableRow[]>`
    INSERT INTO "player_active_consumables" (
      "id",
      "playerId",
      "itemCode",
      "consumableType",
      "consumableFamily",
      "effects",
      "appliedAt",
      "expiresAt",
      "remainingEncounters",
      "originalDurationKind",
      "originalDurationValue",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${args.playerId},
      ${args.definition.itemCode},
      ${args.definition.type},
      ${args.definition.family},
      ${JSON.stringify(args.definition.effects)}::jsonb,
      ${now},
      ${expiresAt},
      ${remainingEncounters},
      ${args.definition.durationKind},
      ${args.definition.durationValue},
      ${now},
      ${now}
    )
    RETURNING
      "id",
      "itemCode",
      "consumableType",
      "consumableFamily",
      "effects",
      "appliedAt",
      "expiresAt",
      "remainingEncounters",
      "originalDurationKind",
      "originalDurationValue"
  `;

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Failed to activate consumable.");
  }

  return parseActiveConsumable(inserted);
}

export async function decrementEncounterBasedConsumables(
  prisma: ActiveConsumablesDbClient,
  playerId: string,
  encounterCount = 1,
  now = new Date()
): Promise<void> {
  const normalizedCount = Math.max(0, Math.floor(encounterCount));
  if (normalizedCount <= 0) {
    return;
  }

  await cleanupExpiredActiveConsumables(prisma, playerId, now);

  const rows = await prisma.$queryRaw<Array<{ id: string; remainingEncounters: number | null }>>`
    SELECT "id", "remainingEncounters"
    FROM "player_active_consumables"
    WHERE "playerId" = ${playerId}
      AND "remainingEncounters" IS NOT NULL
      AND "remainingEncounters" > 0
  `;

  for (const row of rows) {
    const remaining = Math.max(0, (row.remainingEncounters ?? 0) - normalizedCount);
    if (remaining <= 0) {
      await prisma.$executeRaw`
        DELETE FROM "player_active_consumables"
        WHERE "id" = ${row.id}
      `;
      continue;
    }

    await prisma.$executeRaw`
      UPDATE "player_active_consumables"
      SET "remainingEncounters" = ${remaining}, "updatedAt" = ${now}
      WHERE "id" = ${row.id}
    `;
  }

  await cleanupExpiredActiveConsumables(prisma, playerId, now);
}

export async function decrementEncounterBasedConsumablesForPlayers(
  prisma: ActiveConsumablesDbClient,
  playerIds: readonly string[],
  encounterCount = 1,
  now = new Date()
): Promise<void> {
  const uniquePlayerIds = [...new Set(playerIds)].filter((playerId) => playerId.length > 0);
  for (const playerId of uniquePlayerIds) {
    await decrementEncounterBasedConsumables(prisma, playerId, encounterCount, now);
  }
}
