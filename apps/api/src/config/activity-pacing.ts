import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ContractEfficiencyTier } from "@ebonkeep/shared/combat";

type ActivityPacingRow = {
  level: number;
  travelSecondsBase: number;
  staminaRegenPercentPerHour: number;
  contractStaminaCostLow: number;
  contractStaminaCostStandard: number;
  contractStaminaCostHigh: number;
  missionStaminaCostLow: number;
  missionStaminaCostStandard: number;
  missionStaminaCostHigh: number;
};

type ContractReplenishPacingRow = {
  level: number;
  replenishMinSeconds: number;
  replenishMaxSeconds: number;
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

function toNumber(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampLevel(level: number): number {
  return Math.max(1, Math.min(100, Math.floor(level)));
}

const ACTIVITY_PACING_ROWS = parseCsv("activity_pacing_level_1_100.csv").map((row) => ({
  level: toInt(row.level, 1),
  travelSecondsBase: toInt(row.travel_seconds_base, 5),
  staminaRegenPercentPerHour: toNumber(row.stamina_regen_percent_per_hour, 25),
  contractStaminaCostLow: toInt(row.contract_stamina_cost_low, 5),
  contractStaminaCostStandard: toInt(row.contract_stamina_cost_standard, 7),
  contractStaminaCostHigh: toInt(row.contract_stamina_cost_high, 9),
  missionStaminaCostLow: toInt(row.mission_stamina_cost_low, 5),
  missionStaminaCostStandard: toInt(row.mission_stamina_cost_standard, 7),
  missionStaminaCostHigh: toInt(row.mission_stamina_cost_high, 9)
})) satisfies ActivityPacingRow[];

const CONTRACT_REPLENISH_ROWS = parseCsv("contract_replenish_pacing_level_1_100.csv").map((row) => ({
  level: toInt(row.level, 1),
  replenishMinSeconds: toInt(row.replenish_min_seconds, 45),
  replenishMaxSeconds: toInt(row.replenish_max_seconds, 75)
})) satisfies ContractReplenishPacingRow[];

const ACTIVITY_PACING_BY_LEVEL = new Map(ACTIVITY_PACING_ROWS.map((row) => [row.level, row] as const));
const CONTRACT_REPLENISH_BY_LEVEL = new Map(CONTRACT_REPLENISH_ROWS.map((row) => [row.level, row] as const));

export const CONTRACT_EFFICIENCY_TIER_TRAVEL_MULTIPLIER: Record<ContractEfficiencyTier, number> = {
  low_cost: 0.7,
  standard_cost: 1,
  high_cost: 1.3
};

export function getActivityPacingRow(level: number): ActivityPacingRow {
  return ACTIVITY_PACING_BY_LEVEL.get(clampLevel(level)) ?? ACTIVITY_PACING_ROWS[0]!;
}

export function getContractReplenishPacingRow(level: number): ContractReplenishPacingRow {
  return CONTRACT_REPLENISH_BY_LEVEL.get(clampLevel(level)) ?? CONTRACT_REPLENISH_ROWS[0]!;
}

export function resolveContractStaminaCost(level: number, tier: ContractEfficiencyTier): number {
  const row = getActivityPacingRow(level);
  if (tier === "low_cost") {
    return row.contractStaminaCostLow;
  }
  if (tier === "high_cost") {
    return row.contractStaminaCostHigh;
  }
  return row.contractStaminaCostStandard;
}

export function resolveMissionStaminaCost(level: number, tier: ContractEfficiencyTier): number {
  const row = getActivityPacingRow(level);
  if (tier === "low_cost") {
    return row.missionStaminaCostLow;
  }
  if (tier === "high_cost") {
    return row.missionStaminaCostHigh;
  }
  return row.missionStaminaCostStandard;
}

export function resolveContractBaseTravelSeconds(level: number): number {
  return getActivityPacingRow(level).travelSecondsBase;
}

export function resolveContractTravelDurationSeconds(level: number, tier: ContractEfficiencyTier): number {
  const baseTravelSeconds = resolveContractBaseTravelSeconds(level);
  return Math.max(1, Math.round(baseTravelSeconds * CONTRACT_EFFICIENCY_TIER_TRAVEL_MULTIPLIER[tier]));
}

export function resolveStaminaRegenPercentPerHour(level: number): number {
  return getActivityPacingRow(level).staminaRegenPercentPerHour;
}
