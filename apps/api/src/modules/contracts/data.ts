import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ContractDifficulty, ContractRewardPreview, CombatDamageKind } from "@ebonkeep/shared/combat";
import type { PlayerClass } from "@ebonkeep/shared/core";

export const CONTRACT_SLOT_COUNT = 6;
export const CONTRACT_TRAVEL_DURATION_MS = 10_000;
export const CONTRACT_REPLENISH_MIN_MS = 60 * 60 * 1000;
export const CONTRACT_REPLENISH_MAX_MS = 120 * 60 * 1000;

export const CONTRACT_DIFFICULTY_OFFSETS: Record<ContractDifficulty, readonly [number, number]> = {
  easy: [-1, 0],
  medium: [1, 2],
  hard: [3, 4]
};

export const CONTRACT_DIFFICULTY_WINDOWS: Record<ContractDifficulty, { minMs: number; maxMs: number }> = {
  easy: { minMs: 35 * 60 * 1000, maxMs: 90 * 60 * 1000 },
  medium: { minMs: 25 * 60 * 1000, maxMs: 75 * 60 * 1000 },
  hard: { minMs: 20 * 60 * 1000, maxMs: 60 * 60 * 1000 }
};

export const CONTRACT_ACTION_NAMES: Record<ContractDifficulty, readonly string[]> = {
  easy: ["Recon Sweep", "Caravan Escort", "Pest Culling", "Tunnel Sweep"],
  medium: ["Camp Break", "Supply Recovery", "Warden Relief", "Marsh Hunt"],
  hard: ["Siege Break", "Nightfall Hunt", "Warband Cleanse", "Frontier Purge"]
};

export const DIFFICULTY_PROFILES: Record<
  ContractDifficulty,
  {
    totalHpFactor: number;
    totalDpsFactor: number;
    defenseFactor: number;
    speedFactor: number;
    accuracyFactor: number;
    critFactor: number;
    dodgeFactor: number;
    itemDropChanceBps: number;
    rewardFactor: number;
    staminaBase: number;
  }
> = {
  easy: {
    totalHpFactor: 1.85,
    totalDpsFactor: 0.65,
    defenseFactor: 0.85,
    speedFactor: 0.95,
    accuracyFactor: 0.95,
    critFactor: 0.85,
    dodgeFactor: 0.9,
    itemDropChanceBps: 1200,
    rewardFactor: 1,
    staminaBase: 8
  },
  medium: {
    totalHpFactor: 2.4,
    totalDpsFactor: 0.8,
    defenseFactor: 1,
    speedFactor: 1,
    accuracyFactor: 1,
    critFactor: 1,
    dodgeFactor: 1,
    itemDropChanceBps: 2000,
    rewardFactor: 1.35,
    staminaBase: 12
  },
  hard: {
    totalHpFactor: 3.1,
    totalDpsFactor: 0.95,
    defenseFactor: 1.15,
    speedFactor: 1.05,
    accuracyFactor: 1.05,
    critFactor: 1.1,
    dodgeFactor: 1.08,
    itemDropChanceBps: 3000,
    rewardFactor: 1.8,
    staminaBase: 16
  }
};

export const BIAS_MULTIPLIERS = {
  low: 0.85,
  medium: 1,
  high: 1.15
} as const;

export const ROLE_PROFILES: Record<
  string,
  {
    hp: number;
    damage: number;
    defense: number;
    speed: number;
    accuracy: number;
    crit: number;
    evasion: number;
    chain: number;
  }
> = {
  default: { hp: 1, damage: 1, defense: 1, speed: 1, accuracy: 1, crit: 1, evasion: 1, chain: 1 },
  skirmisher: { hp: 0.92, damage: 0.98, defense: 0.9, speed: 1.16, accuracy: 1.02, crit: 1.02, evasion: 1.15, chain: 1.05 },
  ambusher: { hp: 0.9, damage: 1.02, defense: 0.92, speed: 1.08, accuracy: 1.04, crit: 1.08, evasion: 1.12, chain: 1.1 },
  harrier: { hp: 0.9, damage: 0.98, defense: 0.9, speed: 1.14, accuracy: 1, crit: 0.98, evasion: 1.12, chain: 1.1 },
  bruiser: { hp: 1.12, damage: 1.08, defense: 1.04, speed: 0.92, accuracy: 1, crit: 1, evasion: 0.9, chain: 0.95 },
  runner: { hp: 0.88, damage: 0.96, defense: 0.88, speed: 1.18, accuracy: 0.98, crit: 0.95, evasion: 1.18, chain: 1.05 },
  ranged: { hp: 0.86, damage: 1, defense: 0.86, speed: 1.02, accuracy: 1.16, crit: 1.02, evasion: 1.08, chain: 1.02 },
  caster: { hp: 0.84, damage: 1.04, defense: 0.88, speed: 0.96, accuracy: 1.08, crit: 1.04, evasion: 0.96, chain: 0.95 },
  mender: { hp: 0.9, damage: 0.88, defense: 0.94, speed: 0.94, accuracy: 1, crit: 0.92, evasion: 0.95, chain: 0.9 },
  tank: { hp: 1.35, damage: 0.88, defense: 1.28, speed: 0.82, accuracy: 0.96, crit: 0.9, evasion: 0.8, chain: 0.85 },
  boss: { hp: 1.5, damage: 1.14, defense: 1.18, speed: 0.98, accuracy: 1.06, crit: 1.08, evasion: 0.94, chain: 1.08 }
};

