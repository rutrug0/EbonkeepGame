import type { CSSProperties } from "react";

export type ViewBackgroundName =
  | "arena"
  | "auction_house"
  | "contracts"
  | "forge"
  | "garden"
  | "imperial_shop"
  | "inventory"
  | "jobs"
  | "leaderboard"
  | "merchant"
  | "refinery";

export function getViewBackgroundStyle(name: ViewBackgroundName): CSSProperties {
  return {
    "--indoor-scene-image": `url("/assets/backgrounds/${name}.png"), url("/assets/backgrounds/${name}.jpg")`
  } as CSSProperties;
}
