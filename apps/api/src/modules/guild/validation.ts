import { availableGuildCrestIds } from "@ebonkeep/shared";
import type { GuildCrestId } from "@ebonkeep/shared";

/**
 * Guild validation utilities
 * Validates guild names, tags, and crest configurations
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Basic profanity list (should be expanded in production)
const PROFANITY_LIST = [
  "damn",
  "hell",
  "crap",
  "shit",
  "fuck",
  "bitch",
  "ass",
  "bastard",
  "dick",
  "cock",
  "pussy",
  "nigger",
  "nigga",
  "fag",
  "faggot",
  "retard",
  "rape",
  "nazi",
  "hitler"
];

// Reserved words that cannot be used in guild names
const RESERVED_NAMES = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "system",
  "official",
  "ebonkeep",
  "support",
  "staff",
  "gm",
  "gamemaster"
];

/**
 * Validate guild name
 * Requirements:
 * - 3-32 characters
 * - Letters, spaces, and apostrophes only
 * - No profanity
 * - Not a reserved name
 */
export function validateGuildName(name: string): ValidationResult {
  // Trim whitespace
  const trimmed = name.trim();

  // Length check
  if (trimmed.length < 3 || trimmed.length > 32) {
    return {
      valid: false,
      error: "NAME_LENGTH_INVALID"
    };
  }

  // Character whitelist (letters, spaces, apostrophes)
  if (!/^[a-zA-Z\s']+$/.test(trimmed)) {
    return {
      valid: false,
      error: "NAME_CHARACTERS_INVALID"
    };
  }

  // No multiple consecutive spaces
  if (/\s{2,}/.test(trimmed)) {
    return {
      valid: false,
      error: "NAME_MULTIPLE_SPACES"
    };
  }

  // Cannot start or end with space or apostrophe
  if (/^[\s']|[\s']$/.test(trimmed)) {
    return {
      valid: false,
      error: "NAME_INVALID_START_END"
    };
  }

  // Profanity check
  const lowerName = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  for (const word of PROFANITY_LIST) {
    if (lowerName.includes(word)) {
      return {
        valid: false,
        error: "NAME_PROFANITY_DETECTED"
      };
    }
  }

  // Reserved names check
  const lowerTrimmed = trimmed.toLowerCase();
  for (const reserved of RESERVED_NAMES) {
    if (lowerTrimmed.includes(reserved)) {
      return {
        valid: false,
        error: "NAME_RESERVED"
      };
    }
  }

  return { valid: true };
}

/**
 * Validate guild tag
 * Requirements:
 * - 2-6 uppercase letters only
 * - No profanity
 * - Not a reserved tag
 */
export function validateGuildTag(tag: string): ValidationResult {
  // Must be 2-6 uppercase letters only
  if (!/^[A-Z]{2,6}$/.test(tag)) {
    return {
      valid: false,
      error: "TAG_FORMAT_INVALID"
    };
  }

  // Profanity check
  const lowerTag = tag.toLowerCase();
  for (const word of PROFANITY_LIST) {
    if (lowerTag.includes(word)) {
      return {
        valid: false,
        error: "TAG_PROFANITY_DETECTED"
      };
    }
  }

  // Reserved tags
  const RESERVED_TAGS = ["ADMIN", "MOD", "GM", "DEV", "STAFF", "SYS"];
  if (RESERVED_TAGS.includes(tag)) {
    return {
      valid: false,
      error: "TAG_RESERVED"
    };
  }

  return { valid: true };
}

/**
 * Validate guild description
 * Requirements:
 * - 0-500 characters
 * - No excessive profanity
 */
export function validateGuildDescription(description: string): ValidationResult {
  if (description.length > 500) {
    return {
      valid: false,
      error: "DESCRIPTION_TOO_LONG"
    };
  }

  // Basic profanity check (more lenient than name/tag)
  const lowerDesc = description.toLowerCase();
  let profanityCount = 0;
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = lowerDesc.match(regex);
    if (matches) {
      profanityCount += matches.length;
    }
  }

  // Allow some profanity in description but not excessive
  if (profanityCount > 3) {
    return {
      valid: false,
      error: "DESCRIPTION_EXCESSIVE_PROFANITY"
    };
  }

  return { valid: true };
}

/**
 * Normalize guild crest ids from persistence into the shared contract type.
 */
export function normalizeGuildCrestId(crestId: string | null | undefined): GuildCrestId | null {
  if (typeof crestId !== "string") {
    return null;
  }

  if (!availableGuildCrestIds.includes(crestId as (typeof availableGuildCrestIds)[number])) {
    return null;
  }

  return crestId as GuildCrestId;
}

/**
 * Validate guild crest selection
 * Ensures the crest id resolves to an available generated crest image.
 */
export function validateGuildCrestId(crestId: string | null | undefined): ValidationResult {
  if (!normalizeGuildCrestId(crestId)) {
    return {
      valid: false,
      error: "CREST_INVALID_ID"
    };
  }

  return { valid: true };
}

export const VALID_GUILD_CREST_IDS = availableGuildCrestIds;
