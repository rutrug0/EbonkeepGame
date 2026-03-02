import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PlayerClass } from "@ebonkeep/shared";

type WeaponRarity = "common" | "uncommon" | "rare" | "epic";
type AffixTier = "T1" | "T2" | "T3";
type AffixUnit = "flat" | "basis_points";
type WeaponFamilyKey = "melee" | "ranged" | "arcane";
type DamageCategory = "strength" | "agility" | "intelligence";

type DevWeaponAffix = {
  source: "prefix" | "suffix";
  name: string;
  tier: AffixTier;
  stat: string;
  value: number;
  unit: AffixUnit;
};

export type DevWeapon = {
  displayName: string;
  displayLine: string;
  rarity: WeaponRarity;
  level: number;
  weaponFamily: WeaponFamilyKey;
  allowedClass: PlayerClass;
  minDamage: number;
  maxDamage: number;
  affixSummary: string;
  affixes: DevWeaponAffix[];
  flavorText: string;
};

type NameRow = {
  weaponName: string;
  weaponType: string;
  weaponFamily: WeaponFamilyKey;
  allowedClass: PlayerClass;
  damageCategory: DamageCategory;
  flavorText: string;
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

type WeaponDataset = {
  weaponFamily: WeaponFamilyKey;
  allowedClass: PlayerClass;
  damageCategory: DamageCategory;
  namesFile: string;
  damageFile: string;
};

const WEAPON_COUNT = 50;
const MAX_LEVEL = 100;
const WEAPON_FAMILIES: readonly WeaponFamilyKey[] = ["melee", "ranged", "arcane"];
const PLAYER_CLASSES: readonly PlayerClass[] = ["warrior", "ranger", "mage"];
const DAMAGE_CATEGORIES: readonly DamageCategory[] = ["strength", "agility", "intelligence"];
const WEAPON_RARITIES: readonly WeaponRarity[] = ["common", "uncommon", "rare", "epic"];

const WEAPON_DATASETS: readonly WeaponDataset[] = [
  {
    weaponFamily: "melee",
    allowedClass: "warrior",
    damageCategory: "strength",
    namesFile: "warrior_melee_weapon_name_ranges_v4.csv",
    damageFile: "warrior_melee_weapon_ilvl_scaling_v2.csv"
  },
  {
    weaponFamily: "ranged",
    allowedClass: "ranger",
    damageCategory: "agility",
    namesFile: "ranger_ranged_weapon_name_ranges_v3.csv",
    damageFile: "ranger_ranged_weapon_ilvl_scaling_v1.csv"
  },
  {
    weaponFamily: "arcane",
    allowedClass: "mage",
    damageCategory: "intelligence",
    namesFile: "mage_arcane_weapon_name_ranges_v3.csv",
    damageFile: "mage_arcane_weapon_ilvl_scaling_v1.csv"
  }
];

const AFFIX_FAMILIES: Record<WeaponFamilyKey, readonly AffixFamily[]> = {
  melee: [
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
  ],
  ranged: [
    {
      statKey: "ranged_damage",
      scaleKey: "damage_primary",
      prefixes: {
        T1: "Keen",
        T2: "Deadeye",
        T3: "Voidfletched"
      },
      suffixes: {
        T1: "of Aim",
        T2: "of Piercing",
        T3: "of the Eclipse Hunt"
      }
    },
    {
      statKey: "crit_chance",
      scaleKey: "crit_chance",
      prefixes: {
        T1: "Steady",
        T2: "Hawkeye",
        T3: "Nightstalking"
      },
      suffixes: {
        T1: "of Precision",
        T2: "of Trueflight",
        T3: "of the Last Quarry"
      }
    },
    {
      statKey: "extra_attack_chance",
      scaleKey: "double_attack_chance",
      prefixes: {
        T1: "Quickdraw",
        T2: "Rapidfire",
        T3: "Tempest-shod"
      },
      suffixes: {
        T1: "of Volley",
        T2: "of Split Flight",
        T3: "of the Many Arrows"
      }
    }
  ],
  arcane: [
    {
      statKey: "spell_damage",
      scaleKey: "damage_primary",
      prefixes: {
        T1: "Focused",
        T2: "Runed",
        T3: "Cataclysmic"
      },
      suffixes: {
        T1: "of Sparks",
        T2: "of Convergence",
        T3: "of the Black Star"
      }
    },
    {
      statKey: "crit_damage",
      scaleKey: "crit_damage",
      prefixes: {
        T1: "Piercing",
        T2: "Astral",
        T3: "Void-crowned"
      },
      suffixes: {
        T1: "of Rupture",
        T2: "of Astral Fracture",
        T3: "of Total Unmaking"
      }
    },
    {
      statKey: "extra_attack_chance",
      scaleKey: "double_attack_chance",
      prefixes: {
        T1: "Swiftcast",
        T2: "Riftbound",
        T3: "Epoch-shifted"
      },
      suffixes: {
        T1: "of Echoes",
        T2: "of the Twin Sigil",
        T3: "of Endless Invocation"
      }
    }
  ]
};

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

function isWeaponFamily(value: string): value is WeaponFamilyKey {
  return WEAPON_FAMILIES.includes(value as WeaponFamilyKey);
}

function isPlayerClass(value: string): value is PlayerClass {
  return PLAYER_CLASSES.includes(value as PlayerClass);
}

function isDamageCategory(value: string): value is DamageCategory {
  return DAMAGE_CATEGORIES.includes(value as DamageCategory);
}

function isWeaponRarity(value: string): value is WeaponRarity {
  return WEAPON_RARITIES.includes(value as WeaponRarity);
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
  const rows: NameRow[] = [];
  for (const dataset of WEAPON_DATASETS) {
    const sourceRows = parseCsv(dataset.namesFile);
    for (const row of sourceRows) {
      const weaponFamily = isWeaponFamily(row.weapon_family) ? row.weapon_family : dataset.weaponFamily;
      const allowedClass = isPlayerClass(row.allowed_class) ? row.allowed_class : dataset.allowedClass;
      const damageCategory = isDamageCategory(row.damage_category)
        ? row.damage_category
        : dataset.damageCategory;
      rows.push({
        weaponName: row.weapon_name,
        weaponType: row.weapon_type,
        weaponFamily,
        allowedClass,
        damageCategory,
        flavorText: row.flavor_text,
        dropMin: toInt(row.drop_min_level),
        dropMax: toInt(row.drop_max_level_capped)
      });
    }
  }
  return rows;
}

function buildDamageRows(): Map<string, DamageRow> {
  const lookup = new Map<string, DamageRow>();
  for (const dataset of WEAPON_DATASETS) {
    const rows = parseCsv(dataset.damageFile).map((row) => {
      const rarity = isWeaponRarity(row.rarity) ? row.rarity : "common";
      return {
        ilvl: toInt(row.ilvl),
        rarity,
        minLow: toInt(row.item_roll_min_low),
        minHigh: toInt(row.item_roll_min_high),
        maxLow: toInt(row.item_roll_max_low),
        maxHigh: toInt(row.item_roll_max_high)
      } satisfies DamageRow;
    });

    for (const row of rows) {
      lookup.set(`${dataset.weaponFamily}:${row.ilvl}:${row.rarity}`, row);
    }
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

function rollAffix(
  level: number,
  source: "prefix" | "suffix",
  weaponFamily: WeaponFamilyKey
): DevWeaponAffix {
  const family = pickOne([...AFFIX_FAMILIES[weaponFamily]]);
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

function pickNameCandidate(weaponFamily: WeaponFamilyKey, level: number): NameRow {
  const familyRows = nameRows.filter((row) => row.weaponFamily === weaponFamily);
  if (familyRows.length === 0) {
    throw new Error(`No name rows loaded for family '${weaponFamily}'.`);
  }
  const candidates = familyRows.filter((row) => level >= row.dropMin && level <= row.dropMax);
  return candidates.length > 0 ? pickOne(candidates) : pickOne(familyRows);
}

function generateOneWeapon(): DevWeapon {
  const dataset = pickOne([...WEAPON_DATASETS]);
  const rarity = rollRarity();
  const level = randomInt(1, MAX_LEVEL);
  const nameCandidate = pickNameCandidate(dataset.weaponFamily, level);

  const baseName = nameCandidate.weaponName;

  const damageRow =
    damageRows.get(`${dataset.weaponFamily}:${level}:${rarity}`) ??
    damageRows.get(`${dataset.weaponFamily}:1:${rarity}`);
  const minDamage = damageRow ? randomInt(damageRow.minLow, damageRow.minHigh) : 1;
  const rolledMax = damageRow ? randomInt(damageRow.maxLow, damageRow.maxHigh) : minDamage + 1;
  const maxDamage = Math.max(minDamage, rolledMax);

  const affixes: DevWeaponAffix[] = [];
  if (rarity === "uncommon") {
    affixes.push(
      rollAffix(level, Math.random() < 0.5 ? "prefix" : "suffix", dataset.weaponFamily)
    );
  } else if (rarity === "rare" || rarity === "epic") {
    affixes.push(rollAffix(level, "prefix", dataset.weaponFamily));
    affixes.push(rollAffix(level, "suffix", dataset.weaponFamily));
  }

  const prefix = affixes.find((affix) => affix.source === "prefix");
  const suffix = affixes.find((affix) => affix.source === "suffix");
  const nameWithPrefix = prefix ? `${prefix.name} ${baseName}` : baseName;
  const displayName = suffix ? `${nameWithPrefix} ${suffix.name}` : nameWithPrefix;

  const affixSummary = buildAffixSummary(affixes);
  return {
    displayName,
    displayLine: `${displayName} | ${nameCandidate.weaponType} | Level ${level} [${minDamage}-${maxDamage}] | ${affixSummary}`,
    rarity,
    level,
    weaponFamily: dataset.weaponFamily,
    allowedClass: nameCandidate.allowedClass,
    minDamage,
    maxDamage,
    affixSummary,
    affixes,
    flavorText: nameCandidate.flavorText
  };
}

function generateStartupDevWeapons(): DevWeapon[] {
  return Array.from({ length: WEAPON_COUNT }, () => generateOneWeapon());
}

const startupDevWeapons = generateStartupDevWeapons();

export function getStartupDevWeapons(): DevWeapon[] {
  return startupDevWeapons;
}
