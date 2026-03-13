import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveStaminaRegenPercentPerHour } from "../../config/activity-pacing.js";

const MAX_LEVEL = 100;
const REST_HEALTH_PER_DUCAT = 10;
const REST_STAMINA_PER_DUCAT = 1;

type ExperienceCurveRow = {
  level: number;
  xpToNext: number;
  cumulativeXpToReachLevel: number;
};

type StaminaState = {
  current: number;
  max: number;
  updatedAt: Date;
  nextPointAt: string | null;
};

type ExperienceState = {
  level: number;
  experience: number;
  experienceIntoLevel: number;
  experienceToNextLevel: number;
};

type PlayerProgressState = {
  stamina: StaminaState;
  experience: ExperienceState;
};

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

function loadExperienceCurve(): ExperienceCurveRow[] {
  const raw = readFileSync(resolveDataPath("experience_requirements_level_1_100.csv"), "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const [headerLine, ...rowLines] = lines;
  const headers = parseCsvLine(headerLine ?? "");

  return rowLines.map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? "0"]));

    return {
      level: Number.parseInt(row.level ?? "1", 10),
      xpToNext: Number.parseInt(row.xp_to_next ?? "1", 10),
      cumulativeXpToReachLevel: Number.parseInt(row.cumulative_xp_to_reach_level ?? "0", 10)
    };
  });
}

const EXPERIENCE_CURVE = loadExperienceCurve();
const EXPERIENCE_ROW_BY_LEVEL = new Map(EXPERIENCE_CURVE.map((row) => [row.level, row] as const));

function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
}

export function getExperienceToNextLevel(level: number): number {
  const normalizedLevel = clampLevel(level);
  const row = EXPERIENCE_ROW_BY_LEVEL.get(normalizedLevel);
  if (!row) {
    return 1;
  }
  return normalizedLevel >= MAX_LEVEL ? 1 : Math.max(1, row.xpToNext);
}

export function getCumulativeExperienceToReachLevel(level: number): number {
  const normalizedLevel = clampLevel(level);
  const row = EXPERIENCE_ROW_BY_LEVEL.get(normalizedLevel);
  if (!row) {
    return 0;
  }
  return Math.max(0, row.cumulativeXpToReachLevel);
}

export function resolveLevelFromExperience(experience: number): number {
  const normalizedExperience = Math.max(0, Math.floor(experience));
  let resolvedLevel = 1;

  for (const row of EXPERIENCE_CURVE) {
    if (normalizedExperience >= row.cumulativeXpToReachLevel) {
      resolvedLevel = row.level;
      continue;
    }
    break;
  }

  return clampLevel(resolvedLevel);
}

export function resolveExperienceState(args: { level: number; experience: number }): ExperienceState {
  const experience = Math.max(0, Math.floor(args.experience));
  const level = Math.max(clampLevel(args.level), resolveLevelFromExperience(experience));
  const currentLevelFloor = getCumulativeExperienceToReachLevel(level);

  return {
    level,
    experience,
    experienceIntoLevel: Math.max(0, experience - currentLevelFloor),
    experienceToNextLevel: getExperienceToNextLevel(level)
  };
}

