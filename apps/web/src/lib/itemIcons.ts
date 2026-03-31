import { getCraftingMaterialDefinition, getCraftingOutputDefinition } from "@ebonkeep/shared/crafting";
import { getGardenPlantDefinitionByItemCode } from "@ebonkeep/shared/garden";
import { GENERATED_ITEM_ICON_PATHS } from "../generated/itemArtManifest";

const MATERIAL_ICON_KEYS = [
  "mat_alum_crystal",
  "mat_astral_quintessence",
  "mat_beeswax",
  "mat_bone_ash",
  "mat_bone_fragment",
  "mat_charcoal",
  "mat_copper_plate",
  "mat_crownsteel_matrix",
  "mat_cured_hide",
  "mat_distilled_essence",
  "mat_dried_herbs",
  "mat_etched_core",
  "mat_eternal_cipher",
  "mat_iron_ore",
  "mat_leather_scrap",
  "mat_nightveil_weave",
  "mat_pitch_resin",
  "mat_primal_amalgam",
  "mat_quench_stone",
  "mat_river_pearl",
  "mat_shadowhide",
  "mat_sovereign_extract",
  "mat_steel_ingot",
  "mat_tempering_draught",
  "mat_voidheart_ash"
] as const;

const CONSUMABLE_ICON_KEYS = [
  "consumable_berserkers_tonic",
  "consumable_bulwark_tonic",
  "consumable_chroniclers_elixir",
  "consumable_contractors_resolve_elixir",
  "consumable_deadeye_elixir",
  "consumable_emberwake_tonic",
  "consumable_graveward_elixir",
  "consumable_healing_potion",
  "consumable_hexcleanse_tonic",
  "consumable_hunters_tonic",
  "consumable_ravagers_tonic",
  "consumable_second_wind_potion",
  "consumable_sunspike_elixir",
  "consumable_travelers_elixir",
  "consumable_warcallers_elixir",
  "consumable_wardens_tonic",
  "consumable_wardwash_tonic"
] as const;

const UPLOADED_ITEM_ICON_PATHS = Object.freeze({
  ...Object.fromEntries(MATERIAL_ICON_KEYS.map((iconKey) => [iconKey, `/assets/materials/${iconKey}.png`])),
  ...Object.fromEntries(CONSUMABLE_ICON_KEYS.map((iconKey) => [iconKey, `/assets/consumables/${iconKey}.png`]))
}) as Readonly<Record<string, string>>;

const ITEM_CODE_ICON_KEY_ALIASES = Object.freeze({
  all_binding_spool: "mat_pitch_resin",
  all_distilled_slurry: "mat_dried_herbs",
  all_salvaged_ingot: "mat_iron_ore"
}) as Readonly<Record<string, string>>;

function normalizeUploadedIconKey(iconKey: string): string {
  if (UPLOADED_ITEM_ICON_PATHS[iconKey]) {
    return iconKey;
  }

  return iconKey.replace(/_d[12]$/, "");
}

export function getUploadedItemIconPathByIconKey(iconKey: string | null | undefined): string | undefined {
  if (!iconKey) {
    return undefined;
  }

  const normalizedKey = normalizeUploadedIconKey(iconKey);
  return UPLOADED_ITEM_ICON_PATHS[normalizedKey] ?? GENERATED_ITEM_ICON_PATHS[normalizedKey];
}

export function getUploadedItemIconPathByItemCode(itemCode: string | null | undefined): string | undefined {
  if (!itemCode) {
    return undefined;
  }

  const aliasedKey = ITEM_CODE_ICON_KEY_ALIASES[itemCode];
  if (aliasedKey) {
    return getUploadedItemIconPathByIconKey(aliasedKey);
  }

  const directPath = getUploadedItemIconPathByIconKey(itemCode);
  if (directPath) {
    return directPath;
  }

  const materialDefinition = getCraftingMaterialDefinition(itemCode);
  if (materialDefinition) {
    return getUploadedItemIconPathByIconKey(materialDefinition.iconKey);
  }

  const outputDefinition = getCraftingOutputDefinition(itemCode);
  if (outputDefinition) {
    return getUploadedItemIconPathByIconKey(outputDefinition.iconKey);
  }

  const gardenDefinition = getGardenPlantDefinitionByItemCode(itemCode);
  if (gardenDefinition) {
    if (itemCode === gardenDefinition.ingredientItemCode) {
      return `/assets/items/generated/garden/${gardenDefinition.plantId}/${gardenDefinition.plantId}_ingredient.png`;
    }
    if (itemCode === gardenDefinition.seedItemCode) {
      return `/assets/items/generated/garden/${gardenDefinition.plantId}/${gardenDefinition.plantId}_seed.png`;
    }
  }

  return undefined;
}