export type MonsterBias = keyof typeof BIAS_MULTIPLIERS;

export type MonsterFamily = {
  baseLevel: number;
  familyId: string;
  familyName: string;
  locationName: string;
};

export type MonsterMember = {
  familyId: string;
  sequence: number;
  monsterRole: string;
  isBoss: boolean;
  monsterName: string;
  mainStat: "strength" | "dexterity" | "intelligence";
  damageKind: CombatDamageKind;
  healthBias: MonsterBias;
  damageBias: MonsterBias;
  armorBias: MonsterBias;
  spellShieldBias: MonsterBias;
  missileResistBias: MonsterBias;
  initiativeBias: MonsterBias;
  accuracyBias: MonsterBias;
  critBias: MonsterBias;
  evasionBias: MonsterBias;
};

export type BoardGenerationContext = {
  playerId: string;
  playerLevel: number;
  playerClass: PlayerClass;
};

export type EncounterDefinition = {
  contractName: string;
  difficulty: ContractDifficulty;
  family: MonsterFamily;
  members: MonsterMember[];
  encounterLevel: number;
  rewardPreview: ContractRewardPreview;
};

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: string): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: () => number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return min + Math.floor(rng() * (max - min + 1));
}

export function randomChoice<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)] ?? values[0];
}

export function shuffle<T>(rng: () => number, values: readonly T[]): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function rollBps(rng: () => number, chanceBps: number): boolean {
  return Math.floor(rng() * 10_000) < chanceBps;
}

function resolveDataPath(fileName: string): string {
  const fromRepoRoot = resolve(process.cwd(), "docs", "data", fileName);
  if (existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }
  return resolve(process.cwd(), "..", "..", "docs", "data", fileName);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      const nextChar = index + 1 < line.length ? line[index + 1] : "";
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim().replace(/^"|"$/g, ""));
  return cells;
}

