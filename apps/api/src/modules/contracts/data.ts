import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveContractStaminaCost } from "../../config/activity-pacing.js";
import type {
  CombatDamageKind,
  ContractEfficiencyTier,
  ContractLevelBand,
  ContractRewardPreview
} from "@ebonkeep/shared/combat";
import type { PlayerClass } from "@ebonkeep/shared/core";
import { getExpectedPlayerCombatMetrics } from "./balance-model.js";

export const CONTRACT_SLOT_COUNT = 6;
export const CONTRACT_LEVEL_BANDS: readonly ContractLevelBand[] = ["under_level", "on_level", "over_level"] as const;
export const CONTRACT_AVAILABILITY_WINDOW = {
  minMs: 25 * 60 * 1000,
  maxMs: 75 * 60 * 1000
} as const;
export const CONTRACT_LEVEL_WINDOW_RADIUS = 6;
export const CONTRACT_LEVEL_NORMAL_RANGE = {
  minDelta: -3,
  maxDelta: 3
} as const;
const CONTRACT_LEVEL_DISTRIBUTION_SIGMA = 4.2;
const CONTRACT_LEVEL_DELTA_RANGES: Record<ContractLevelBand, { minDelta: number; maxDelta: number }> = {
  under_level: { minDelta: -6, maxDelta: -4 },
  on_level: CONTRACT_LEVEL_NORMAL_RANGE,
  over_level: { minDelta: 4, maxDelta: 6 }
};

const EFFICIENCY_REWARD_FACTORS: Record<ContractEfficiencyTier, number> = {
  low_cost: 0.92,
  standard_cost: 1,
  high_cost: 1.08
};

export const CONTRACT_ACTION_NAMES: Record<ContractLevelBand, readonly string[]> = {
  under_level: ["Recon Sweep", "Caravan Escort", "Pest Culling", "Tunnel Sweep"],
  on_level: ["Camp Break", "Supply Recovery", "Warden Relief", "Marsh Hunt"],
  over_level: ["Siege Break", "Nightfall Hunt", "Warband Cleanse", "Frontier Purge"]
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
  skirmisher: { hp: 0.92, damage: 0.9, defense: 0.9, speed: 1.09, accuracy: 1.02, crit: 1.02, evasion: 1.12, chain: 1.03 },
  ambusher: { hp: 0.9, damage: 0.92, defense: 0.92, speed: 1.07, accuracy: 1.03, crit: 1.04, evasion: 1.08, chain: 1.06 },
  harrier: { hp: 0.9, damage: 0.89, defense: 0.9, speed: 1.08, accuracy: 1, crit: 0.99, evasion: 1.1, chain: 1.05 },
  bruiser: { hp: 1.12, damage: 1.14, defense: 1.04, speed: 0.96, accuracy: 1, crit: 1, evasion: 0.92, chain: 0.91 },
  runner: { hp: 0.88, damage: 0.87, defense: 0.88, speed: 1.1, accuracy: 0.99, crit: 0.96, evasion: 1.15, chain: 1.02 },
  ranged: { hp: 0.86, damage: 0.91, defense: 0.86, speed: 1.05, accuracy: 1.12, crit: 1.01, evasion: 1.05, chain: 1.02 },
  caster: { hp: 0.84, damage: 1.01, defense: 0.88, speed: 1, accuracy: 1.06, crit: 1.03, evasion: 0.98, chain: 0.97 },
  mender: { hp: 0.9, damage: 0.9, defense: 0.94, speed: 0.99, accuracy: 1, crit: 0.92, evasion: 0.97, chain: 0.9 },
  tank: { hp: 1.35, damage: 1.12, defense: 1.28, speed: 0.93, accuracy: 0.96, crit: 0.92, evasion: 0.84, chain: 0.82 },
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
  levelBand: ContractLevelBand;
  family: MonsterFamily;
  members: MonsterMember[];
  encounterLevel: number;
  rewardPreview: ContractRewardPreview;
};

export type MonsterLevelCurve = {
  maxHp: number;
  averageDamage: number;
  typedDefense: number;
  bonusDefense: number;
  combatSpeed: number;
  accuracy: number;
  dodgeChance: number;
  critChance: number;
  critMultiplier: number;
  extraAttackChance: number;
};

type LevelRange = {
  min: number;
  max: number;
};

