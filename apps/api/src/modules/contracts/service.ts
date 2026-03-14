import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";
import {
  resolveContractTravelDurationSeconds,
  getContractReplenishPacingRow
} from "../../config/activity-pacing.js";
import {
  combatActorSnapshotSchema,
  combatEventSchema,
  contractBoardResponseSchema,
  contractBoardSlotViewSchema,
  contractRunResultSchema,
  contractRunSnapshotSchema,
  startContractRunResponseSchema,
  type ContractBoardResponse,
  type ContractBoardSlotState,
  type ContractBoardSlotView,
  type ContractDifficulty,
  type ContractRunResult,
  type ContractRunSnapshot,
  type ContractRunState,
  type ContractRewardPreview
} from "@ebonkeep/shared/combat";
import type { PlayerClass } from "@ebonkeep/shared/core";

import { rollInventoryItem } from "../inventory/item-service.js";
import { grantPlayerExperience, spendPlayerStamina } from "../player/progression-service.js";
import { loadPlayerState } from "../player/state-service.js";
import {
  CONTRACT_DIFFICULTY_WINDOWS,
  CONTRACT_SLOT_COUNT,
  buildEncounterDefinition,
  buildRewardPreview,
  createSeededRng,
  hasEncounterMembersForFamily,
  isKnownMonsterFamily,
  pickEncounterMembers,
  randomInt,
  type BoardGenerationContext,
  type EncounterDefinition
} from "./data.js";
import { simulateEncounter, type StoredRewardSpec } from "./simulator.js";

const FAST_TRAVEL_CHEAT_DURATION_MS = 2_000;
const FAST_CONTRACT_REPLENISH_CHEAT_DURATION_MS = 3_000;

function json<T>(value: T): Prisma.JsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonObject;
}

type BoardSlotRecord = {
  id: string;
  slotIndex: number;
  state: string;
  difficulty: string | null;
  familyId: string | null;
  familyName: string | null;
  contractName: string | null;
  locationName: string | null;
  encounterLevel: number | null;
  enemyCount: number | null;
  expiresAt: Date | null;
  replenishAt: Date | null;
  updatedAt?: Date;
  activeRunId: string | null;
  rewardsPreview: Prisma.JsonValue | null;
};

function normalizeRewardPreview(value: Prisma.JsonValue | null): ContractRewardPreview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const next = { ...(value as Record<string, unknown>) };
  if (!("efficiencyTier" in next)) {
    next.efficiencyTier = "standard_cost";
  }
  return contractBoardSlotViewSchema.shape.rewardsPreview.parse(next);
}

function parseRewardPreview(value: Prisma.JsonValue | null): ContractRewardPreview | null {
  return normalizeRewardPreview(value);
}

function parseStoredRewards(value: Prisma.JsonValue): StoredRewardSpec {
  return {
    experience: Math.max(0, Math.floor((value as StoredRewardSpec).experience ?? 0)),
    ducats: Math.max(0, Math.floor((value as StoredRewardSpec).ducats ?? 0)),
    itemDropChanceBps: Math.max(0, Math.floor((value as StoredRewardSpec).itemDropChanceBps ?? 0)),
    item:
      (value as StoredRewardSpec).item && typeof (value as StoredRewardSpec).item === "object"
        ? {
            templateId: (value as StoredRewardSpec).item!.templateId,
            rarity: (value as StoredRewardSpec).item!.rarity,
            itemLevel: (value as StoredRewardSpec).item!.itemLevel,
            itemName: (value as StoredRewardSpec).item!.itemName
          }
        : null
  };
}

function mapBoardSlot(slot: BoardSlotRecord): ContractBoardSlotView {
  return contractBoardSlotViewSchema.parse({
    slotId: slot.slotIndex,
    state: slot.state as ContractBoardSlotState,
    difficulty: slot.difficulty as ContractDifficulty | null,
    familyId: slot.familyId,
    familyName: slot.familyName,
    contractName: slot.contractName,
    locationName: slot.locationName,
    encounterLevel: slot.encounterLevel,
    enemyCount: slot.enemyCount,
    expiresAt: slot.expiresAt?.toISOString() ?? null,
    replenishAt: slot.replenishAt?.toISOString() ?? null,
    startedRunId: slot.activeRunId,
    rewardsPreview: parseRewardPreview(slot.rewardsPreview)
  });
}