export function resolveStaminaState(args: {
  current: number;
  max: number;
  updatedAt: Date;
  level: number;
  now?: Date;
}): StaminaState {
  const max = Math.max(0, Math.floor(args.max));
  const current = Math.max(0, Math.min(max, Math.floor(args.current)));
  const now = args.now ?? new Date();
  const regenPercentPerHour = Math.max(0, resolveStaminaRegenPercentPerHour(args.level));
  const regenPerHour = (max * regenPercentPerHour) / 100;
  const msPerPoint = regenPerHour > 0 ? 3_600_000 / regenPerHour : Number.POSITIVE_INFINITY;

  if (current >= max) {
    return {
      current: max,
      max,
      updatedAt: now,
      nextPointAt: null
    };
  }

  if (!Number.isFinite(msPerPoint) || msPerPoint <= 0) {
    return {
      current,
      max,
      updatedAt: args.updatedAt,
      nextPointAt: null
    };
  }

  const elapsedMs = Math.max(0, now.getTime() - args.updatedAt.getTime());
  const regeneratedPoints = Math.floor(elapsedMs / msPerPoint);

  if (regeneratedPoints <= 0) {
    return {
      current,
      max,
      updatedAt: args.updatedAt,
      nextPointAt: new Date(args.updatedAt.getTime() + msPerPoint).toISOString()
    };
  }

  const nextCurrent = Math.min(max, current + regeneratedPoints);
  if (nextCurrent >= max) {
    return {
      current: max,
      max,
      updatedAt: now,
      nextPointAt: null
    };
  }

  const consumedMs = regeneratedPoints * msPerPoint;
  const updatedAt = new Date(args.updatedAt.getTime() + consumedMs);

  return {
    current: nextCurrent,
    max,
    updatedAt,
    nextPointAt: new Date(updatedAt.getTime() + msPerPoint).toISOString()
  };
}

export function resolvePlayerProgressState(args: {
  level: number;
  experience: number;
  staminaCurrent: number;
  staminaMax: number;
  staminaUpdatedAt: Date;
  now?: Date;
}): PlayerProgressState {
  const experience = resolveExperienceState({
    level: args.level,
    experience: args.experience
  });
  const stamina = resolveStaminaState({
    current: args.staminaCurrent,
    max: args.staminaMax,
    updatedAt: args.staminaUpdatedAt,
    level: experience.level,
    now: args.now
  });

  return {
    stamina,
    experience
  };
}

export async function syncPlayerProgress(prisma: PrismaClient | Prisma.TransactionClient, playerId: string, now = new Date()): Promise<PlayerProgressState> {
  const profile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: {
      level: true,
      experience: true,
      staminaCurrent: true,
      staminaMax: true,
      staminaUpdatedAt: true
    }
  });

  if (!profile) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const progress = resolvePlayerProgressState({
    level: profile.level,
    experience: profile.experience,
    staminaCurrent: profile.staminaCurrent,
    staminaMax: profile.staminaMax,
    staminaUpdatedAt: profile.staminaUpdatedAt,
    now
  });

  if (
    progress.experience.level !== profile.level ||
    progress.stamina.current !== profile.staminaCurrent ||
    progress.stamina.updatedAt.getTime() !== profile.staminaUpdatedAt.getTime()
  ) {
    await prisma.playerProfile.update({
      where: { id: playerId },
      data: {
        level: progress.experience.level,
        staminaCurrent: progress.stamina.current,
        staminaUpdatedAt: progress.stamina.updatedAt
      }
    });
  }

  return progress;
}

export async function spendPlayerStamina(
  tx: Prisma.TransactionClient,
  playerId: string,
  amount: number,
  now = new Date()
): Promise<StaminaState> {
  const profile = await tx.playerProfile.findUnique({
    where: { id: playerId },
    select: {
      staminaCurrent: true,
      staminaMax: true,
      staminaUpdatedAt: true,
      experience: true,
      level: true
    }
  });

  if (!profile) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const stamina = resolveStaminaState({
    current: profile.staminaCurrent,
    max: profile.staminaMax,
    updatedAt: profile.staminaUpdatedAt,
    level: profile.level,
    now
  });
  const spendAmount = Math.max(0, Math.floor(amount));

  if (stamina.current < spendAmount) {
    throw new Error("Not enough stamina.");
  }

  const nextCurrent = stamina.current - spendAmount;
  const nextUpdatedAt = nextCurrent >= stamina.max ? now : stamina.updatedAt;

  await tx.playerProfile.update({
    where: { id: playerId },
    data: {
      level: resolveExperienceState({
        level: profile.level,
        experience: profile.experience
      }).level,
      staminaCurrent: nextCurrent,
      staminaUpdatedAt: nextUpdatedAt
    }
  });

  return resolveStaminaState({
    current: nextCurrent,
    max: stamina.max,
    updatedAt: nextUpdatedAt,
    level: profile.level,
    now
  });
}

