import { CRAFTING_AFFINITIES, getCraftingTierForLevel } from "@ebonkeep/shared/crafting";

export type MaterialDrop = {
  itemCode: string;
  quantity: number;
};

export function rollMaterialDrops(
  playerLevel: number,
  rng: () => number = Math.random
): MaterialDrop[] {
  const tier = getCraftingTierForLevel(playerLevel);
  const drops: MaterialDrop[] = [];

  if (rng() < 0.35) {
    const affinity = CRAFTING_AFFINITIES[Math.floor(rng() * CRAFTING_AFFINITIES.length)] ?? "metal";
    drops.push({
      itemCode: `mat_${tier}_${affinity}_common`,
      quantity: 1
    });
  }

  if (rng() < 0.10) {
    const affinity = CRAFTING_AFFINITIES[Math.floor(rng() * CRAFTING_AFFINITIES.length)] ?? "metal";
    drops.push({
      itemCode: `mat_${tier}_${affinity}_uncommon`,
      quantity: 1
    });
  }

  return drops;
}