function buildAvailabilityExpiry(rng: () => number, difficulty: ContractDifficulty, now: Date): Date {
  const window = CONTRACT_DIFFICULTY_WINDOWS[difficulty];
  return new Date(now.getTime() + randomInt(rng, window.minMs, window.maxMs));
}

function buildReplenishAt(
  rng: () => number,
  now: Date,
  playerLevel: number,
  fastContractReplenishEnabled: boolean
): Date {
  if (fastContractReplenishEnabled) {
    return new Date(now.getTime() + FAST_CONTRACT_REPLENISH_CHEAT_DURATION_MS);
  }
  const pacing = getContractReplenishPacingRow(playerLevel);
  return new Date(now.getTime() + randomInt(rng, pacing.replenishMinSeconds * 1000, pacing.replenishMaxSeconds * 1000));
}

function isStaleAvailableSlot(slot: BoardSlotRecord): boolean {
  if (slot.state !== "available" || !slot.familyId) {
    return false;
  }
  return !isKnownMonsterFamily(slot.familyId) || !hasEncounterMembersForFamily(slot.familyId);
}

async function repopulateAvailableSlot(
  prisma: PrismaClient,
  slot: { id: string; slotIndex: number },
  context: BoardGenerationContext,
  now: Date,
  seedSuffix: string
): Promise<void> {
  const rng = createSeededRng(`${context.playerId}:slot:${slot.slotIndex}:${seedSuffix}`);
  const encounter = buildEncounterDefinition(rng, context, slot.slotIndex);
  await prisma.contractBoardSlot.update({
    where: { id: slot.id },
    data: {
      state: "available",
      contractName: encounter.contractName,
      difficulty: encounter.difficulty,
      familyId: encounter.family.familyId,
      familyName: encounter.family.familyName,
      locationName: encounter.family.locationName,
      encounterLevel: encounter.encounterLevel,
      enemyCount: encounter.members.length,
      expiresAt: buildAvailabilityExpiry(rng, encounter.difficulty, now),
      replenishAt: null,
      rewardsPreview: json(encounter.rewardPreview)
    }
  });
}

function getEffectiveReplenishAt(slot: BoardSlotRecord, fastContractReplenishEnabled: boolean): Date | null {
  if (!slot.replenishAt) {
    return null;
  }
  if (!fastContractReplenishEnabled || !slot.updatedAt) {
    return slot.replenishAt;
  }
  return new Date(
    Math.min(slot.replenishAt.getTime(), slot.updatedAt.getTime() + FAST_CONTRACT_REPLENISH_CHEAT_DURATION_MS)
  );
}