export const CONTRACT_EFFICIENCY_TIER_WEIGHTS: Record<ContractEfficiencyTier, number> = {
  low_cost: 0.5,
  standard_cost: 0.35,
  high_cost: 0.15
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

export const zoneBaseLevels = [...new Set(monsterFamilies.map((family) => family.baseLevel))].sort((left, right) => left - right);
export const monsterFamiliesById = new Map(monsterFamilies.map((family) => [family.familyId, family] as const));

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

export function isKnownMonsterFamily(familyId: string): boolean {
  return monsterFamiliesById.has(familyId);
}

export function hasEncounterMembersForFamily(familyId: string): boolean {
  const familyMembers = monsterMembersByFamily.get(familyId) ?? [];
  return familyMembers.some((member) => !member.isBoss);
}

function createLevelRange(min: number, max: number): LevelRange {
  const boundedMin = clampInt(min, 1, 100);
  const boundedMax = clampInt(max, 1, 100);
  return boundedMax >= boundedMin
    ? { min: boundedMin, max: boundedMax }
    : { min: boundedMin, max: boundedMin };
}

export function resolveContractLevelWindow(playerLevel: number): LevelRange {
  return createLevelRange(playerLevel - CONTRACT_LEVEL_WINDOW_RADIUS, playerLevel + CONTRACT_LEVEL_WINDOW_RADIUS);
}

export function resolveAnchorZoneBaseLevel(playerLevel: number): number {
  return [...zoneBaseLevels]
    .sort((left, right) => {
      const leftDelta = Math.abs(left - playerLevel);
      const rightDelta = Math.abs(right - playerLevel);
      if (leftDelta !== rightDelta) {
        return leftDelta - rightDelta;
      }
      return right - left;
    })[0] ?? 0;
}

export function resolveZoneBaseLevelForEncounterLevel(encounterLevel: number): number {
  return resolveAnchorZoneBaseLevel(encounterLevel);
}

export function resolveZoneBaseLevelForBand(playerLevel: number, levelBand: ContractLevelBand): number {
  const range = resolveEncounterLevelRange(playerLevel, levelBand);
  const midpoint = Math.round((range.min + range.max) / 2);
  return resolveZoneBaseLevelForEncounterLevel(midpoint);
}

export function resolveEncounterLevelRange(playerLevel: number, levelBand: ContractLevelBand): LevelRange {
  const deltaRange = CONTRACT_LEVEL_DELTA_RANGES[levelBand];
  return createLevelRange(playerLevel + deltaRange.minDelta, playerLevel + deltaRange.maxDelta);
}

export function normalizeContractLevelBand(value: string | null | undefined): ContractLevelBand | null {
  if (!value) {
    return null;
  }
  if (value === "under_level" || value === "on_level" || value === "over_level") {
    return value;
  }
  if (value === "easy") {
    return "under_level";
  }
  if (value === "hard") {
    return "over_level";
  }
  if (value === "medium") {
    return "on_level";
  }
  return null;
}

export function resolveContractLevelBand(playerLevel: number, encounterLevel: number): ContractLevelBand {
  const levelDelta = encounterLevel - playerLevel;
  if (levelDelta <= CONTRACT_LEVEL_DELTA_RANGES.under_level.maxDelta) {
    return "under_level";
  }
  if (levelDelta >= CONTRACT_LEVEL_DELTA_RANGES.over_level.minDelta) {
    return "over_level";
  }
  return "on_level";
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

export function getMonsterLevelCurve(level: number): MonsterLevelCurve {
  const clampedLevel = clampInt(level, 1, 100);
  const metrics = getExpectedPlayerCombatMetrics({
    playerClass: "juggernaut",
    level: clampedLevel
  });
  const playerStats = metrics.playerState.statSnapshot.total;
  const outputPressure = metrics.dps * Math.max(1, metrics.tempo / 100);
  const ehpDamageDivisor = 24 + (Math.max(0, clampedLevel - 35) * 0.12);
  const lateLevelPressure = Math.max(0, clampedLevel - 80);
  const earlyLevelPressure = Math.max(0, 75 - clampedLevel);
  const midgamePressure = Math.max(0, Math.min(clampedLevel, 80) - 45);
  const midgameThreatPressure = Math.max(0, 20 - Math.abs(clampedLevel - 65));
  const focusedMidgamePressure = Math.max(0, 12 - Math.abs(clampedLevel - 72));
  const noviceAttenuation = clampedLevel <= 15 ? Math.min(1, 0.35 + (clampedLevel * 0.04)) : 1;
  const targetCadencePressure = Math.max(0, 16 - Math.abs(clampedLevel - 60));

  return {
    maxHp: Math.max(1, Math.round(((outputPressure * 2.7) + (clampedLevel * 5.4) + (earlyLevelPressure * 4.9)) * noviceAttenuation)),
    averageDamage: Math.max(
      1,
      Math.round(
        (
          (metrics.ehp / ehpDamageDivisor) +
          (clampedLevel * 0.7) +
          (lateLevelPressure * 0.52) +
          (earlyLevelPressure * 0.74) +
          (midgamePressure * 0.9) +
          (midgameThreatPressure * 1.04) +
          (focusedMidgamePressure * 0.72) +
          (targetCadencePressure * 0.31)
        ) *
        noviceAttenuation
      )
    ),
    typedDefense: Math.max(0, Math.round(((metrics.dps * 0.64) + (clampedLevel * 0.24)) * noviceAttenuation)),
    bonusDefense: Math.max(0, Math.round(((metrics.dps * 0.26) + (clampedLevel * 0.08)) * noviceAttenuation)),
    combatSpeed: Math.max(
      1,
      Math.round(
        (
          (playerStats.initiative * 0.82) +
          (clampedLevel * 0.06) +
          (lateLevelPressure * 0.14) +
          (earlyLevelPressure * 0.08) +
          (midgamePressure * 0.06) +
          (midgameThreatPressure * 0.08) +
          (focusedMidgamePressure * 0.11) +
          (targetCadencePressure * 0.13)
        ) *
        noviceAttenuation
      )
    ),
    accuracy: Math.max(
      0,
      Math.round(
        (
          (playerStats.accuracy * 0.9) +
          (clampedLevel * 0.18) +
          (lateLevelPressure * 0.12) +
          (midgamePressure * 0.14) +
          (midgameThreatPressure * 0.55) +
          (focusedMidgamePressure * 0.65)
        ) *
        noviceAttenuation
      )
    ),
    dodgeChance: Math.max(
      0,
      Math.round(((playerStats.dodgeChance * 0.6) + (clampedLevel * 4.8) + (lateLevelPressure * 2.5)) * noviceAttenuation)
    ),
    critChance: Math.max(
      0,
      Math.round(
        (
          (playerStats.critChance * 0.38) +
          140 +
          (clampedLevel * 3.8) +
          (lateLevelPressure * 1.5) +
          (midgameThreatPressure * 4.5) +
          (focusedMidgamePressure * 6)
        ) *
        noviceAttenuation
      )
    ),
    critMultiplier: Math.max(15_000, Math.round(15_100 + (clampedLevel * 22))),
    extraAttackChance: Math.max(
      0,
      Math.round(
        (
          (playerStats.extraAttackChance * 0.18) +
          (clampedLevel * 2.2) +
          (lateLevelPressure * 0.7) +
          (midgamePressure * 0.75) +
          (midgameThreatPressure * 4.5) +
          (focusedMidgamePressure * 5)
        ) *
        noviceAttenuation
      )
    )
  };
}

export function pickContractEfficiencyTier(rng: () => number): ContractEfficiencyTier {
  const roll = rng();
  if (roll < CONTRACT_EFFICIENCY_TIER_WEIGHTS.low_cost) {
    return "low_cost";
  }
  if (roll < CONTRACT_EFFICIENCY_TIER_WEIGHTS.low_cost + CONTRACT_EFFICIENCY_TIER_WEIGHTS.standard_cost) {
    return "standard_cost";
  }
  return "high_cost";
}

function getItemDropChanceBps(encounterLevel: number): number {
  return clampInt(1_150 + (encounterLevel * 22), 900, 3_600);
}

export function buildRewardPreview(
  encounterLevel: number,
  playerLevel: number,
  efficiencyTier: ContractEfficiencyTier
): ContractRewardPreview {
  const efficiencyFactor = EFFICIENCY_REWARD_FACTORS[efficiencyTier] ?? 1;
  const experienceBase = Math.round((115 + (encounterLevel * 30) + (encounterLevel * encounterLevel * 1.35)) * efficiencyFactor);
  const ducatsBase = Math.round((68 + (encounterLevel * 18) + (encounterLevel * encounterLevel * 0.72)) * efficiencyFactor);

  return {
    experienceMin: Math.max(20, Math.round(experienceBase * 0.85)),
    experienceMax: Math.max(25, Math.round(experienceBase * 1.15)),
    ducatsMin: Math.max(10, Math.round(ducatsBase * 0.85)),
    ducatsMax: Math.max(12, Math.round(ducatsBase * 1.15)),
    itemDropChanceBps: getItemDropChanceBps(encounterLevel),
    staminaCost: resolveContractStaminaCost(playerLevel, efficiencyTier),
    efficiencyTier
  };
}

export function buildContractName(rng: () => number, family: MonsterFamily, levelBand: ContractLevelBand): string {
  const action = randomChoice(rng, CONTRACT_ACTION_NAMES[levelBand]);
  const locationNoun = family.locationName.split(" ")[0] || family.familyName;
  return `${locationNoun} ${action}`;
}

function sampleStandardNormal(rng: () => number): number {
  const first = Math.max(rng(), Number.EPSILON);
  const second = rng();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

export function rollContractEncounterLevel(rng: () => number, playerLevel: number): number {
  const levelWindow = resolveContractLevelWindow(playerLevel);
  let lastCandidate = playerLevel;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = Math.round(playerLevel + (sampleStandardNormal(rng) * CONTRACT_LEVEL_DISTRIBUTION_SIGMA));
    lastCandidate = candidate;
    if (candidate >= levelWindow.min && candidate <= levelWindow.max) {
      return clampInt(candidate, levelWindow.min, levelWindow.max);
    }
  }

  return clampInt(lastCandidate, levelWindow.min, levelWindow.max);
}

export function pickEncounterLevel(rng: () => number, levelBand: ContractLevelBand, playerLevel: number): number {
  const range = resolveEncounterLevelRange(playerLevel, levelBand);
  return randomInt(rng, range.min, range.max);
}

export function pickFamilyForZoneBase(rng: () => number, zoneBaseLevel: number): MonsterFamily {
  const exactMatches = monsterFamilies.filter((family) => family.baseLevel === zoneBaseLevel);
  if (exactMatches.length > 0) {
    return randomChoice(rng, exactMatches);
  }

  const nearest = [...monsterFamilies]
    .sort((left, right) => {
      const leftDelta = Math.abs(left.baseLevel - zoneBaseLevel);
      const rightDelta = Math.abs(right.baseLevel - zoneBaseLevel);
      if (leftDelta !== rightDelta) {
        return leftDelta - rightDelta;
      }
      return right.baseLevel - left.baseLevel;
    })
    .slice(0, 5);

  return randomChoice(rng, nearest);
}

export function pickEncounterMembers(rng: () => number, familyId: string): MonsterMember[] {
  const familyMembers = monsterMembersByFamily.get(familyId) ?? [];
  const nonBossMembers = familyMembers.filter((member) => !member.isBoss).sort((left, right) => left.sequence - right.sequence);

  if (nonBossMembers.length === 0) {
    throw new Error(`No non-boss monsters for family '${familyId}'.`);
  }

  const enemyCountRoll = rng();
  const enemyCount = enemyCountRoll < 0.25 ? 1 : enemyCountRoll < 0.75 ? 2 : 3;
  const chosen: MonsterMember[] = [];
  const pool = shuffle(rng, nonBossMembers);

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
  void slotIndex;
  return buildEncounterDefinitionForLevel(rng, context, rollContractEncounterLevel(rng, context.playerLevel));
}

export function buildEncounterDefinitionForLevel(
  rng: () => number,
  context: BoardGenerationContext,
  encounterLevel: number
): EncounterDefinition {
  const levelBand = resolveContractLevelBand(context.playerLevel, encounterLevel);
  const family = pickFamilyForZoneBase(rng, resolveZoneBaseLevelForEncounterLevel(encounterLevel));
  const members = pickEncounterMembers(rng, family.familyId);
  const efficiencyTier = pickContractEfficiencyTier(rng);

  return {
    contractName: buildContractName(rng, family, levelBand),
    levelBand,
    family,
    members,
    encounterLevel,
    rewardPreview: buildRewardPreview(encounterLevel, context.playerLevel, efficiencyTier)
  };
}

export function buildEncounterDefinitionForBand(
  rng: () => number,
  context: BoardGenerationContext,
  levelBand: ContractLevelBand
): EncounterDefinition {
  return buildEncounterDefinitionForLevel(rng, context, pickEncounterLevel(rng, levelBand, context.playerLevel));
}
