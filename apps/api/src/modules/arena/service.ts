import type { ArenaEntry as PrismaArenaEntry, Prisma, PrismaClient } from "@prisma/client";
import {
  ARENA_ELO_K_FACTOR,
  ARENA_FIND_COOLDOWN_SECONDS,
  ARENA_LADDER_LIMIT,
  ARENA_MIN_RATING,
  ARENA_OFFER_COUNT,
  ARENA_RECENT_MATCH_LIMIT,
  ARENA_STARTING_RATING,
  arenaEncounterSchema,
  arenaLadderSchema,
  arenaMatchHistoryEntrySchema,
  arenaMatchResultSchema,
  arenaOfferSchema,
  arenaOpponentSummarySchema,
  arenaPreviewStatsSchema,
  arenaProfileSchema,
  arenaStateResponseSchema,
  type ArenaEncounter,
  type ArenaLadder,
  type ArenaMatchHistoryEntry,
  type ArenaMatchResult,
  type ArenaOffer,
  type ArenaOpponentSummary,
  type ArenaPreviewStats,
  type ArenaProfile,
  type ArenaStateResponse
} from "@ebonkeep/shared/arena";
import { combatActorSnapshotSchema, type CombatActorSnapshot, type CombatEvent } from "@ebonkeep/shared/combat";
import { allPlayerClasses, classToStatTree, playerClassSchema, type PlayerClass } from "@ebonkeep/shared/core";

import {
  applyAcademyArenaCooldownDuration,
  getEffectiveArenaOfferCount,
  getPlayerAcademyEffectTotals,
  type AcademyEffectTotals
} from "../academy/effects.js";
import { buildPlayerActorSnapshot, simulateCombat } from "../contracts/simulator.js";
import { CHEAT_FAST_ARENA_REPLENISH_DURATION_MS } from "../player/cheat-service.js";
import { loadPlayerState } from "../player/state-service.js";

const ARENA_LOCATION_NAME = "Ash Court Arena";
const DEFAULT_RATING_BAND = 150;
const MAX_RATING_BAND = 1200;
const MIN_NEARBY_MOCKS = 9;
const MIN_TOTAL_MOCKS = 18;

const MOCK_NAME_PREFIXES = ["Ash", "Black", "Duskworn", "Gilded", "Iron", "Stone", "Storm", "Thorn"];
const MOCK_NAME_SUFFIXES = ["Champion", "Harrier", "Warden", "Reaper", "Vanguard", "Marauder", "Caller", "Duelist"];
const LEGACY_ARENA_CLASS_ALIASES = {
  chronomancer: "voidcaster"
} as const satisfies Record<string, PlayerClass>;
const WEAPON_LABELS_BY_TREE = {
  strength: ["Durnholde Axe", "Black Bastard Sword", "Ashen Halberd", "Wardbreaker Maul"],
  dexterity: ["Nightglass Bow", "Gloamfang Daggers", "Riftshot Crossbow", "Sable Chakrams"],
  intelligence: ["Aetherwake Staff", "Suncall Grimoire", "Voidglass Orb", "Duskrune Focus"]
} satisfies Record<ReturnType<typeof classToStatTree>, readonly string[]>;

type ArenaDbClient = PrismaClient | Prisma.TransactionClient;

type RankedArenaEntry = PrismaArenaEntry & {
  rank: number;
};

function randomChoice<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeArenaPlayerClass(playerClass: string): PlayerClass {
  const canonicalClass = LEGACY_ARENA_CLASS_ALIASES[playerClass as keyof typeof LEGACY_ARENA_CLASS_ALIASES] ?? playerClass;
  const parsed = playerClassSchema.safeParse(canonicalClass);
  return parsed.success ? parsed.data : "juggernaut";
}

function getArenaFindCooldownMs(fastArenaReplenishEnabled: boolean): number {
  return fastArenaReplenishEnabled
    ? CHEAT_FAST_ARENA_REPLENISH_DURATION_MS
    : ARENA_FIND_COOLDOWN_SECONDS * 1000;
}

