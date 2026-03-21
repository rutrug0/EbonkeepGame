import { afterEach, describe, expect, it } from "vitest";

import { getViewBackgroundAssetPaths, preloadImageAssets } from "../src/lib/viewBackgrounds";

const originalSrcDescriptor = Object.getOwnPropertyDescriptor(window.Image.prototype, "src");
const originalDecode = window.Image.prototype.decode;

afterEach(() => {
  if (originalSrcDescriptor) {
    Object.defineProperty(window.Image.prototype, "src", originalSrcDescriptor);
  }
  if (originalDecode) {
    Object.defineProperty(window.Image.prototype, "decode", {
      configurable: true,
      writable: true,
      value: originalDecode
    });
  }
});

describe("view background preloading", () => {
  it("preloads the known background asset candidates", () => {
    expect(getViewBackgroundAssetPaths("forge")).toEqual([
      "/assets/backgrounds/forge.png",
      "/assets/backgrounds/forge.jpg"
    ]);
  });

  it("resolves when image decode succeeds", async () => {
    await expect(preloadImageAssets(["/assets/backgrounds/merchant.png"])).resolves.toBeUndefined();
  });

  it("falls back to load or error events when decode fails", async () => {
    Object.defineProperty(window.Image.prototype, "decode", {
      configurable: true,
      writable: true,
      value() {
        return Promise.reject(new Error("decode failed"));
      }
    });

    if (originalSrcDescriptor) {
      Object.defineProperty(window.Image.prototype, "src", {
        configurable: true,
        enumerable: originalSrcDescriptor.enumerable ?? true,
        get() {
          return originalSrcDescriptor.get?.call(this) ?? "";
        },
        set(value: string) {
          originalSrcDescriptor.set?.call(this, value);
          queueMicrotask(() => {
            this.onerror?.(new Event("error") as unknown as Event);
          });
        }
      });
    }

    await expect(preloadImageAssets(["/assets/backgrounds/merchant.jpg"])).resolves.toBeUndefined();
  });
});
