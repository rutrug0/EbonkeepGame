import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Prisma, PrismaClient } from "@prisma/client";

const MAX_LEVEL = 100;
const STAMINA_REGEN_INTERVAL_MS = 5 * 60 * 1000;

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
  now?: Date;
}): StaminaState {
  const max = Math.max(0, Math.floor(args.max));
  const current = Math.max(0, Math.min(max, Math.floor(args.current)));
  const now = args.now ?? new Date();

  if (current >= max) {
    return {
      current: max,
      max,
      updatedAt: now,
      nextPointAt: null
    };
  }

  const elapsedMs = Math.max(0, now.getTime() - args.updatedAt.getTime());
  const regeneratedPoints = Math.floor(elapsedMs / STAMINA_REGEN_INTERVAL_MS);

  if (regeneratedPoints <= 0) {
    return {
      current,
      max,
      updatedAt: args.updatedAt,
      nextPointAt: new Date(args.updatedAt.getTime() + STAMINA_REGEN_INTERVAL_MS).toISOString()
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

  const consumedMs = regeneratedPoints * STAMINA_REGEN_INTERVAL_MS;
  const updatedAt = new Date(args.updatedAt.getTime() + consumedMs);

  return {
    current: nextCurrent,
    max,
    updatedAt,
    nextPointAt: new Date(updatedAt.getTime() + STAMINA_REGEN_INTERVAL_MS).toISOString()
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
  const stamina = resolveStaminaState({
    current: args.staminaCurrent,
    max: args.staminaMax,
    updatedAt: args.staminaUpdatedAt,
    now: args.now
  });
  const experience = resolveExperienceState({
    level: args.level,
    experience: args.experience
  });

  return {
    stamina,
    experience
  };
}

export async function syncPlayerProgress(prisma: PrismaClient, playerId: string, now = new Date()): Promise<PlayerProgressState> {
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
  staminaRegenIntervalMs: STAMINA_REGEN_INTERVAL_MS
} as const;
