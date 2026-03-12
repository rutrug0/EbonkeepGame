/**
 * Portrait pool — all available player avatar portraits, split by stat tree.
 *
 * HOW TO ADD PORTRAITS:
 *   1. Place image files in  apps/web/public/assets/portraits/{strength|dexterity|intelligence}/
 *      Naming convention: portrait_str_01.png … portrait_str_10.png  (str/dex/int prefix)
 *   2. The PORTRAIT_POOL_BY_TREE entries below map directly to those paths.
 */
import type { PlayerStatTree } from "@ebonkeep/shared/core";

export interface PortraitEntry {
  id: string;
  path: string;
}

export const PORTRAIT_POOL_BY_TREE: Record<PlayerStatTree, PortraitEntry[]> = {
  strength: [
    { id: "str_01", path: "/assets/portraits/strength/portrait_str_01_p.png" },
    { id: "str_02", path: "/assets/portraits/strength/portrait_str_02_p.png" },
    { id: "str_03", path: "/assets/portraits/strength/portrait_str_03_p.png" },
    { id: "str_04", path: "/assets/portraits/strength/portrait_str_04_p.png" },
    { id: "str_05", path: "/assets/portraits/strength/portrait_str_05_p.png" },
    { id: "str_06", path: "/assets/portraits/strength/portrait_str_06_p.png" },
    { id: "str_07", path: "/assets/portraits/strength/portrait_str_07_p.png" },
    { id: "str_08", path: "/assets/portraits/strength/portrait_str_08_p.png" },
    { id: "str_09", path: "/assets/portraits/strength/portrait_str_09_p.png" },
    { id: "str_10", path: "/assets/portraits/strength/portrait_str_10_p.png" },
  ],
  dexterity: [
    { id: "dex_01", path: "/assets/portraits/dexterity/portrait_dex_01_p.png" },
    { id: "dex_02", path: "/assets/portraits/dexterity/portrait_dex_02_p.png" },
    { id: "dex_03", path: "/assets/portraits/dexterity/portrait_dex_03_p.png" },
    { id: "dex_04", path: "/assets/portraits/dexterity/portrait_dex_04_p.png" },
    { id: "dex_05", path: "/assets/portraits/dexterity/portrait_dex_05_p.png" },
    { id: "dex_06", path: "/assets/portraits/dexterity/portrait_dex_06_p.png" },
    { id: "dex_07", path: "/assets/portraits/dexterity/portrait_dex_07_p.png" },
    { id: "dex_08", path: "/assets/portraits/dexterity/portrait_dex_08_p.png" },
    { id: "dex_09", path: "/assets/portraits/dexterity/portrait_dex_09_p.png" },
    { id: "dex_10", path: "/assets/portraits/dexterity/portrait_dex_10_p.png" },
  ],
  intelligence: [
    { id: "int_01", path: "/assets/portraits/intelligence/portrait_int_01_p.png" },
    { id: "int_02", path: "/assets/portraits/intelligence/portrait_int_02_p.png" },
    { id: "int_03", path: "/assets/portraits/intelligence/portrait_int_03_p.png" },
    { id: "int_04", path: "/assets/portraits/intelligence/portrait_int_04_p.png" },
    { id: "int_05", path: "/assets/portraits/intelligence/portrait_int_05_p.png" },
    { id: "int_06", path: "/assets/portraits/intelligence/portrait_int_06_p.png" },
    { id: "int_07", path: "/assets/portraits/intelligence/portrait_int_07_p.png" },
    { id: "int_08", path: "/assets/portraits/intelligence/portrait_int_08_p.png" },
    { id: "int_09", path: "/assets/portraits/intelligence/portrait_int_09_p.png" },
    { id: "int_10", path: "/assets/portraits/intelligence/portrait_int_10_p.png" },
  ],
};

/** Flat list of all portraits across all trees — used for path lookup by id. */
export const PORTRAIT_POOL: PortraitEntry[] = [
  ...PORTRAIT_POOL_BY_TREE.strength,
  ...PORTRAIT_POOL_BY_TREE.dexterity,
  ...PORTRAIT_POOL_BY_TREE.intelligence,
];

export function getPortraitPath(portraitId: string): string {
  return PORTRAIT_POOL.find((p) => p.id === portraitId)?.path ?? PORTRAIT_POOL[0]!.path;
}

export function getDefaultPortraitId(tree: PlayerStatTree): string {
  return PORTRAIT_POOL_BY_TREE[tree][0]!.id;
}

export const DEFAULT_PORTRAIT_ID = PORTRAIT_POOL_BY_TREE.strength[0]!.id;

// ─── Backgrounds ──────────────────────────────────────────────────────────────

export interface BackgroundEntry {
  id: string;
  path: string;
}

/**
 * Portrait backgrounds — 5 scenes the player can pick.
 * Place images in:  apps/web/public/assets/portraits/backgrounds/bg_01.jpg … bg_05.jpg
 */
export const BACKGROUND_POOL: BackgroundEntry[] = [
  { id: "bg_01", path: "/assets/portraits/backgrounds/bg_01_p.jpg" },
  { id: "bg_02", path: "/assets/portraits/backgrounds/bg_02_p.jpg" },
  { id: "bg_03", path: "/assets/portraits/backgrounds/bg_03_p.jpg" },
  { id: "bg_04", path: "/assets/portraits/backgrounds/bg_04_p.jpg" },
  { id: "bg_05", path: "/assets/portraits/backgrounds/bg_05_p.jpg" },
];

export function getBackgroundPath(backgroundId: string): string {
  return BACKGROUND_POOL.find((b) => b.id === backgroundId)?.path ?? BACKGROUND_POOL[0]!.path;
}

export const DEFAULT_BACKGROUND_ID = "bg_01";

