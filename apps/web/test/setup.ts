import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  });
}

if (!window.ResizeObserver) {
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  });
}

if (!window.Image.prototype.decode) {
  Object.defineProperty(window.Image.prototype, "decode", {
    configurable: true,
    writable: true,
    value() {
      return Promise.resolve();
    }
  });
}

const originalImageSrcDescriptor =
  Object.getOwnPropertyDescriptor(window.Image.prototype, "src") ??
  Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");

if (originalImageSrcDescriptor?.configurable) {
  Object.defineProperty(window.Image.prototype, "src", {
    configurable: true,
    enumerable: originalImageSrcDescriptor.enumerable ?? true,
    get() {
      return originalImageSrcDescriptor.get?.call(this) ?? "";
    },
    set(value: string) {
      originalImageSrcDescriptor.set?.call(this, value);
      queueMicrotask(() => {
        this.onload?.(new Event("load") as unknown as Event);
      });
    }
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});