async function lockPlayerContractState(tx: Prisma.TransactionClient, playerId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "player_profiles" WHERE "id" = ${playerId} FOR UPDATE`;
}

async function getPlayerContractContext(
  prisma: PrismaClient,
  playerId: string
): Promise<BoardGenerationContext & { fastContractReplenishEnabled: boolean }> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; level: number; class: string; fastContractReplenishEnabled: boolean }>
  >`
    SELECT "id", "level", "class", "fastContractReplenishEnabled"
    FROM "player_profiles"
    WHERE "id" = ${playerId}
    LIMIT 1
  `;
  const profile = rows[0];
  if (!profile) {
    throw new Error("Player not found.");
  }
  return {
    playerId: profile.id,
    playerLevel: profile.level,
    playerClass: profile.class as PlayerClass,
    fastContractReplenishEnabled: profile.fastContractReplenishEnabled
  };
}

async function ensureBoardSlots(prisma: PrismaClient, playerId: string): Promise<void> {
  const slots = await prisma.contractBoardSlot.findMany({
    where: { playerId },
    select: { slotIndex: true }
  });
  const existing = new Set(slots.map((slot) => slot.slotIndex));
  const missing = Array.from({ length: CONTRACT_SLOT_COUNT }, (_, index) => index + 1).filter((slotId) => !existing.has(slotId));
  if (missing.length === 0) return;

  const now = new Date(0);
  await prisma.contractBoardSlot.createMany({
    data: missing.map((slotId) => ({
      playerId,
      slotIndex: slotId,
      state: "replenishing",
      replenishAt: now
    }))
  });
}

async function syncRunState(prisma: PrismaClient, runId: string, now: Date): Promise<void> {
  const run = await prisma.contractRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      createdAt: true,
      playerId: true,
      slotIndex: true,
      state: true,
      travelEndsAt: true,
      player: {
        select: {
          fastTravelEnabled: true
        }
      }
    }
  });

  const effectiveTravelEndsAt = !run
    ? null
    : new Date(
        run.player.fastTravelEnabled
          ? Math.min(run.travelEndsAt.getTime(), run.createdAt.getTime() + FAST_TRAVEL_CHEAT_DURATION_MS)
          : run.travelEndsAt.getTime()
      );

  if (!run || run.state !== "traveling" || !effectiveTravelEndsAt || effectiveTravelEndsAt > now) {
    return;
  }

  await prisma.$transaction([
    prisma.contractRun.update({
      where: { id: run.id },
      data: { state: "ready_to_claim" }
    }),
    prisma.contractBoardSlot.updateMany({
      where: { playerId: run.playerId, slotIndex: run.slotIndex, activeRunId: run.id },
      data: { state: "ready_to_claim" }
    })
  ]);
}

async function refreshBoardState(prisma: PrismaClient, playerId: string, now = new Date()): Promise<void> {
  await ensureBoardSlots(prisma, playerId);
  const context = await getPlayerContractContext(prisma, playerId);
  const slots = await prisma.contractBoardSlot.findMany({
    where: { playerId },
    orderBy: { slotIndex: "asc" }
  });

  for (const slot of slots) {
    if (slot.activeRunId) {
      await syncRunState(prisma, slot.activeRunId, now);
      continue;
    }

    if (isStaleAvailableSlot(slot as BoardSlotRecord)) {
      await repopulateAvailableSlot(
        prisma,
        slot,
        context,
        now,
        `stale:${slot.familyId ?? "unknown"}:${slot.updatedAt?.toISOString() ?? "unknown"}`
      );
      continue;
    }

    if (slot.state === "available" && slot.expiresAt && slot.expiresAt <= now) {
      const rng = createSeededRng(`${playerId}:slot:${slot.slotIndex}:expire:${slot.expiresAt.toISOString()}`);
      await prisma.contractBoardSlot.update({
        where: { id: slot.id },
        data: {
          state: "replenishing",
          contractName: null,
          difficulty: null,
          familyId: null,
          familyName: null,
          locationName: null,
          encounterLevel: null,
          enemyCount: null,
          expiresAt: null,
          rewardsPreview: Prisma.JsonNull,
          replenishAt: buildReplenishAt(rng, now, context.playerLevel, context.fastContractReplenishEnabled)
        }
      });
      continue;
    }

    const effectiveReplenishAt = getEffectiveReplenishAt(slot as BoardSlotRecord, context.fastContractReplenishEnabled);
    if (slot.state === "replenishing" && effectiveReplenishAt && effectiveReplenishAt <= now) {
      await repopulateAvailableSlot(
        prisma,
        slot,
        context,
        now,
        `replenish:${(slot.replenishAt ?? effectiveReplenishAt).toISOString()}`
      );
    }
  }
}

async function loadRunSnapshotFromRecord(run: {
  id: string;
  slotIndex: number;
  state: string;
  contractName: string;
  difficulty: string;
  familyId: string;
  familyName: string;
  locationName: string;
  encounterLevel: number;
  travelEndsAt: Date;
  travelDurationSeconds: number;
  combatBackgroundPath: string | null;
  travelImagePath: string | null;
  playerSnapshot: Prisma.JsonValue;
  enemySnapshots: Prisma.JsonValue;
}): Promise<ContractRunSnapshot> {
  return contractRunSnapshotSchema.parse({
    runId: run.id,
    slotId: run.slotIndex,
    state: run.state as ContractRunState,
    contractName: run.contractName,
    difficulty: run.difficulty as ContractDifficulty,
    familyId: run.familyId,
    familyName: run.familyName,
    locationName: run.locationName,
    encounterLevel: run.encounterLevel,
    travelEndsAt: run.travelEndsAt.toISOString(),
    travelDurationSeconds: run.travelDurationSeconds,
    player: combatActorSnapshotSchema.parse(run.playerSnapshot),
    enemies: combatActorSnapshotSchema.array().parse(run.enemySnapshots),
    combatBackgroundPath: run.combatBackgroundPath,
    travelImagePath: run.travelImagePath
  });
}

function resolvePlayerCurrentHpFromEvents(run: {
  playerSnapshot: Prisma.JsonValue;
  events: Prisma.JsonValue;
}): number {
  const player = combatActorSnapshotSchema.parse(run.playerSnapshot);
  const events = combatEventSchema.array().parse(run.events);
  let currentHp = player.currentHp;

  for (const event of events) {
    if (event.type !== "CombatActionResolved") {
      continue;
    }
    for (const strike of event.strikes) {
      if (strike.targetId === player.id) {
        currentHp = strike.targetHpAfter;
      }
    }
  }

  return Math.max(0, Math.min(player.maxHp, currentHp));
}

function coerceEncounterForRun(slot: BoardSlotRecord, playerLevel: number): EncounterDefinition {
  const rng = createSeededRng(`${slot.familyId}:${slot.slotIndex}:${slot.encounterLevel}`);
  const storedRewardPreview = parseRewardPreview(slot.rewardsPreview);
  return {
    contractName: slot.contractName ?? "Contract",
    difficulty: (slot.difficulty ?? "easy") as ContractDifficulty,
    family: {
      baseLevel: Math.max(0, (slot.encounterLevel ?? playerLevel) - 1),
      familyId: slot.familyId ?? "unknown",
      familyName: slot.familyName ?? "Unknown Threat",
      locationName: slot.locationName ?? "Unknown"
    },
    members: pickEncounterMembers(rng, (slot.difficulty ?? "easy") as ContractDifficulty, slot.familyId ?? "")
      .slice(0, slot.enemyCount ?? undefined),
    encounterLevel: slot.encounterLevel ?? playerLevel,
    rewardPreview:
      storedRewardPreview ??
      buildRewardPreview(
        (slot.difficulty ?? "easy") as ContractDifficulty,
        slot.encounterLevel ?? playerLevel,
        playerLevel,
        "standard_cost"
      )
  };
}

export async function getContractBoard(prisma: PrismaClient, playerId: string): Promise<ContractBoardResponse> {
  const now = new Date();
  await refreshBoardState(prisma, playerId, now);
  const slots = await prisma.contractBoardSlot.findMany({
    where: { playerId },
    orderBy: { slotIndex: "asc" }
  });

  return contractBoardResponseSchema.parse({
    serverTime: now.toISOString(),
    slots: slots.map((slot) => mapBoardSlot(slot as BoardSlotRecord))
  });
}

export async function startContractRun(prisma: PrismaClient, playerId: string, slotId: number) {
  const now = new Date();
  await refreshBoardState(prisma, playerId, now);

  const profile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: {
      account: { select: { username: true } }
    }
  });
  if (!profile) {
    throw new Error("Player profile not found.");
  }

  let runId = "";
  let travelEndsAt: Date | null = null;
  let travelDurationSeconds = 1;

  await prisma.$transaction(async (tx) => {
    await lockPlayerContractState(tx, playerId);
    const playerState = await loadPlayerState(tx, playerId);
    if (!playerState) {
      throw new Error("Player state not found.");
    }
    if (playerState.health.current <= 0) {
      throw new Error("You must rest before starting another contract.");
    }

    const activeRun = await tx.contractRun.findFirst({
      where: {
        playerId,
        state: { in: ["traveling", "ready_to_claim"] }
      },
      select: { id: true }
    });
    if (activeRun) {
      throw new Error("Another contract run is already active.");
    }

    const slot = await tx.contractBoardSlot.findUnique({
      where: {
        playerId_slotIndex: {
          playerId,
          slotIndex: slotId
        }
      }
    });
    if (!slot || slot.state !== "available" || !slot.difficulty || !slot.familyId || !slot.contractName || !slot.familyName || !slot.locationName || !slot.encounterLevel) {
      throw new Error("Contract slot is not available.");
    }
    if (slot.expiresAt && slot.expiresAt <= now) {
      throw new Error("Contract offer has expired.");
    }

    const encounter = coerceEncounterForRun(slot as BoardSlotRecord, playerState.level);
    runId = `ctr_${randomUUID().replaceAll("-", "")}`;
    const simulationPlayerState = playerState.cheatSettings.invincibilityEnabled
      ? {
          ...playerState,
          health: {
            ...playerState.health,
            current: playerState.health.max
          }
        }
      : playerState;
    const simulation = simulateEncounter({
      playerState: simulationPlayerState,
      playerName: profile.account.username ?? "Warden",
      encounter,
      runId
    });
    const efficiencyTier = encounter.rewardPreview.efficiencyTier;
    travelDurationSeconds = resolveContractTravelDurationSeconds(playerState.level, efficiencyTier);
    travelEndsAt = new Date(now.getTime() + travelDurationSeconds * 1000);

    await spendPlayerStamina(tx, playerId, encounter.rewardPreview.staminaCost, now);
    await tx.contractRun.create({
      data: {
        id: runId,
        playerId,
        slotIndex: slotId,
        state: "traveling",
        contractName: encounter.contractName,
        difficulty: encounter.difficulty,
        familyId: encounter.family.familyId,
        familyName: encounter.family.familyName,
        locationName: encounter.family.locationName,
        encounterLevel: encounter.encounterLevel,
        travelEndsAt,
        travelDurationSeconds,
        winnerSide: simulation.winnerSide,
        combatBackgroundPath: null,
        travelImagePath: null,
        playerSnapshot: json(simulation.player),
        enemySnapshots: json(simulation.enemies),
        events: json(simulation.events),
        rewards: json(simulation.rewards)
      }
    });
    await tx.contractBoardSlot.update({
      where: {
        playerId_slotIndex: {
          playerId,
          slotIndex: slotId
        }
      },
      data: {
        state: "traveling",
        activeRunId: runId
      }
    });
  });

  return startContractRunResponseSchema.parse({
    runId,
    slotId,
    state: "traveling",
    travelEndsAt: (travelEndsAt ?? now).toISOString(),
    travelDurationSeconds
  });
}

export async function abandonContractOffer(prisma: PrismaClient, playerId: string, slotId: number): Promise<ContractBoardResponse> {
  const now = new Date();
  await refreshBoardState(prisma, playerId, now);
  const context = await getPlayerContractContext(prisma, playerId);

  const slot = await prisma.contractBoardSlot.findUnique({
    where: {
      playerId_slotIndex: {
        playerId,
        slotIndex: slotId
      }
    }
  });
  if (!slot || slot.state !== "available") {
    throw new Error("Contract slot is not available.");
  }

  const rng = createSeededRng(`${playerId}:slot:${slotId}:abandon:${now.toISOString()}`);
  await prisma.contractBoardSlot.update({
    where: { id: slot.id },
    data: {
      state: "replenishing",
      contractName: null,
      difficulty: null,
      familyId: null,
      familyName: null,
      locationName: null,
      encounterLevel: null,
      enemyCount: null,
      expiresAt: null,
      rewardsPreview: Prisma.JsonNull,
      replenishAt: buildReplenishAt(rng, now, context.playerLevel, context.fastContractReplenishEnabled)
    }
  });

  return getContractBoard(prisma, playerId);
}

export async function getContractRun(prisma: PrismaClient, playerId: string, runId: string): Promise<ContractRunSnapshot | null> {
  const now = new Date();
  await syncRunState(prisma, runId, now);
  const run = await prisma.contractRun.findFirst({
    where: { id: runId, playerId }
  });
  if (!run) return null;
  return loadRunSnapshotFromRecord(run);
}

export async function claimContractRunResult(prisma: PrismaClient, playerId: string, runId: string): Promise<ContractRunResult> {
  const now = new Date();
  await syncRunState(prisma, runId, now);
  let events = combatEventSchema.array().parse([]);
  let winnerSide: "player" | "enemy" = "enemy";
  let snapshot: ContractRunSnapshot | null = null;
  let rewardOutcome: {
    experience: number;
    ducats: number;
    item: null | { itemId: string; itemCode: string; itemName: string; rarity: string };
  } = {
    experience: 0,
    ducats: 0,
    item: null
  };

  await prisma.$transaction(async (tx) => {
    await lockPlayerContractState(tx, playerId);

    const run = await tx.contractRun.findFirst({
      where: { id: runId, playerId }
    });
    if (!run) {
      throw new Error("Contract run not found.");
    }
    if (run.state === "traveling") {
      throw new Error("Contract travel has not completed yet.");
    }
    if (run.state === "claimed") {
      throw new Error("Contract result already claimed.");
    }

    events = combatEventSchema.array().parse(run.events);
    const rewards = parseStoredRewards(run.rewards);
    winnerSide = run.winnerSide === "player" ? "player" : "enemy";
    const playerCurrentHp = resolvePlayerCurrentHpFromEvents({
      playerSnapshot: run.playerSnapshot,
      events: run.events
    });
    if (winnerSide === "player" && !run.rewardsGranted) {
      await grantPlayerExperience(tx, playerId, rewards.experience);
      await tx.currencyBalance.upsert({
        where: { playerId },
        update: { ducats: { increment: rewards.ducats } },
        create: { playerId, ducats: rewards.ducats, imperials: 0 }
      });

      if (rewards.item) {
        const item = rollInventoryItem({
          playerId,
          templateId: rewards.item.templateId,
          rarity: rewards.item.rarity,
          itemLevel: rewards.item.itemLevel
        });
        await tx.inventoryItem.create({
          data: {
            id: item.id,
            playerId,
            itemCode: item.itemCode,
            slotKey: "inventory",
            quantity: 1,
            itemData: item
          }
        });
        rewardOutcome = {
          experience: rewards.experience,
          ducats: rewards.ducats,
          item: {
            itemId: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            rarity: item.rarity
          }
        };
      } else {
        rewardOutcome = {
          experience: rewards.experience,
          ducats: rewards.ducats,
          item: null
        };
      }
    }

    const playerState = await loadPlayerState(tx, playerId);
    if (!playerState) {
      throw new Error("Player state not found.");
    }

    const slotRng = createSeededRng(`${playerId}:slot:${run.slotIndex}:claimed:${now.toISOString()}`);
    await tx.contractRun.update({
      where: { id: run.id },
      data: {
        state: "claimed",
        claimedAt: now,
        rewardsGranted: winnerSide === "player"
      }
    });
    await tx.contractBoardSlot.updateMany({
      where: { playerId, slotIndex: run.slotIndex, activeRunId: run.id },
      data: {
        state: "replenishing",
        contractName: null,
        difficulty: null,
        familyId: null,
        familyName: null,
        locationName: null,
        encounterLevel: null,
        enemyCount: null,
        expiresAt: null,
        activeRunId: null,
        rewardsPreview: Prisma.JsonNull,
        replenishAt: buildReplenishAt(
          slotRng,
          now,
          playerState.level,
          playerState.cheatSettings.fastContractReplenishEnabled
        )
      }
    });
    await tx.playerProfile.update({
      where: { id: playerId },
      data: {
        hitpointsCurrent: playerCurrentHp
      }
    });

    snapshot = await loadRunSnapshotFromRecord(run);
  });
  const updatedPlayerState = await loadPlayerState(prisma, playerId);
  if (!updatedPlayerState) {
    throw new Error("Player state not found.");
  }
  return contractRunResultSchema.parse({
    run: {
      ...(snapshot ?? (await getContractRun(prisma, playerId, runId))!),
      state: "claimed"
    },
    winnerSide,
    rewards: rewardOutcome,
    events,
    playerState: {
      level: updatedPlayerState.level,
      experience: updatedPlayerState.experience,
      experienceIntoLevel: updatedPlayerState.experienceIntoLevel,
      experienceToNextLevel: updatedPlayerState.experienceToNextLevel,
      health: updatedPlayerState.health,
      stamina: {
        current: updatedPlayerState.stamina.current,
        max: updatedPlayerState.stamina.max,
        nextPointAt: updatedPlayerState.stamina.nextPointAt
      },
      ducats: updatedPlayerState.currency.ducats
    }
  });
}
