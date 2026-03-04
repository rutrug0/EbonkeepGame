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

type RolledWeaponAffix = DevWeaponAffix & {
  scaleKey: string;
  rollMin: number;
  rollMax: number;
};

export type DevWeapon = {
  displayName: string;
  displayLine: string;
  rarity: WeaponRarity;
  level: number;
  baseLevel: number;
  weaponFamily: WeaponFamilyKey;
  allowedClass: PlayerClass;
  minDamage: number;
  maxDamage: number;
  power: number;
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
  baseLevel: number;
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

type DamageCoefficients = {
  baseAvgCommon: number;
  avgGrowthPerIlvl: number;
  baseLevelInfluenceWeight: number;
};

type WeaponPowerCoefficients = {
  weaponPowerScaleFactor: number;
  tierPercentRanges: Record<AffixTier, { min: number; max: number }>;
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

const MAX_LEVEL = 100;
const WEAPON_FAMILIES: readonly WeaponFamilyKey[] = ["melee", "ranged", "arcane"];
const PLAYER_CLASSES: readonly PlayerClass[] = ["warrior", "ranger", "mage"];
const DAMAGE_CATEGORIES: readonly DamageCategory[] = ["strength", "agility", "intelligence"];
const WEAPON_RARITIES: readonly WeaponRarity[] = ["common", "uncommon", "rare", "epic"];
const DAMAGE_COEFFICIENTS_FILE = "warrior_weapon_damage_coefficients_v2.csv";
const WEAPON_POWER_COEFFICIENTS_FILE = "weapon_power_coefficients_v1.csv";
const DIRECT_DAMAGE_AFFIX_STATS = new Set<DevWeaponAffix["stat"]>([
  "melee_damage",
  "ranged_damage",
  "spell_damage"
]);
const TARGET_AXE_ROLLS: readonly { name: string; count: number }[] = [
  { name: "Blackmoor Cleaver", count: 5 },
  { name: "Durnholde Axe", count: 5 },
  { name: "Kingsreach Axe", count: 5 },
  { name: "Dornhal Greataxe", count: 5 }
];

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
    return trimmed.slice(1, -1).replaceAll("\"\"", "\"");
  }
  return trimmed;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    if (char === "\"") {
      const nextChar = idx + 1 < line.length ? line[idx + 1] : "";
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        idx += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(stripQuotes(current));
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(stripQuotes(current));
  return cells;
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

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = cells[i] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFloat(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function buildDamageCoefficients(): DamageCoefficients {
  const row = parseCsv(DAMAGE_COEFFICIENTS_FILE)[0];
  if (!row) {
    throw new Error(`Missing rows in '${DAMAGE_COEFFICIENTS_FILE}'.`);
  }

  return {
    baseAvgCommon: toFloat(row.base_avg_common),
    avgGrowthPerIlvl: toFloat(row.avg_growth_per_ilvl),
    baseLevelInfluenceWeight: toFloat(row.base_level_influence_weight || "0.25")
  };
}

function buildWeaponPowerCoefficients(): WeaponPowerCoefficients {
  const row = parseCsv(WEAPON_POWER_COEFFICIENTS_FILE)[0];
  if (!row) {
    throw new Error(`Missing rows in '${WEAPON_POWER_COEFFICIENTS_FILE}'.`);
  }

  return {
    weaponPowerScaleFactor: toFloat(row.weapon_power_scale_factor || "8.0"),
    tierPercentRanges: {
      T1: {
        min: toFloat(row.t1_pct_min || "0.04"),
        max: toFloat(row.t1_pct_max || "0.08")
      },
      T2: {
        min: toFloat(row.t2_pct_min || "0.10"),
        max: toFloat(row.t2_pct_max || "0.14")
      },
      T3: {
        min: toFloat(row.t3_pct_min || "0.16"),
        max: toFloat(row.t3_pct_max || "0.20")
      }
    }
  };
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
        baseLevel: toInt(row.base_level),
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
const damageCoefficients = buildDamageCoefficients();
const weaponPowerCoefficients = buildWeaponPowerCoefficients();
const affixRows = buildAffixScalingRows();

function averageDamageAtLevel(level: number, coefficients: DamageCoefficients): number {
  return coefficients.baseAvgCommon + coefficients.avgGrowthPerIlvl * level;
}

function computeBaseLevelDamageMultiplier(
  itemLevel: number,
  baseLevel: number,
  coefficients: DamageCoefficients
): number {
  const weightedShare = coefficients.baseLevelInfluenceWeight;
  const itemAvg = averageDamageAtLevel(itemLevel, coefficients);
  if (itemAvg <= 0) {
    return 1;
  }

  const baseAvg = averageDamageAtLevel(baseLevel, coefficients);
  return (1 - weightedShare) + weightedShare * (baseAvg / itemAvg);
}

function applyBaseLevelInfluenceToDamageRow(
  row: DamageRow,
  itemLevel: number,
  baseLevel: number,
  coefficients: DamageCoefficients
): Pick<DamageRow, "minLow" | "minHigh" | "maxLow" | "maxHigh"> {
  const multiplier = computeBaseLevelDamageMultiplier(itemLevel, baseLevel, coefficients);

  const minLow = Math.max(1, Math.round(row.minLow * multiplier));
  const minHigh = Math.max(minLow, Math.round(row.minHigh * multiplier));
  const maxLow = Math.max(minHigh, Math.round(row.maxLow * multiplier));
  const maxHigh = Math.max(maxLow, Math.round(row.maxHigh * multiplier));

  return {
    minLow,
    minHigh,
    maxLow,
    maxHigh
  };
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function expectedPostRarityDamageFromRow(row: Pick<DamageRow, "minLow" | "minHigh" | "maxLow" | "maxHigh">): number {
  const expectedMin = average([row.minLow, row.minHigh]);
  const expectedMax = average([row.maxLow, row.maxHigh]);
  return average([expectedMin, expectedMax]);
}

function toDamageEquivalentPercent(
  affix: Pick<RolledWeaponAffix, "tier" | "value" | "rollMin" | "rollMax">,
  coefficients: WeaponPowerCoefficients
): number {
  const tierRange = coefficients.tierPercentRanges[affix.tier];
  const denominator = affix.rollMax - affix.rollMin;
  const progress =
    denominator > 0 ? clamp01((affix.value - affix.rollMin) / denominator) : 1;
  return tierRange.min + (tierRange.max - tierRange.min) * progress;
}

function getAffixDamageEquivalentValue(
  affix: Pick<RolledWeaponAffix, "tier" | "value" | "rollMin" | "rollMax">,
  expectedPostRarityDamage: number,
  coefficients: WeaponPowerCoefficients
): number {
  return expectedPostRarityDamage * toDamageEquivalentPercent(affix, coefficients);
}

function rollAffix(
  level: number,
  source: "prefix" | "suffix",
  weaponFamily: WeaponFamilyKey
): RolledWeaponAffix {
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
      unit: "flat",
      scaleKey: family.scaleKey,
      rollMin: 0,
      rollMax: 0
    };
  }

  return {
    source,
    name: source === "prefix" ? family.prefixes[tier] : family.suffixes[tier],
    tier,
    stat: family.statKey,
    value: randomInt(scaling.rollMin, scaling.rollMax),
    unit: scaling.unit,
    scaleKey: family.scaleKey,
    rollMin: scaling.rollMin,
    rollMax: scaling.rollMax
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

function generateOneWeapon(forcedNameCandidate?: NameRow): DevWeapon {
  const dataset = forcedNameCandidate
    ? WEAPON_DATASETS.find((entry) => entry.weaponFamily === forcedNameCandidate.weaponFamily) ?? pickOne([...WEAPON_DATASETS])
    : pickOne([...WEAPON_DATASETS]);
  const rarity = rollRarity();
  const level = forcedNameCandidate
    ? randomInt(forcedNameCandidate.dropMin, forcedNameCandidate.dropMax)
    : randomInt(1, MAX_LEVEL);
  const nameCandidate = forcedNameCandidate ?? pickNameCandidate(dataset.weaponFamily, level);

  const baseName = nameCandidate.weaponName;

  const damageRow =
    damageRows.get(`${dataset.weaponFamily}:${level}:${rarity}`) ??
    damageRows.get(`${dataset.weaponFamily}:1:${rarity}`);
  const adjustedRow = damageRow
    ? applyBaseLevelInfluenceToDamageRow(damageRow, level, nameCandidate.baseLevel, damageCoefficients)
    : null;
  const baseRolledMin = adjustedRow ? randomInt(adjustedRow.minLow, adjustedRow.minHigh) : 1;
  const baseRolledMax = adjustedRow
    ? randomInt(adjustedRow.maxLow, adjustedRow.maxHigh)
    : baseRolledMin + 1;

  const affixes: RolledWeaponAffix[] = [];
  if (rarity === "uncommon") {
    affixes.push(
      rollAffix(level, Math.random() < 0.5 ? "prefix" : "suffix", dataset.weaponFamily)
    );
  } else if (rarity === "rare" || rarity === "epic") {
    affixes.push(rollAffix(level, "prefix", dataset.weaponFamily));
    affixes.push(rollAffix(level, "suffix", dataset.weaponFamily));
  }

  const expectedPostRarityDamage = adjustedRow
    ? expectedPostRarityDamageFromRow(adjustedRow)
    : average([baseRolledMin, baseRolledMax]);
  const affixDamageEquivalentValues = affixes.map((affix) =>
    getAffixDamageEquivalentValue(
      affix,
      expectedPostRarityDamage,
      weaponPowerCoefficients
    )
  );
  const directDamageContributionTotal = affixes.reduce((sum, affix, index) => {
    if (!DIRECT_DAMAGE_AFFIX_STATS.has(affix.stat)) {
      return sum;
    }
    return sum + affixDamageEquivalentValues[index];
  }, 0);
  const utilityDamageContributionTotal = affixes.reduce((sum, affix, index) => {
    if (DIRECT_DAMAGE_AFFIX_STATS.has(affix.stat)) {
      return sum;
    }
    return sum + affixDamageEquivalentValues[index];
  }, 0);
  const directDamageDelta = Math.max(0, Math.round(directDamageContributionTotal));
  const minDamage = Math.max(1, baseRolledMin + directDamageDelta);
  const maxDamage = Math.max(minDamage, baseRolledMax + directDamageDelta);
  const expectedFinalDamage =
    expectedPostRarityDamage +
    directDamageContributionTotal +
    utilityDamageContributionTotal;
  const power = Math.max(
    0,
    Math.round(expectedFinalDamage * weaponPowerCoefficients.weaponPowerScaleFactor)
  );

  const prefix = affixes.find((affix) => affix.source === "prefix");
  const suffix = affixes.find((affix) => affix.source === "suffix");
  const nameWithPrefix = prefix ? `${prefix.name} ${baseName}` : baseName;
  const displayName = suffix ? `${nameWithPrefix} ${suffix.name}` : nameWithPrefix;
  const payloadAffixes: DevWeaponAffix[] = affixes.map(
    ({ source, name, tier, stat, value, unit }) => ({
      source,
      name,
      tier,
      stat,
      value,
      unit
    })
  );
  const affixSummary = buildAffixSummary(payloadAffixes);
  return {
    displayName,
    displayLine: `${displayName} | ${nameCandidate.weaponType} | Level ${level} [${minDamage}-${maxDamage}] | ${affixSummary}`,
    rarity,
    level,
    baseLevel: nameCandidate.baseLevel,
    weaponFamily: dataset.weaponFamily,
    allowedClass: nameCandidate.allowedClass,
    minDamage,
    maxDamage,
    power,
    affixSummary,
    affixes: payloadAffixes,
    flavorText: nameCandidate.flavorText
  };
}

function generateStartupDevWeapons(): DevWeapon[] {
  const targetedRows = TARGET_AXE_ROLLS.map((target) => {
    const row = nameRows.find(
      (entry) => entry.weaponFamily === "melee" && entry.weaponName === target.name
    );
    if (!row) {
      throw new Error(`Targeted mock weapon '${target.name}' was not found in melee name rows.`);
    }
    return { row, count: target.count };
  });

  const targetedWeapons: DevWeapon[] = [];
  for (const target of targetedRows) {
    for (let i = 0; i < target.count; i += 1) {
      targetedWeapons.push(generateOneWeapon(target.row));
    }
  }

  return targetedWeapons;
}

const startupDevWeapons = generateStartupDevWeapons();

export function getStartupDevWeapons(): DevWeapon[] {
  return startupDevWeapons;
}