function ratingBandToMultiplier(playerRating: number, targetRating: number): number {
  return 1 + (targetRating - playerRating) / 3000;
}

function damageKindForClass(playerClass: PlayerClass): CombatActorSnapshot["damageKind"] {
  const statTree = classToStatTree(playerClass);
  if (statTree === "dexterity") {
    return "ranged";
  }
  if (statTree === "intelligence") {
    return "spell";
  }
  return "melee";
}

function buildPreviewStatsFromCombatSnapshot(snapshot: CombatActorSnapshot): ArenaPreviewStats {
  return arenaPreviewStatsSchema.parse({
    mainDamage: Math.max(1, Math.round((snapshot.minDamage + snapshot.maxDamage) / 2)),
    maxHitpoints: snapshot.maxHp,
    combatSpeed: snapshot.combatSpeed,
    armor: snapshot.damageKind === "spell" ? snapshot.spellShield : snapshot.armor
  });
}

function buildPlayerCombatSnapshot(playerState: Awaited<ReturnType<typeof loadPlayerState>>, playerName: string): CombatActorSnapshot {
  if (!playerState) {
    throw new Error("Arena requires a loaded player state.");
  }

  const snapshot = buildPlayerActorSnapshot({
    playerState,
    playerName
  });

  return combatActorSnapshotSchema.parse({
    ...snapshot,
    currentHp: snapshot.maxHp,
    usesSilhouetteFallback: true,
    avatarPath: undefined
  });
}

export function buildMockCombatSnapshot(args: {
  entryId: string;
  playerState: NonNullable<Awaited<ReturnType<typeof loadPlayerState>>>;
  playerRating: number;
  targetRating: number;
  playerClass: PlayerClass;
}): CombatActorSnapshot {
  const selectedClass = args.playerClass;
  const classTree = classToStatTree(selectedClass);
  const playerStats = args.playerState.statSnapshot.total;
  const ratingMultiplier = ratingBandToMultiplier(args.playerRating, args.targetRating);
  const classBias =
    classTree === "strength"
      ? { hp: 1.12, damage: 1.02, speed: 0.92, defense: 1.14, dodge: 0.86, crit: 0.92 }
      : classTree === "dexterity"
        ? { hp: 0.9, damage: 0.97, speed: 1.16, defense: 0.9, dodge: 1.2, crit: 1.04 }
        : { hp: 0.96, damage: 1.08, speed: 1.04, defense: 1.02, dodge: 0.94, crit: 1.12 };

  const level = clampInt(args.playerState.level + randomInt(-4, 4), 1, 100);
  const gearScore = Math.max(100, Math.round(args.playerState.gearScore * (0.82 + Math.random() * 0.38) * ratingMultiplier));
  const maxHp = Math.max(80, Math.round(playerStats.maxHitpoints * (0.82 + Math.random() * 0.24) * classBias.hp * ratingMultiplier));
  const averageDamage = Math.max(20, Math.round(playerStats.damage * (0.8 + Math.random() * 0.3) * classBias.damage * ratingMultiplier));
  const combatSpeed = Math.max(1, Math.round(playerStats.initiative * (0.88 + Math.random() * 0.22) * classBias.speed));
  const accuracy = Math.max(60, Math.round(playerStats.accuracy * (0.9 + Math.random() * 0.16)));
  const dodgeChance = Math.max(150, Math.round(playerStats.dodgeChance * (0.82 + Math.random() * 0.3) * classBias.dodge));
  const critChance = Math.max(300, Math.round(playerStats.critChance * (0.85 + Math.random() * 0.28) * classBias.crit));
  const critMultiplier = Math.max(15_000, Math.round(playerStats.critMultiplier * (0.92 + Math.random() * 0.18)));
  const extraAttackChance = Math.max(0, Math.round(playerStats.extraAttackChance * (0.72 + Math.random() * 0.32)));
  const armor = Math.max(0, Math.round(playerStats.armor * (0.78 + Math.random() * 0.28) * classBias.defense));
  const spellShield = Math.max(0, Math.round(playerStats.spellShield * (0.78 + Math.random() * 0.28) * (classTree === "intelligence" ? 1.18 : 0.94)));
  const missileResistance = Math.max(0, Math.round(playerStats.missileResistance * (0.78 + Math.random() * 0.28) * (classTree === "dexterity" ? 1.18 : 0.94)));
  const physicalDefense = Math.max(0, Math.round(playerStats.physicalDefense * (0.8 + Math.random() * 0.24)));
  const magicDefense = Math.max(0, Math.round(playerStats.magicDefense * (0.8 + Math.random() * 0.24)));

  return combatActorSnapshotSchema.parse({
    id: `arena:mock:${args.entryId}`,
    side: "enemy",
    encounterOrder: 0,
    name: `${randomChoice(MOCK_NAME_PREFIXES)} ${randomChoice(MOCK_NAME_SUFFIXES)}`,
    familyId: null,
    monsterRole: null,
    level,
    maxHp,
    currentHp: maxHp,
    combatSpeed,
    accuracy,
    dodgeChance,
    critChance,
    critMultiplier,
    extraAttackChance,
    armor,
    spellShield,
    missileResistance,
    physicalDefense,
    magicDefense,
    minDamage: Math.max(1, Math.floor(averageDamage * 0.88)),
    maxDamage: Math.max(1, Math.ceil(averageDamage * 1.12)),
    damageKind: damageKindForClass(selectedClass),
    usesSilhouetteFallback: true,
    avatarPath: undefined
  });
}

