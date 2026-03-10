import { describe, expect, it } from "vitest";

import {
  validateGuildCrestId,
  validateGuildDescription,
  validateGuildName,
  validateGuildTag
} from "../../src/modules/guild/validation.js";

describe("guild validation", () => {
  it("accepts and rejects guild names correctly", () => {
    expect(validateGuildName("Ashen Guard")).toEqual({ valid: true });
    expect(validateGuildName("ad")).toEqual({ valid: false, error: "NAME_LENGTH_INVALID" });
    expect(validateGuildName("Admin Legion")).toEqual({ valid: false, error: "NAME_RESERVED" });
  });

  it("validates guild tags and descriptions", () => {
    expect(validateGuildTag("ASH")).toEqual({ valid: true });
    expect(validateGuildTag("ash")).toEqual({ valid: false, error: "TAG_FORMAT_INVALID" });
    expect(validateGuildDescription("A calm guild description")).toEqual({ valid: true });
    expect(validateGuildDescription("shit fuck crap bastard")).toEqual({
      valid: false,
      error: "DESCRIPTION_EXCESSIVE_PROFANITY"
    });
  });

  it("checks crest identifiers against the catalog", () => {
    expect(validateGuildCrestId("crest_0")).toEqual({ valid: true });
    expect(validateGuildCrestId("missing_crest")).toEqual({ valid: false, error: "INVALID_CREST_ID" });
  });
});
