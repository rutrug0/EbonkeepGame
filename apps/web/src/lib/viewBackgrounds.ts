import type { CSSProperties } from "react";

export type ViewBackgroundName =
  | "arena"
  | "auction_house"
  | "character"
  | "contracts"
  | "forge"
  | "garden"
  | "imperial_shop"
  | "inventory"
  | "jobs"
  | "leaderboard"
  | "merchant"
  | "refinery";

function createViewBackgroundAssetPaths(name: ViewBackgroundName): string[] {
  return [`/assets/backgrounds/${name}.png`, `/assets/backgrounds/${name}.jpg`];
}

export function getViewBackgroundStyle(name: ViewBackgroundName): CSSProperties {
  return {
    "--indoor-scene-image": createViewBackgroundAssetPaths(name).map((path) => `url("${path}")`).join(", ")
  } as CSSProperties;
}

export function getViewBackgroundAssetPaths(name: ViewBackgroundName): string[] {
  return createViewBackgroundAssetPaths(name);
}

export async function preloadImageAssets(paths: readonly string[]): Promise<void> {
  const uniquePaths = [...new Set(paths.filter((path) => path.length > 0))];

  await Promise.all(
    uniquePaths.map(
      (path) =>
        new Promise<void>((resolve) => {
          const image = new Image();

          const finalize = () => {
            image.onload = null;
            image.onerror = null;
            resolve();
          };

          image.onload = finalize;
          image.onerror = finalize;
          image.src = path;

          if (typeof image.decode === "function") {
            void image.decode().then(finalize).catch(() => {
              // Keep the preload non-blocking; load/error handlers will settle the promise.
            });
          }
        })
    )
  );
}
