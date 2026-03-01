import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type WeaponRarity = "common" | "uncommon" | "rare" | "epic";
type AffixTier = "T1" | "T2" | "T3";
type AffixUnit = "flat" | "basis_points";

type DevWeaponAffix = {
  source: "prefix" | "suffix";
  name: string;
  tier: AffixTier;
  stat: string;
  value: number;
  unit: AffixUnit;
};

export type DevMeleeWeapon = {
  displayName: string;
  displayLine: string;
  rarity: WeaponRarity;
  level: number;
  minDamage: number;
  maxDamage: number;
  affixSummary: string;
  affixes: DevWeaponAffix[];
};

type NameRow = {
  weaponName: string;
  dropMin: number;
  dropMax: number;
};

type DamageRow = {
  ilvl: number;
  rarity: WeaponRarity;
  minLow: number;
  minHigh: number;
  maxLow: number;
  maxHigh: number;
};

type AffixScalingRow = {
  level: number;
  scaleKey: string;
  tier: AffixTier;
  rollMin: number;
  rollMax: number;
  unit: AffixUnit;
};

type AffixFamily = {
  statKey: string;
  scaleKey: string;
  prefixes: Record<AffixTier, string>;
  suffixes: Record<AffixTier, string>;
};

const WEAPON_COUNT = 50;
const MAX_LEVEL = 100;

const AFFIX_FAMILIES: AffixFamily[] = [
  {
    statKey: "melee_damage",
    scaleKey: "damage_primary",
    prefixes: {
      T1: "Forceful",
      T2: "Brutal",
      T3: "Worldrend"
    },
    suffixes: {
      T1: "of Striking",
      T2: "of Cleaving",
      T3: "of the Warbringer"
    }
  },
  {
    statKey: "crit_damage",
    scaleKey: "crit_damage",
    prefixes: {
      T1: "Punishing",
      T2: "Devastating",
      T3: "Doom-marked"
    },
    suffixes: {
      T1: "of Impact",
      T2: "of Ruin",
      T3: "of Final Judgment"
    }
  },
  {
    statKey: "extra_attack_chance",
    scaleKey: "double_attack_chance",
    prefixes: {
      T1: "Opportunistic",
      T2: "Relentless",
      T3: "Frenzied"
    },
    suffixes: {
      T1: "of Momentum",
      T2: "of the Second Strike",
      T3: "of Endless Assault"
    }
  }
];