export async function grantPlayerExperience(
  tx: Prisma.TransactionClient,
  playerId: string,
  amount: number
): Promise<ExperienceState> {
  const profile = await tx.playerProfile.findUnique({
    where: { id: playerId },
    select: {
      level: true,
      experience: true
    }
  });

  if (!profile) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const experience = Math.max(0, profile.experience + Math.max(0, Math.floor(amount)));
  const nextState = resolveExperienceState({
    level: profile.level,
    experience
  });

  await tx.playerProfile.update({
    where: { id: playerId },
    data: {
      level: nextState.level,
      experience: nextState.experience
    }
  });

  return nextState;
}

export const playerProgressionConfig = {
  maxLevel: MAX_LEVEL,
  staminaRegenPercentPerHour: resolveStaminaRegenPercentPerHour(1),
  restHealthPerDucat: REST_HEALTH_PER_DUCAT,
  restStaminaPerDucat: REST_STAMINA_PER_DUCAT
} as const;

function resolveStoredCurrentHealth(storedCurrent: number, maxHealth: number): number {
  const normalizedMax = Math.max(1, Math.floor(maxHealth));
  if (storedCurrent < 0) {
    return normalizedMax;
  }
  return Math.max(0, Math.min(normalizedMax, Math.floor(storedCurrent)));
}

export function calculateRestCost(args: {
  currentHealth: number;
  maxHealth: number;
  currentStamina: number;
  maxStamina: number;
}): number {
  const missingHealth = Math.max(0, Math.floor(args.maxHealth) - Math.max(0, Math.floor(args.currentHealth)));
  const missingStamina = Math.max(0, Math.floor(args.maxStamina) - Math.max(0, Math.floor(args.currentStamina)));
  const healthCost = Math.ceil(missingHealth / REST_HEALTH_PER_DUCAT);
  const staminaCost = Math.ceil(missingStamina / REST_STAMINA_PER_DUCAT);
  return Math.max(0, healthCost + staminaCost);
}

export async function restPlayerResources(args: {
  tx: Prisma.TransactionClient;
  playerId: string;
  maxHealth: number;
  now?: Date;
}): Promise<{ costDucats: number; stamina: StaminaState; currentHealth: number }> {
  const now = args.now ?? new Date();
  await args.tx.$queryRaw`SELECT "id" FROM "player_profiles" WHERE "id" = ${args.playerId} FOR UPDATE`;
  const profile = await args.tx.playerProfile.findUnique({
    where: { id: args.playerId },
    select: {
      hitpointsCurrent: true,
      staminaCurrent: true,
      staminaMax: true,
      staminaUpdatedAt: true,
      level: true
    }
  });

  if (!profile) {
    throw new Error(`Player not found: ${args.playerId}`);
  }

  const maxHealth = Math.max(1, Math.floor(args.maxHealth));
  const currentHealth = resolveStoredCurrentHealth(profile.hitpointsCurrent, maxHealth);
  const stamina = resolveStaminaState({
    current: profile.staminaCurrent,
    max: profile.staminaMax,
    updatedAt: profile.staminaUpdatedAt,
    level: profile.level,
    now
  });
  const costDucats = calculateRestCost({
    currentHealth,
    maxHealth,
    currentStamina: stamina.current,
    maxStamina: stamina.max
  });

  if (costDucats > 0) {
    const deduction = await args.tx.currencyBalance.updateMany({
      where: {
        playerId: args.playerId,
        ducats: { gte: costDucats }
      },
      data: {
        ducats: { decrement: costDucats }
      }
    });

    if (deduction.count !== 1) {
      throw new Error("Not enough ducats to rest.");
    }
  }

  await args.tx.playerProfile.update({
    where: { id: args.playerId },
    data: {
      hitpointsCurrent: maxHealth,
      staminaCurrent: stamina.max,
      staminaUpdatedAt: now
    }
  });

  return {
    costDucats,
    currentHealth: maxHealth,
    stamina: {
      current: stamina.max,
      max: stamina.max,
      updatedAt: now,
      nextPointAt: null
    }
  };
}
