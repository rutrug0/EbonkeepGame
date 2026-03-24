import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GUILD_CREST_CATALOG } from "../src/guild-crests.js";

describe("guild crest catalog", () => {
  it("matches the shipped crest asset set", () => {
    const crestAssetDir = resolve(__dirname, "../../../apps/web/public/assets/items/generated/guild");
    const assetIds = readdirSync(crestAssetDir)
      .filter((fileName) => /^crest_\d+\.png$/.test(fileName))
      .map((fileName) => fileName.replace(/\.png$/, ""))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    const catalogIds = GUILD_CREST_CATALOG.map((crest) => crest.id);

    expect(catalogIds).toEqual(assetIds);
  });
});