function buildWeaponLabelForClass(playerClass: PlayerClass): string {
  return randomChoice(WEAPON_LABELS_BY_TREE[classToStatTree(playerClass)]);
}

function toArenaOpponentSummary(entry: PrismaArenaEntry): ArenaOpponentSummary {
  return arenaOpponentSummarySchema.parse({
    entryId: entry.id,
    displayName: entry.displayName,
    class: normalizeArenaPlayerClass(entry.playerClass),
    level: entry.level,
    gearScore: entry.gearScore,
    rating: entry.rating,
    wins: entry.wins,
    losses: entry.losses,
    source: entry.source,
    weaponLabel: entry.weaponLabel ?? null,
    previewStats: arenaPreviewStatsSchema.parse(entry.previewStats)
  });
}

function parseArenaOpponentSummary(summary: unknown): ArenaOpponentSummary {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return arenaOpponentSummarySchema.parse(summary);
  }

  return arenaOpponentSummarySchema.parse({
    ...(summary as Record<string, unknown>),
    class: normalizeArenaPlayerClass(String((summary as Record<string, unknown>).class ?? "juggernaut"))
  });
}

function toArenaOffer(offer: {
  id: string;
  offeredAt: Date;
  cooldownEndsAt: Date;
  summary: unknown;
}): ArenaOffer {
  return arenaOfferSchema.parse({
    offerId: offer.id,
    offeredAt: offer.offeredAt.toISOString(),
    cooldownEndsAt: offer.cooldownEndsAt.toISOString(),
    opponent: parseArenaOpponentSummary(offer.summary)
  });
}

function toArenaMatchHistoryEntry(match: {
  id: string;
  createdAt: Date;
  ratingDelta: number;
  challengerRating: number;
  winnerSide: string;
  opponentSummary: unknown;
}): ArenaMatchHistoryEntry {
  return arenaMatchHistoryEntrySchema.parse({
    matchId: match.id,
    createdAt: match.createdAt.toISOString(),
    outcome: match.winnerSide === "player" ? "win" : "loss",
    ratingDelta: match.ratingDelta,
    ratingAfter: match.challengerRating,
    opponent: parseArenaOpponentSummary(match.opponentSummary)
  });
}

