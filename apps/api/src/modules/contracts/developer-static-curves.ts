import { developerContractsStaticCurvesResponseSchema, type ContractLevelBand } from "@ebonkeep/shared/combat";

import {
  getContractReplenishPacingRow,
  resolveContractStaminaCost,
  resolveStaminaRegenPercentPerHour,
  resolveContractTravelDurationSeconds
} from "../../config/activity-pacing.js";
import { getExperienceToNextLevel } from "../player/progression-service.js";
import {
  CONTRACT_EFFICIENCY_TIER_WEIGHTS,
  CONTRACT_SLOT_COUNT,
  CONTRACT_LEVEL_BANDS,
  buildRewardPreview,
  resolveEncounterLevelRange
} from "./data.js";

const CONTRACT_EFFICIENCY_TIERS = ["low_cost", "standard_cost", "high_cost"] as const;

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAverageTravelSeconds(level: number): number {
  return roundToTwo(average(CONTRACT_EFFICIENCY_TIERS.map((tier) => resolveContractTravelDurationSeconds(level, tier))));
}

function getAverageReplenishSeconds(level: number): number {
  const row = getContractReplenishPacingRow(level);
  return roundToTwo((row.replenishMinSeconds + row.replenishMaxSeconds) / 2);
}

function getWeightedAverageStaminaCostPerContract(level: number): number {
  return roundToTwo(CONTRACT_EFFICIENCY_TIERS.reduce((total, tier) => {
    return total + (resolveContractStaminaCost(level, tier) * CONTRACT_EFFICIENCY_TIER_WEIGHTS[tier]);
  }, 0));
}

function getWeightedAverageStaminaWaitSecondsForContract(level: number): number {
  const regenPercentPerHour = Math.max(0, resolveStaminaRegenPercentPerHour(level));
  const maxStamina = 120;
  const regenPerHour = (maxStamina * regenPercentPerHour) / 100;
  if (regenPerHour <= 0) {
    return 0;
  }

  return roundToTwo(CONTRACT_EFFICIENCY_TIERS.reduce((total, tier) => {
    const requiredStamina = resolveContractStaminaCost(level, tier);
    return total + ((requiredStamina * (3600 / regenPerHour)) * CONTRACT_EFFICIENCY_TIER_WEIGHTS[tier]);
  }, 0));
}

function getAverageContractAvailabilityWaitSeconds(level: number): number {
  const row = getContractReplenishPacingRow(level);
  const min = row.replenishMinSeconds;
  const max = row.replenishMaxSeconds;
  if (CONTRACT_SLOT_COUNT <= 0) {
    return 0;
  }

  return roundToTwo(min + ((max - min) / (CONTRACT_SLOT_COUNT + 1)));
}

function getAverageExperiencePerContract(level: number, levelBand: ContractLevelBand): number {
  const range = resolveEncounterLevelRange(level, levelBand);
  const values: number[] = [];
  for (let encounterLevel = range.min; encounterLevel <= range.max; encounterLevel += 1) {
    const rewardPreview = buildRewardPreview(encounterLevel, level, "standard_cost");
    values.push((rewardPreview.experienceMin + rewardPreview.experienceMax) / 2);
  }
  return roundToTwo(average(values));
}

export function getDeveloperContractsStaticCurves() {
  return developerContractsStaticCurvesResponseSchema.parse({
    levels: Array.from({ length: 100 }, (_, index) => {
      const level = index + 1;
      return {
        level,
        averageTravelSeconds: getAverageTravelSeconds(level),
        averageReplenishSeconds: getAverageReplenishSeconds(level),
        averageStaminaWaitSecondsForContract: getWeightedAverageStaminaWaitSecondsForContract(level),
        weightedAverageStaminaWaitSecondsForContract: getWeightedAverageStaminaWaitSecondsForContract(level),
        weightedAverageStaminaCostPerContract: getWeightedAverageStaminaCostPerContract(level),
        averageContractAvailabilityWaitSeconds: getAverageContractAvailabilityWaitSeconds(level),
        averageExperiencePerContract: Object.fromEntries(
          CONTRACT_LEVEL_BANDS.map((levelBand) => [levelBand, getAverageExperiencePerContract(level, levelBand)])
        ),
        experienceToNextLevel: getExperienceToNextLevel(level)
      };
    })
  });
}
