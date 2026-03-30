import type { GuildRaidBossDefinition } from "@ebonkeep/shared/guild";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
import type { ViewBackgroundName } from "../../lib/viewBackgrounds";

type RaidSceneConfig = {
  familyId?: string;
  travelFallback: ViewBackgroundName;
  combatFallback: ViewBackgroundName;
};

const RAID_SCENE_BY_ZONE_KEY: Record<string, RaidSceneConfig> = {
  snagtooth_hollow: {
    familyId: "snagtooth_hollow_00",
    travelFallback: "garden",
    combatFallback: "garden"
  },
  mirepool_bog: {
    familyId: "mirepool_boglings_04",
    travelFallback: "garden",
    combatFallback: "garden"
  },
  graveward_barrows: {
    travelFallback: "arena",
    combatFallback: "arena"
  },
  cinderhold_ridge: {
    familyId: "ternfield_hobgoblins_08",
    travelFallback: "forge",
    combatFallback: "forge"
  },
  saltwake_shoals: {
    familyId: "saltwake_reavers_12",
    travelFallback: "merchant",
    combatFallback: "merchant"
  },
  ashen_throne: {
    travelFallback: "refinery",
    combatFallback: "forge"
  }
};

function createBackgroundPath(name: ViewBackgroundName): string {
  return `/assets/backgrounds/${name}.png`;
}

function getGeneratedStageAssetPath(type: "travel_stage" | "combat_stage", familyId: string): string | undefined {
  const legacyExactKey = type === "travel_stage" ? `travel_stage:${familyId}` : `combat_stage:${familyId}`;
  const exactAssetPath = GENERATED_ITEM_ICON_PATHS[legacyExactKey];
  if (exactAssetPath) {
    return exactAssetPath;
  }

  const prefix = type === "travel_stage" ? `travel_stage:${familyId}:default` : `combat_stage:${familyId}:`;
  const matchedEntry = Object.entries(GENERATED_ITEM_ICON_PATHS).find(([key]) => key.startsWith(prefix));
  return matchedEntry?.[1];
}

export function getGuildRaidScenePaths(boss: GuildRaidBossDefinition): {
  travelImagePath: string | undefined;
  combatBackgroundPath: string | undefined;
  travelFocusImagePath: string | undefined;
} {
  const scene = RAID_SCENE_BY_ZONE_KEY[boss.zoneKey];
  const generatedTravelStagePath = scene?.familyId
    ? getGeneratedStageAssetPath("travel_stage", scene.familyId)
    : undefined;
  const generatedCombatStagePath = boss.stageAssetPath
    ?? (scene?.familyId ? getGeneratedStageAssetPath("combat_stage", scene.familyId) : undefined);

  return {
    travelImagePath:
      generatedTravelStagePath
      ?? generatedCombatStagePath
      ?? (scene ? createBackgroundPath(scene.travelFallback) : boss.portraitAssetPath ?? undefined),
    combatBackgroundPath:
      generatedCombatStagePath
      ?? (scene ? createBackgroundPath(scene.combatFallback) : undefined),
    travelFocusImagePath: boss.portraitAssetPath ?? undefined
  };
}