function resolveDataPath(fileName: string): string {
  const fromRepoRoot = resolve(process.cwd(), "docs", "data", fileName);
  if (existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }
  return resolve(process.cwd(), "..", "..", "docs", "data", fileName);
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseCsv(fileName: string): Record<string, string>[] {
  const raw = readFileSync(resolveDataPath(fileName), "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(",").map(stripQuotes);
  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(1)) {
    const cells = line.split(",").map(stripQuotes);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = cells[i] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function toInt(value: string): number {
  return Number.parseInt(value, 10);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(values: T[]): T {
  return values[randomInt(0, values.length - 1)];
}

function rollRarity(): WeaponRarity {
  const roll = Math.random();
  if (roll < 0.45) {
    return "common";
  }
  if (roll < 0.75) {
    return "uncommon";
  }
  if (roll < 0.93) {
    return "rare";
  }
  return "epic";
}

function rollTier(): AffixTier {
  const roll = Math.random();
  if (roll < 0.6) {
    return "T1";
  }
  if (roll < 0.9) {
    return "T2";
  }
  return "T3";
}

function formatAffixValue(value: number, unit: AffixUnit): string {
  if (unit === "basis_points") {
    return `${(value / 100).toFixed(2)}%`;
  }
  return value.toString();
}

function buildNameRows(): NameRow[] {
  return parseCsv("warrior_melee_weapon_name_ranges_v2.csv").map((row) => ({
    weaponName: row.weapon_name,
    dropMin: toInt(row.drop_min_level),
    dropMax: toInt(row.drop_max_level_capped)
  }));
}

function buildDamageRows(): Map<string, DamageRow> {
  const rows = parseCsv("warrior_melee_weapon_ilvl_scaling_v2.csv").map((row) => {
    const rarity = row.rarity as WeaponRarity;
    return {
      ilvl: toInt(row.ilvl),
      rarity,
      minLow: toInt(row.item_roll_min_low),
      minHigh: toInt(row.item_roll_min_high),
      maxLow: toInt(row.item_roll_max_low),
      maxHigh: toInt(row.item_roll_max_high)
    } satisfies DamageRow;
  });

  const lookup = new Map<string, DamageRow>();
  for (const row of rows) {
    lookup.set(`${row.ilvl}:${row.rarity}`, row);
  }
  return lookup;
}

function buildAffixScalingRows(): Map<string, AffixScalingRow> {
  const rows = parseCsv("affix_scaling_level_1_100.csv").map((row) => ({
    level: toInt(row.level),
    scaleKey: row.scale_key,
    tier: row.tier as AffixTier,
    rollMin: toInt(row.roll_min),
    rollMax: toInt(row.roll_max),
    unit: row.unit as AffixUnit
  }));

  const lookup = new Map<string, AffixScalingRow>();
  for (const row of rows) {
    lookup.set(`${row.level}:${row.scaleKey}:${row.tier}`, row);
  }
  return lookup;
}

const nameRows = buildNameRows();
const damageRows = buildDamageRows();
const affixRows = buildAffixScalingRows();

function rollAffix(level: number, source: "prefix" | "suffix"): DevWeaponAffix {
  const family = pickOne(AFFIX_FAMILIES);
  const tier = rollTier();
  const scaling = affixRows.get(`${level}:${family.scaleKey}:${tier}`);
  if (!scaling) {
    return {
      source,
      name: source === "prefix" ? family.prefixes[tier] : family.suffixes[tier],
      tier,
      stat: family.statKey,
      value: 0,
      unit: "flat"
    };
  }

  return {
    source,
    name: source === "prefix" ? family.prefixes[tier] : family.suffixes[tier],
    tier,
    stat: family.statKey,
    value: randomInt(scaling.rollMin, scaling.rollMax),
    unit: scaling.unit
  };
}

function buildAffixSummary(affixes: DevWeaponAffix[]): string {
  if (affixes.length === 0) {
    return "No affixes";
  }
  return affixes
    .map(
      (affix) =>
        `${affix.source} ${affix.name} (${affix.tier}): +${formatAffixValue(
          affix.value,
          affix.unit
        )} ${affix.stat}`
    )
    .join(" | ");
}

function generateOneWeapon(): DevMeleeWeapon {
  const rarity = rollRarity();
  const level = randomInt(1, MAX_LEVEL);

  const candidates = nameRows.filter((row) => level >= row.dropMin && level <= row.dropMax);
  const baseName = candidates.length > 0 ? pickOne(candidates).weaponName : pickOne(nameRows).weaponName;

  const damageRow = damageRows.get(`${level}:${rarity}`) ?? damageRows.get(`1:${rarity}`);
  const minDamage = damageRow ? randomInt(damageRow.minLow, damageRow.minHigh) : 1;
  const rolledMax = damageRow ? randomInt(damageRow.maxLow, damageRow.maxHigh) : minDamage + 1;
  const maxDamage = Math.max(minDamage, rolledMax);

  const affixes: DevWeaponAffix[] = [];
  if (rarity === "uncommon") {
    affixes.push(rollAffix(level, Math.random() < 0.5 ? "prefix" : "suffix"));
  } else if (rarity === "rare" || rarity === "epic") {
    affixes.push(rollAffix(level, "prefix"));
    affixes.push(rollAffix(level, "suffix"));
  }

  const prefix = affixes.find((affix) => affix.source === "prefix");
  const suffix = affixes.find((affix) => affix.source === "suffix");
  const nameWithPrefix = prefix ? `${prefix.name} ${baseName}` : baseName;
  const displayName = suffix ? `${nameWithPrefix} ${suffix.name}` : nameWithPrefix;

  const affixSummary = buildAffixSummary(affixes);
  return {
    displayName,
    displayLine: `${displayName} | Level ${level} [${minDamage}-${maxDamage}] | ${affixSummary}`,
    rarity,
    level,
    minDamage,
    maxDamage,
    affixSummary,
    affixes
  };
}

function generateStartupDevMeleeWeapons(): DevMeleeWeapon[] {
  return Array.from({ length: WEAPON_COUNT }, () => generateOneWeapon());
}

const startupDevMeleeWeapons = generateStartupDevMeleeWeapons();

export function getStartupDevMeleeWeapons(): DevMeleeWeapon[] {
  return startupDevMeleeWeapons;
}