function parseCsv(fileName: string): Record<string, string>[] {
  const raw = readFileSync(resolveDataPath(fileName), "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const [headerLine, ...rowLines] = lines;
  const headers = parseCsvLine(headerLine ?? "");

  return rowLines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function toInt(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBool(value: string | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === "TRUE";
}

export const monsterFamilies = parseCsv("monster_families_v1.csv")
  .map((row) => ({
    baseLevel: toInt(row.base_level),
    familyId: row.family_id,
    familyName: row.family_name,
    locationName: row.location_name
  }))
  .filter((family) => family.familyId.length > 0);

export const monsterMembers = parseCsv("monster_family_members_v1.csv")
  .map((row) => ({
    familyId: row.family_id,
    sequence: toInt(row.sequence, 1),
    monsterRole: row.monster_role || "default",
    isBoss: toBool(row.is_boss),
    monsterName: row.monster_name,
    mainStat: (row.main_stat || "strength") as MonsterMember["mainStat"],
    damageKind: (row.damage_kind === "spell" ? "spell" : row.damage_kind === "ranged" ? "ranged" : "melee") as CombatDamageKind,
    healthBias: (row.health_bias || "medium") as MonsterBias,
    damageBias: (row.damage_bias || "medium") as MonsterBias,
    armorBias: (row.armor_bias || "medium") as MonsterBias,
    spellShieldBias: (row.spell_shield_bias || "medium") as MonsterBias,
    missileResistBias: (row.missile_resist_bias || "medium") as MonsterBias,
    initiativeBias: (row.initiative_bias || "medium") as MonsterBias,
    accuracyBias: (row.accuracy_bias || "medium") as MonsterBias,
    critBias: (row.crit_bias || "medium") as MonsterBias,
    evasionBias: (row.evasion_bias || "medium") as MonsterBias
  }))
  .filter((member) => member.familyId.length > 0 && member.monsterName.length > 0);

export const monsterMembersByFamily = new Map<string, MonsterMember[]>();
for (const member of monsterMembers) {
  const members = monsterMembersByFamily.get(member.familyId) ?? [];
  members.push(member);
  monsterMembersByFamily.set(member.familyId, members);
}

export function getBiasMultiplier(value: MonsterBias): number {
  return BIAS_MULTIPLIERS[value] ?? 1;
}

export function getRoleProfile(role: string, isBoss: boolean) {
  if (isBoss) {
    return ROLE_PROFILES.boss;
  }
  return ROLE_PROFILES[role] ?? ROLE_PROFILES.default;
}

export function buildRewardPreview(difficulty: ContractDifficulty, encounterLevel: number): ContractRewardPreview {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const experienceBase = Math.round((110 + encounterLevel * 26) * profile.rewardFactor);
  const ducatsBase = Math.round((65 + encounterLevel * 18) * profile.rewardFactor);

  return {
    experienceMin: Math.max(20, Math.round(experienceBase * 0.85)),
    experienceMax: Math.max(25, Math.round(experienceBase * 1.15)),
    ducatsMin: Math.max(10, Math.round(ducatsBase * 0.85)),
    ducatsMax: Math.max(12, Math.round(ducatsBase * 1.15)),
    itemDropChanceBps: profile.itemDropChanceBps,
    staminaCost: clampInt(profile.staminaBase + encounterLevel * 0.35, profile.staminaBase, profile.staminaBase + 20)
  };
}

export function buildContractName(rng: () => number, family: MonsterFamily, difficulty: ContractDifficulty): string {
  const action = randomChoice(rng, CONTRACT_ACTION_NAMES[difficulty]);
  const locationNoun = family.locationName.split(" ")[0] || family.familyName;
  return `${locationNoun} ${action}`;
}

export function pickDifficultyForSlot(rng: () => number, slotIndex: number): ContractDifficulty {
  const roll = rng();
  if (slotIndex >= 5) {
    return roll < 0.3 ? "medium" : "hard";
  }
  if (slotIndex <= 2) {
    return roll < 0.65 ? "easy" : "medium";
  }
  if (roll < 0.35) return "easy";
  if (roll < 0.8) return "medium";
  return "hard";
}

export function pickEncounterLevel(rng: () => number, difficulty: ContractDifficulty, playerLevel: number): number {
  const [minOffset, maxOffset] = CONTRACT_DIFFICULTY_OFFSETS[difficulty];
  return Math.max(1, playerLevel + randomInt(rng, minOffset, maxOffset));
}

export function pickFamilyForLevel(rng: () => number, encounterLevel: number): MonsterFamily {
  const candidates = monsterFamilies
    .map((family) => ({ family, delta: Math.abs(family.baseLevel - encounterLevel) }))
    .sort((left, right) => left.delta - right.delta)
    .filter((entry, index) => entry.delta <= 5 || index < 5);
  const weighted = candidates.flatMap((entry) => Array.from({ length: Math.max(1, 6 - Math.min(5, entry.delta)) }, () => entry.family));
  return randomChoice(rng, weighted);
}

export function pickEncounterMembers(rng: () => number, difficulty: ContractDifficulty, familyId: string): MonsterMember[] {
  const familyMembers = monsterMembersByFamily.get(familyId) ?? [];
  const nonBossMembers = familyMembers.filter((member) => !member.isBoss).sort((left, right) => left.sequence - right.sequence);
  const bossMembers = familyMembers.filter((member) => member.isBoss).sort((left, right) => left.sequence - right.sequence);

  if (nonBossMembers.length === 0) {
    throw new Error(`No non-boss monsters for family '${familyId}'.`);
  }

  const enemyCount = difficulty === "easy" ? randomInt(rng, 1, 2) : difficulty === "medium" ? 2 : randomInt(rng, 2, 3);
  const pool = shuffle(rng, nonBossMembers);
  const chosen: MonsterMember[] = [];

  if (difficulty === "hard" && bossMembers.length > 0 && rollBps(rng, 5500)) {
    chosen.push(randomChoice(rng, bossMembers));
  }

  while (chosen.length < enemyCount) {
    const member = pool[(chosen.length + randomInt(rng, 0, pool.length - 1)) % pool.length] ?? pool[0];
    if (!member) {
      break;
    }
    chosen.push(member);
  }

  return chosen.slice(0, enemyCount);
}

export function buildEncounterDefinition(rng: () => number, context: BoardGenerationContext, slotIndex: number): EncounterDefinition {
  const difficulty = pickDifficultyForSlot(rng, slotIndex);
  const encounterLevel = pickEncounterLevel(rng, difficulty, context.playerLevel);
  const family = pickFamilyForLevel(rng, encounterLevel);
  const members = pickEncounterMembers(rng, difficulty, family.familyId);

  return {
    contractName: buildContractName(rng, family, difficulty),
    difficulty,
    family,
    members,
    encounterLevel,
    rewardPreview: buildRewardPreview(difficulty, encounterLevel)
  };
}
