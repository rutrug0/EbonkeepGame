import type { GardenPlantId, GardenPlotPhase } from "@ebonkeep/shared/garden";

const GARDEN_ASSET_BASE_PATH = "/assets/items/generated/garden";

const plantPhaseAssetPaths: Partial<Record<GardenPlantId, Partial<Record<GardenPlotPhase, string>>>> = {
  bloodleaf: {
    growing: `${GARDEN_ASSET_BASE_PATH}/bloodleaf/bloodleaf_growing.png`,
    pre_bloom: `${GARDEN_ASSET_BASE_PATH}/bloodleaf/bloodleaf_grown.png`,
    bloom: `${GARDEN_ASSET_BASE_PATH}/bloodleaf/bloodleaf_blooming.png`,
    post_bloom: `${GARDEN_ASSET_BASE_PATH}/bloodleaf/bloodleaf_grown.png`,
    wilted: `${GARDEN_ASSET_BASE_PATH}/bloodleaf/bloodleaf_wilted.png`
  },
  fenroot: {
    growing: `${GARDEN_ASSET_BASE_PATH}/fenroot/fenroot_growing.png`,
    pre_bloom: `${GARDEN_ASSET_BASE_PATH}/fenroot/fenroot_grown.png`,
    bloom: `${GARDEN_ASSET_BASE_PATH}/fenroot/fenroot_blooming.png`,
    post_bloom: `${GARDEN_ASSET_BASE_PATH}/fenroot/fenroot_grown.png`,
    wilted: `${GARDEN_ASSET_BASE_PATH}/fenroot/fenroot_wilted.png`
  },
  ironbloom: {
    growing: `${GARDEN_ASSET_BASE_PATH}/ironbloom/ironbloom_growing.png`,
    pre_bloom: `${GARDEN_ASSET_BASE_PATH}/ironbloom/ironbloom_grown.png`,
    bloom: `${GARDEN_ASSET_BASE_PATH}/ironbloom/ironbloom_blooming.png`,
    post_bloom: `${GARDEN_ASSET_BASE_PATH}/ironbloom/ironbloom_grown.png`,
    wilted: `${GARDEN_ASSET_BASE_PATH}/ironbloom/ironbloom_wilted.png`
  }
};

const seedAssetPaths: Partial<Record<GardenPlantId, string>> = {
  bloodleaf: `${GARDEN_ASSET_BASE_PATH}/bloodleaf/bloodleaf_seed.png`,
  fenroot: `${GARDEN_ASSET_BASE_PATH}/fenroot/fenroot_seed.png`,
  ironbloom: `${GARDEN_ASSET_BASE_PATH}/ironbloom/ironbloom_seed.png`
};

export function getGardenPlantImagePath(plantId: GardenPlantId | null, phase: GardenPlotPhase): string | null {
  if (!plantId || phase === "empty") {
    return null;
  }

  return plantPhaseAssetPaths[plantId]?.[phase] ?? null;
}

export function getGardenSeedImagePath(plantId: GardenPlantId): string | null {
  return seedAssetPaths[plantId] ?? null;
}