function rankArenaEntries(entries: PrismaArenaEntry[]): RankedArenaEntry[] {
  return [...entries]
    .sort((left, right) => {
      if (left.rating !== right.rating) {
        return right.rating - left.rating;
      }
      if (left.wins !== right.wins) {
        return right.wins - left.wins;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      return left.displayName.localeCompare(right.displayName);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}

function buildArenaLadder(args: {
  rankedEntries: RankedArenaEntry[];
  currentPlayerId: string;
}): ArenaLadder {
  const currentPlayerRank =
    args.rankedEntries.find((entry) => entry.playerId === args.currentPlayerId)?.rank ?? null;

  return arenaLadderSchema.parse({
    entries: args.rankedEntries.slice(0, ARENA_LADDER_LIMIT).map((entry) => ({
      rank: entry.rank,
      entryId: entry.id,
      displayName: entry.displayName,
      class: normalizeArenaPlayerClass(entry.playerClass),
      level: entry.level,
      gearScore: entry.gearScore,
      rating: entry.rating,
      wins: entry.wins,
      losses: entry.losses,
      isCurrentPlayer: entry.playerId === args.currentPlayerId,
      source: entry.source
    })),
    currentPlayerRank
  });
}

function buildArenaProfile(entry: RankedArenaEntry): ArenaProfile {
  return arenaProfileSchema.parse({
    entryId: entry.id,
    rating: entry.rating,
    wins: entry.wins,
    losses: entry.losses,
    rank: entry.rank,
    cooldownEndsAt: entry.cooldownEndsAt ? entry.cooldownEndsAt.toISOString() : null
  });
}

async function loadPlayerArenaContext(prisma: ArenaDbClient, playerId: string) {
  const playerState = await loadPlayerState(prisma, playerId);
  if (!playerState) {
    throw new Error("Player state unavailable.");
  }
  const academyEffects = await getPlayerAcademyEffectTotals(prisma, playerId);

  const profile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    include: {
      account: {
        select: {
          username: true
        }
      }
    }
  });

  if (!profile) {
    throw new Error("Arena player profile unavailable.");
  }

  const playerName = profile.account.username ?? `Warden ${playerId.slice(-4)}`;
  const combatSnapshot = buildPlayerCombatSnapshot(playerState, playerName);
  const previewStats = buildPreviewStatsFromCombatSnapshot(combatSnapshot);

  const entry = await prisma.arenaEntry.upsert({
    where: { playerId },
    create: {
      playerId,
      source: "player",
      rating: ARENA_STARTING_RATING,
      displayName: playerName,
      playerClass: playerState.class,
      level: playerState.level,
      gearScore: playerState.gearScore,
      weaponLabel: playerState.equipment.weapon?.itemName ?? null,
      previewStats,
      combatSnapshot
    },
    update: {
      displayName: playerName,
      playerClass: playerState.class,
      level: playerState.level,
      gearScore: playerState.gearScore,
      weaponLabel: playerState.equipment.weapon?.itemName ?? null,
      previewStats,
      combatSnapshot
    }
  });

  return {
    playerState,
    playerName,
    entry,
    academyEffects
  };
}

async function clearExpiredArenaOffersIfNeeded(prisma: ArenaDbClient, playerEntry: PrismaArenaEntry, now: Date) {
  const expired = playerEntry.cooldownEndsAt !== null && playerEntry.cooldownEndsAt.getTime() <= now.getTime();
  if (!expired) {
    return playerEntry;
  }

  await prisma.arenaOffer.deleteMany({
    where: { challengerId: playerEntry.playerId ?? "" }
  });

  return prisma.arenaEntry.update({
    where: { id: playerEntry.id },
    data: {
      cooldownEndsAt: null
    }
  });
}

function getEffectiveArenaCooldownEndsAt(args: {
  cooldownEndsAt: Date | null;
  updatedAt: Date;
  fastArenaReplenishEnabled: boolean;
}): Date | null {
  if (!args.cooldownEndsAt) {
    return null;
  }
  if (!args.fastArenaReplenishEnabled) {
    return args.cooldownEndsAt;
  }
  return new Date(
    Math.min(args.cooldownEndsAt.getTime(), args.updatedAt.getTime() + CHEAT_FAST_ARENA_REPLENISH_DURATION_MS)
  );
}

async function syncArenaCooldownState(args: {
  prisma: ArenaDbClient;
  playerEntry: PrismaArenaEntry;
  fastArenaReplenishEnabled: boolean;
  now: Date;
}) {
  const effectiveCooldownEndsAt = getEffectiveArenaCooldownEndsAt({
    cooldownEndsAt: args.playerEntry.cooldownEndsAt,
    updatedAt: args.playerEntry.updatedAt,
    fastArenaReplenishEnabled: args.fastArenaReplenishEnabled
  });

  if (!effectiveCooldownEndsAt || effectiveCooldownEndsAt.getTime() > args.now.getTime()) {
    if (
      effectiveCooldownEndsAt &&
      args.playerEntry.cooldownEndsAt &&
      effectiveCooldownEndsAt.getTime() !== args.playerEntry.cooldownEndsAt.getTime()
    ) {
      return args.prisma.arenaEntry.update({
        where: { id: args.playerEntry.id },
        data: {
          cooldownEndsAt: effectiveCooldownEndsAt
        }
      });
    }
    return args.playerEntry;
  }

  await args.prisma.arenaOffer.deleteMany({
    where: { challengerId: args.playerEntry.playerId ?? "" }
  });

  return args.prisma.arenaEntry.update({
    where: { id: args.playerEntry.id },
    data: {
      cooldownEndsAt: null
    }
  });
}

function buildMockEntryCreateData(args: {
  playerState: NonNullable<Awaited<ReturnType<typeof loadPlayerState>>>;
  playerRating: number;
  targetRating: number;
  ordinal: number;
}) {
  const mockClass = randomChoice(allPlayerClasses);
  const combatSnapshot = buildMockCombatSnapshot({
    entryId: `seed-${Date.now()}-${args.ordinal}-${Math.random().toString(16).slice(2, 8)}`,
    playerState: args.playerState,
    playerRating: args.playerRating,
    targetRating: args.targetRating,
    playerClass: mockClass
  });
  const displayName = combatSnapshot.name;

  return {
    source: "mock",
    rating: clampInt(args.targetRating + randomInt(-24, 24), ARENA_MIN_RATING, 3000),
    displayName,
    playerClass: mockClass,
    level: combatSnapshot.level,
    gearScore: Math.max(100, Math.round(args.playerState.gearScore * (0.82 + Math.random() * 0.38) * ratingBandToMultiplier(args.playerRating, args.targetRating))),
    weaponLabel: buildWeaponLabelForClass(mockClass),
    previewStats: buildPreviewStatsFromCombatSnapshot(combatSnapshot),
    combatSnapshot
  };
}

async function ensureArenaMockPool(
  prisma: ArenaDbClient,
  playerState: NonNullable<Awaited<ReturnType<typeof loadPlayerState>>>,
  playerEntry: PrismaArenaEntry
) {
  const nearbyMockCount = await prisma.arenaEntry.count({
    where: {
      source: "mock",
      rating: {
        gte: playerEntry.rating - DEFAULT_RATING_BAND,
        lte: playerEntry.rating + DEFAULT_RATING_BAND
      }
    }
  });
  const totalMockCount = await prisma.arenaEntry.count({
    where: { source: "mock" }
  });
  const mocksToCreate = Math.max(MIN_NEARBY_MOCKS - nearbyMockCount, MIN_TOTAL_MOCKS - totalMockCount, 0);

  for (let index = 0; index < mocksToCreate; index += 1) {
    const targetRating = clampInt(
      playerEntry.rating + randomInt(-DEFAULT_RATING_BAND, DEFAULT_RATING_BAND),
      ARENA_MIN_RATING,
      3000
    );
    await prisma.arenaEntry.create({
      data: buildMockEntryCreateData({
        playerState,
        playerRating: playerEntry.rating,
        targetRating,
        ordinal: index + totalMockCount
      })
    });
  }
}

export function pickArenaOfferCandidates(args: {
  playerRating: number;
  candidates: Array<{ id: string; rating: number }>;
  excludedEntryIds?: ReadonlySet<string>;
  offerCount?: number;
}): string[] {
  const excludedEntryIds = args.excludedEntryIds ?? new Set<string>();
  const offerCount = Math.max(1, args.offerCount ?? ARENA_OFFER_COUNT);
  const filtered = args.candidates
    .filter((candidate) => !excludedEntryIds.has(candidate.id))
    .sort((left, right) => {
      const leftDistance = Math.abs(left.rating - args.playerRating);
      const rightDistance = Math.abs(right.rating - args.playerRating);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return right.rating - left.rating;
    });

  for (let band = DEFAULT_RATING_BAND; band <= MAX_RATING_BAND; band += DEFAULT_RATING_BAND) {
    const inBand = filtered.filter((candidate) => Math.abs(candidate.rating - args.playerRating) <= band);
    if (inBand.length >= offerCount) {
      return inBand.slice(0, offerCount).map((candidate) => candidate.id);
    }
  }

  return filtered.slice(0, offerCount).map((candidate) => candidate.id);
}

export function calculateArenaRatingDelta(args: {
  playerRating: number;
  opponentRating: number;
  didWin: boolean;
}): number {
  const expectedScore = 1 / (1 + 10 ** ((args.opponentRating - args.playerRating) / 400));
  const actualScore = args.didWin ? 1 : 0;
  return Math.round(ARENA_ELO_K_FACTOR * (actualScore - expectedScore));
}

export function calculateArenaCooldownEndsAt(args: {
  now: Date;
  fastArenaReplenishEnabled: boolean;
  academyEffects?: AcademyEffectTotals;
}): Date {
  const baseDurationMs = getArenaFindCooldownMs(args.fastArenaReplenishEnabled);
  const effectiveDurationMs = args.fastArenaReplenishEnabled
    ? baseDurationMs
    : args.academyEffects
      ? applyAcademyArenaCooldownDuration(baseDurationMs, args.academyEffects)
      : baseDurationMs;
  return new Date(args.now.getTime() + effectiveDurationMs);
}

async function buildArenaReadModel(prisma: ArenaDbClient, playerId: string, playerEntryId: string) {
  const [entries, offers, matches] = await Promise.all([
    prisma.arenaEntry.findMany(),
    prisma.arenaOffer.findMany({
      where: { challengerId: playerId },
      orderBy: { offeredAt: "asc" }
    }),
    prisma.arenaMatch.findMany({
      where: { challengerId: playerId },
      orderBy: { createdAt: "desc" },
      take: ARENA_RECENT_MATCH_LIMIT
    })
  ]);

  const rankedEntries = rankArenaEntries(entries);
  const playerEntry = rankedEntries.find((entry) => entry.id === playerEntryId);
  if (!playerEntry) {
    throw new Error("Arena player entry missing.");
  }

  return {
    profile: buildArenaProfile(playerEntry),
    ladder: buildArenaLadder({
      rankedEntries,
      currentPlayerId: playerId
    }),
    offers: offers.map(toArenaOffer),
    recentMatches: matches.map(toArenaMatchHistoryEntry)
  };
}

export async function getArenaState(prisma: PrismaClient, playerId: string): Promise<ArenaStateResponse> {
  return prisma.$transaction(async (tx) => {
    const { playerState, entry } = await loadPlayerArenaContext(tx as ArenaDbClient, playerId);
    const now = new Date();
    const normalizedEntry = await clearExpiredArenaOffersIfNeeded(tx as ArenaDbClient, entry, now);
    const activeEntry = await syncArenaCooldownState({
      prisma: tx as ArenaDbClient,
      playerEntry: normalizedEntry,
      fastArenaReplenishEnabled: playerState.cheatSettings.fastArenaReplenishEnabled,
      now
    });
    await ensureArenaMockPool(tx as ArenaDbClient, playerState, activeEntry);

    const readModel = await buildArenaReadModel(tx as ArenaDbClient, playerId, activeEntry.id);

    return arenaStateResponseSchema.parse({
      serverTime: now.toISOString(),
      profile: readModel.profile,
      offers: readModel.offers,
      ladder: readModel.ladder,
      recentMatches: readModel.recentMatches,
      canFindOpponents: readModel.offers.length === 0 && readModel.profile.cooldownEndsAt === null
    });
  });
}

export async function findArenaOpponents(prisma: PrismaClient, playerId: string): Promise<ArenaStateResponse> {
  await prisma.$transaction(async (tx) => {
    const { playerState, entry, academyEffects } = await loadPlayerArenaContext(tx as ArenaDbClient, playerId);
    const now = new Date();
    const offerCount = getEffectiveArenaOfferCount(ARENA_OFFER_COUNT, academyEffects);
    const normalizedEntry = await clearExpiredArenaOffersIfNeeded(tx as ArenaDbClient, entry, now);
    const activeEntry = await syncArenaCooldownState({
      prisma: tx as ArenaDbClient,
      playerEntry: normalizedEntry,
      fastArenaReplenishEnabled: playerState.cheatSettings.fastArenaReplenishEnabled,
      now
    });

    const existingOffers = await tx.arenaOffer.findMany({
      where: { challengerId: playerId }
    });
    if (activeEntry.cooldownEndsAt && activeEntry.cooldownEndsAt.getTime() > now.getTime()) {
      throw new Error("Arena cooldown active.");
    }
    if (existingOffers.length > 0) {
      throw new Error("Arena offers already active.");
    }

    await ensureArenaMockPool(tx as ArenaDbClient, playerState, activeEntry);

    const recentMatches = await tx.arenaMatch.findMany({
      where: { challengerId: playerId },
      orderBy: { createdAt: "desc" },
      take: 5
    });
    const recentOpponentIds = new Set(recentMatches.map((match) => match.opponentEntryId));
    const candidateEntries = await tx.arenaEntry.findMany({
      where: {
        source: "mock"
      }
    });
    let chosenIds = pickArenaOfferCandidates({
      playerRating: activeEntry.rating,
      candidates: candidateEntries,
      excludedEntryIds: recentOpponentIds,
      offerCount
    });

    while (chosenIds.length < offerCount) {
      const targetRating = clampInt(
        activeEntry.rating + randomInt(-DEFAULT_RATING_BAND, DEFAULT_RATING_BAND),
        ARENA_MIN_RATING,
        3000
      );
      const created = await tx.arenaEntry.create({
        data: buildMockEntryCreateData({
          playerState,
          playerRating: activeEntry.rating,
          targetRating,
          ordinal: chosenIds.length + 1
        })
      });
      candidateEntries.push(created);
      chosenIds = pickArenaOfferCandidates({
        playerRating: activeEntry.rating,
        candidates: candidateEntries,
        excludedEntryIds: recentOpponentIds,
        offerCount
      });
    }

    const cooldownEndsAt = calculateArenaCooldownEndsAt({
      now,
      fastArenaReplenishEnabled: playerState.cheatSettings.fastArenaReplenishEnabled,
      academyEffects
    });
    const selectedEntries = candidateEntries.filter((candidate) => chosenIds.includes(candidate.id));
    await tx.arenaEntry.update({
      where: { id: activeEntry.id },
      data: {
        cooldownEndsAt
      }
    });
    await tx.arenaOffer.createMany({
      data: selectedEntries.map((selectedEntry) => ({
        challengerId: playerId,
        opponentEntryId: selectedEntry.id,
        summary: toArenaOpponentSummary(selectedEntry),
        combatSnapshot: combatActorSnapshotSchema.parse(selectedEntry.combatSnapshot),
        cooldownEndsAt
      }))
    });
  });

  return getArenaState(prisma, playerId);
}

function buildArenaEncounter(args: {
  player: CombatActorSnapshot;
  opponent: CombatActorSnapshot;
  matchId: string;
}): ArenaEncounter {
  return arenaEncounterSchema.parse({
    encounterId: `${args.matchId}-encounter`,
    locationName: ARENA_LOCATION_NAME,
    combatBackgroundPath: null,
    player: args.player,
    enemy: args.opponent
  });
}

export async function fightArenaOffer(prisma: PrismaClient, playerId: string, offerId: string): Promise<ArenaMatchResult> {
  return prisma.$transaction(async (tx) => {
    const { playerState, playerName, entry, academyEffects } = await loadPlayerArenaContext(tx as ArenaDbClient, playerId);
    const now = new Date();
    const normalizedEntry = await clearExpiredArenaOffersIfNeeded(tx as ArenaDbClient, entry, now);
    const activeEntry = await syncArenaCooldownState({
      prisma: tx as ArenaDbClient,
      playerEntry: normalizedEntry,
      fastArenaReplenishEnabled: playerState.cheatSettings.fastArenaReplenishEnabled,
      now
    });

    const offer = await tx.arenaOffer.findUnique({
      where: { id: offerId }
    });
    if (!offer || offer.challengerId !== playerId) {
      throw new Error("Arena offer not found.");
    }
    if (offer.cooldownEndsAt.getTime() <= now.getTime()) {
      throw new Error("Arena offer expired.");
    }

    const opponentEntry = await tx.arenaEntry.findUnique({
      where: { id: offer.opponentEntryId }
    });
    if (!opponentEntry) {
      throw new Error("Arena opponent missing.");
    }

    const playerSnapshot = buildPlayerCombatSnapshot(playerState, playerName);
    const opponentSnapshot = combatActorSnapshotSchema.parse(offer.combatSnapshot);
    const events = simulateCombat({
      player: playerSnapshot,
      enemies: [
        combatActorSnapshotSchema.parse({
          ...opponentSnapshot,
          side: "enemy",
          currentHp: opponentSnapshot.maxHp
        })
      ],
      seed: `${offerId}:${now.toISOString()}`,
      levelDeltaMode: "neutral"
    });
    const combatEnded = events[events.length - 1] as Extract<CombatEvent, { type: "CombatEnded" }>;
    const didWin = combatEnded.winnerSide === "player";
    const baseRatingDelta = calculateArenaRatingDelta({
      playerRating: activeEntry.rating,
      opponentRating: opponentEntry.rating,
      didWin
    });
    const ratingDelta = didWin
      ? Math.max(0, baseRatingDelta + academyEffects.arenaRatingWinFlat)
      : Math.min(0, baseRatingDelta + academyEffects.arenaRatingLossReductionFlat);
    const updatedPlayerRating = Math.max(ARENA_MIN_RATING, activeEntry.rating + ratingDelta);
    const updatedOpponentRating = Math.max(ARENA_MIN_RATING, opponentEntry.rating - ratingDelta);

    await tx.arenaEntry.update({
      where: { id: activeEntry.id },
      data: {
        rating: updatedPlayerRating,
        wins: didWin ? { increment: 1 } : undefined,
        losses: didWin ? undefined : { increment: 1 }
      }
    });
    await tx.arenaEntry.update({
      where: { id: opponentEntry.id },
      data: {
        rating: updatedOpponentRating,
        wins: didWin ? undefined : { increment: 1 },
        losses: didWin ? { increment: 1 } : undefined
      }
    });

    const opponentSummary = parseArenaOpponentSummary(offer.summary);
    const match = await tx.arenaMatch.create({
      data: {
        challengerId: playerId,
        opponentEntryId: opponentEntry.id,
        winnerSide: combatEnded.winnerSide,
        ratingDelta,
        challengerRating: updatedPlayerRating,
        opponentRating: updatedOpponentRating,
        opponentSummary,
        encounter: buildArenaEncounter({
          player: playerSnapshot,
          opponent: combatActorSnapshotSchema.parse({
            ...opponentSnapshot,
            side: "enemy",
            currentHp: opponentSnapshot.maxHp
          }),
          matchId: offerId
        }),
        events
      }
    });

    await tx.arenaOffer.deleteMany({
      where: {
        challengerId: playerId
      }
    });

    const readModel = await buildArenaReadModel(tx as ArenaDbClient, playerId, activeEntry.id);
    const encounter = arenaEncounterSchema.parse(match.encounter);

    return arenaMatchResultSchema.parse({
      matchId: match.id,
      winnerSide: combatEnded.winnerSide,
      ratingDelta,
      profile: readModel.profile,
      ladder: readModel.ladder,
      recentMatches: readModel.recentMatches,
      encounter,
      events
    });
  });
}
