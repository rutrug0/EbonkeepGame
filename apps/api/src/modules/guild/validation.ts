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
 * Validate guild crest configuration
 * Ensures all crest parts are from the valid asset pool
 */
export function validateGuildCrest(crest: {
  bgShape: string;
  bgColor: string;
  bgPattern?: string | null;
  fgSymbol: string;
  fgColor: string;
  frame?: string | null;
}): ValidationResult {
  // Valid background shapes
  const VALID_BG_SHAPES = [
    "shield_01",
    "shield_02",
    "shield_03",
    "banner_01",
    "banner_02",
    "circle_01"
  ];

  // Valid symbols
  const VALID_SYMBOLS = [
    "sword_01",
    "axe_01",
    "bow_01",
    "dragon_01",
    "wolf_01",
    "eagle_01",
    "castle_01",
    "tower_01"
  ];

  // Valid colors
  const VALID_BG_COLORS = [
    "crimson",
    "forest",
    "sapphire",
    "obsidian",
    "ivory",
    "gold",
    "iron"
  ];

  const VALID_FG_COLORS = ["gold", "silver", "ivory", "obsidian", "crimson"];

  // Valid patterns (optional)
  const VALID_PATTERNS = ["stripes", "checkered", "embossed"];

  // Valid frames (optional)
  const VALID_FRAMES = ["ornate_01", "simple_01", "thorns_01"];

  // Validate background shape
  if (!VALID_BG_SHAPES.includes(crest.bgShape)) {
    return {
      valid: false,
      error: "CREST_INVALID_BG_SHAPE"
    };
  }

  // Validate background color
  if (!VALID_BG_COLORS.includes(crest.bgColor)) {
    return {
      valid: false,
      error: "CREST_INVALID_BG_COLOR"
    };
  }

  // Validate pattern if provided
  if (crest.bgPattern && !VALID_PATTERNS.includes(crest.bgPattern)) {
    return {
      valid: false,
      error: "CREST_INVALID_PATTERN"
    };
  }

  // Validate foreground symbol
  if (!VALID_SYMBOLS.includes(crest.fgSymbol)) {
    return {
      valid: false,
      error: "CREST_INVALID_SYMBOL"
    };
  }

  // Validate foreground color
  if (!VALID_FG_COLORS.includes(crest.fgColor)) {
    return {
      valid: false,
      error: "CREST_INVALID_FG_COLOR"
    };
  }

  // Validate frame if provided
  if (crest.frame && !VALID_FRAMES.includes(crest.frame)) {
    return {
      valid: false,
      error: "CREST_INVALID_FRAME"
    };
  }

  // Prevent low-contrast combinations
  if (crest.bgColor === crest.fgColor) {
    return {
      valid: false,
      error: "CREST_LOW_CONTRAST"
    };
  }

  // Specific low-contrast combinations
  const BAD_COMBOS = [
    { bg: "ivory", fg: "silver" },
    { bg: "obsidian", fg: "obsidian" }
  ];

  for (const combo of BAD_COMBOS) {
    if (crest.bgColor === combo.bg && crest.fgColor === combo.fg) {
      return {
        valid: false,
        error: "CREST_LOW_CONTRAST"
      };
    }
  }

  return { valid: true };
}

/**
 * Export valid asset lists for frontend use
 */
export const VALID_CREST_ASSETS = {
  bgShapes: [
    "shield_01",
    "shield_02",
    "shield_03",
    "banner_01",
    "banner_02",
    "circle_01"
  ],
  symbols: [
    "sword_01",
    "axe_01",
    "bow_01",
    "dragon_01",
    "wolf_01",
    "eagle_01",
    "castle_01",
    "tower_01"
  ],
  bgColors: ["crimson", "forest", "sapphire", "obsidian", "ivory", "gold", "iron"],
  fgColors: ["gold", "silver", "ivory", "obsidian", "crimson"],
  patterns: ["stripes", "checkered", "embossed"],
  frames: ["ornate_01", "simple_01", "thorns_01"]
};
