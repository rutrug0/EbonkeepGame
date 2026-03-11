import type { ReactElement } from "react";

import {
  GENERATED_ITEM_ENCYCLOPEDIA_DATA,
  type GeneratedEncyclopediaItem
} from "../../generated/itemEncyclopediaData";
import i18n from "../../i18n";
import { EncyclopediaItemCard } from "./KnowledgeCards";

export type EncyclopediaCategory = "armor" | "weapon" | "jewelry" | "monster";
export type EncyclopediaArmorArchetype = "heavy" | "light" | "robe";
export type EncyclopediaWeaponArchetype = "melee" | "ranged" | "arcane";

export const ENCYCLOPEDIA_ARMOR_SLOT_ORDER: string[] = [
  "helmet",
  "upper_armor",
  "pauldrons",
  "gloves",
  "belt",
  "lower_armor",
  "boots"
];
export const ENCYCLOPEDIA_CATEGORY_ORDER: EncyclopediaCategory[] = ["armor", "weapon", "jewelry", "monster"];
export const ENCYCLOPEDIA_ARMOR_ARCHETYPE_ORDER: EncyclopediaArmorArchetype[] = ["heavy", "light", "robe"];
export const ENCYCLOPEDIA_WEAPON_ARCHETYPE_ORDER: EncyclopediaWeaponArchetype[] = ["melee", "ranged", "arcane"];

function sanitizeEncyclopediaItem(raw: GeneratedEncyclopediaItem): GeneratedEncyclopediaItem {
  return {
    key: typeof raw.key === "string" && raw.key.length > 0 ? raw.key : `unknown:${Math.random().toString(36).slice(2)}`,
    contentId:
      typeof raw.contentId === "string" && raw.contentId.length > 0
        ? raw.contentId
        : `unknown:${Math.random().toString(36).slice(2)}`,
    majorCategory: typeof raw.majorCategory === "string" ? raw.majorCategory : "unknown",
    archetype: typeof raw.archetype === "string" ? raw.archetype : "unknown",
    family: typeof raw.family === "string" ? raw.family : "unknown",
    familyId: typeof raw.familyId === "string" ? raw.familyId : "",
    slotFamily: typeof raw.slotFamily === "string" ? raw.slotFamily : "unknown",
    itemType: typeof raw.itemType === "string" ? raw.itemType : i18n.t("item.unknown"),
    itemName: typeof raw.itemName === "string" ? raw.itemName : i18n.t("item.missingItem"),
    flavorText: typeof raw.flavorText === "string" ? raw.flavorText : "",
    baseLevel: Number.isFinite(raw.baseLevel) ? raw.baseLevel : 0,
    dropMinLevel: Number.isFinite(raw.dropMinLevel) ? raw.dropMinLevel : 0,
    dropMaxLevel: Number.isFinite(raw.dropMaxLevel) ? raw.dropMaxLevel : 0,
    iconPath: typeof raw.iconPath === "string" ? raw.iconPath : null,
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : "unknown",
    sequence: Number.isFinite(raw.sequence) ? raw.sequence : 0,
    locationName: typeof raw.locationName === "string" ? raw.locationName : "",
    isBoss: raw.isBoss === true,
    bossKind: typeof raw.bossKind === "string" ? raw.bossKind : ""
  };
}

export function normalizeEncyclopediaItems(input: GeneratedEncyclopediaItem[]): GeneratedEncyclopediaItem[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((item) => sanitizeEncyclopediaItem(item));
}

export type EncyclopediaPanelProps = {
  embedCharacterHubTabs?: boolean;
  encyclopediaCategory: EncyclopediaCategory;
  encyclopediaArmorArchetype: EncyclopediaArmorArchetype;
  encyclopediaWeaponArchetype: EncyclopediaWeaponArchetype;
  preferredLocale: string;
  onCategoryChange: (category: EncyclopediaCategory) => void;
  onArmorArchetypeChange: (archetype: EncyclopediaArmorArchetype) => void;
  onWeaponArchetypeChange: (archetype: EncyclopediaWeaponArchetype) => void;
  formatTokenLabel: (value: unknown) => string;
  renderCharacterHubTabs?: () => ReactElement;
  renderErrorPanel: (title: string, description: string) => ReactElement;
};

export function EncyclopediaPanel(props: EncyclopediaPanelProps) {
  try {
    const allItems = normalizeEncyclopediaItems(GENERATED_ITEM_ENCYCLOPEDIA_DATA);
    return (
      <section className="contentShell">
        <section className="contentStack">
          {props.embedCharacterHubTabs ? props.renderCharacterHubTabs?.() ?? null : null}
          <article className="contentCard encyclopediaControlsCard">
            <h2>{i18n.t("menu.encyclopedia")}</h2>
            <p>{i18n.t("encyclopedia.description")}</p>
            <div className="encyclopediaTabRow">
              {ENCYCLOPEDIA_CATEGORY_ORDER.map((category) => (
                <button
                  key={category}
                  className={`profileSwitchButton${props.encyclopediaCategory === category ? " active" : ""}`}
                  onClick={() => props.onCategoryChange(category)}
                >
                  {props.formatTokenLabel(category)}
                </button>
              ))}
            </div>
            {props.encyclopediaCategory === "armor" ? (
              <div className="encyclopediaTabRow">
                {ENCYCLOPEDIA_ARMOR_ARCHETYPE_ORDER.map((archetype) => (
                  <button
                    key={archetype}
                    className={`profileSwitchButton${props.encyclopediaArmorArchetype === archetype ? " active" : ""}`}
                    onClick={() => props.onArmorArchetypeChange(archetype)}
                  >
                    {props.formatTokenLabel(archetype)}
                  </button>
                ))}
              </div>
            ) : null}
            {props.encyclopediaCategory === "weapon" ? (
              <div className="encyclopediaTabRow">
                {ENCYCLOPEDIA_WEAPON_ARCHETYPE_ORDER.map((archetype) => (
                  <button
                    key={archetype}
                    className={`profileSwitchButton${props.encyclopediaWeaponArchetype === archetype ? " active" : ""}`}
                    onClick={() => props.onWeaponArchetypeChange(archetype)}
                  >
                    {props.formatTokenLabel(archetype)}
                  </button>
                ))}
              </div>
            ) : null}
          </article>

          {props.encyclopediaCategory === "armor" ? renderArmorPanel(allItems, props) : null}
          {props.encyclopediaCategory === "weapon" ? renderWeaponPanel(allItems, props) : null}
          {props.encyclopediaCategory === "jewelry" ? renderJewelryPanel(allItems, props) : null}
          {props.encyclopediaCategory === "monster" ? renderMonsterPanel(allItems, props) : null}
        </section>
      </section>
    );
  } catch {
    return props.renderErrorPanel(
      props.embedCharacterHubTabs ? "Encyclopedia" : i18n.t("menu.encyclopedia"),
      i18n.t("encyclopedia.renderError")
    );
  }
}

function renderArmorPanel(allItems: GeneratedEncyclopediaItem[], props: EncyclopediaPanelProps) {
  const armorItems = allItems.filter(
    (item) => item.majorCategory === "armor" && item.archetype === props.encyclopediaArmorArchetype
  );
  const byBaseLevel = new Map<number, Map<string, GeneratedEncyclopediaItem>>();
  for (const item of armorItems) {
    const slotMap = byBaseLevel.get(item.baseLevel) ?? new Map<string, GeneratedEncyclopediaItem>();
    slotMap.set(item.slotFamily, item);
    byBaseLevel.set(item.baseLevel, slotMap);
  }
  const levels = [...byBaseLevel.keys()].sort((left, right) => left - right);
  if (levels.length === 0) {
    return (
      <article className="contentCard">
        <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyArmor")}</p>
      </article>
    );
  }
  return (
    <article className="contentCard encyclopediaSetListCard">
      <div className="encyclopediaSetList">
        {levels.map((baseLevel) => {
          const slotMap = byBaseLevel.get(baseLevel);
          return (
            <section className="encyclopediaSetSection" key={`armor-${props.encyclopediaArmorArchetype}-${baseLevel}`}>
              <div className="encyclopediaSetHeader">
                <h3>
                  {i18n.t("encyclopedia.armorSet", {
                    archetype: props.formatTokenLabel(props.encyclopediaArmorArchetype)
                  })}
                </h3>
                <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: baseLevel })}</span>
              </div>
              <div className="encyclopediaSetGrid">
                {ENCYCLOPEDIA_ARMOR_SLOT_ORDER.map((slotFamily) => (
                  <div key={`slot-${baseLevel}-${slotFamily}`}>
                    <EncyclopediaItemCard
                      item={slotMap?.get(slotFamily) ?? null}
                      fallbackLabel={slotFamily}
                      formatTokenLabel={props.formatTokenLabel}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function renderWeaponPanel(allItems: GeneratedEncyclopediaItem[], props: EncyclopediaPanelProps) {
  const weaponItems = allItems.filter(
    (item) => item.majorCategory === "weapon" && item.archetype === props.encyclopediaWeaponArchetype
  );
  type WeaponGroup = {
    family: string;
    baseLevel: number;
    items: GeneratedEncyclopediaItem[];
  };
  const byGroup = new Map<string, WeaponGroup>();
  for (const item of weaponItems) {
    const key = `${item.family}:${item.baseLevel}`;
    const current = byGroup.get(key);
    if (current) {
      current.items.push(item);
      continue;
    }
    byGroup.set(key, { family: item.family, baseLevel: item.baseLevel, items: [item] });
  }
  const groups = [...byGroup.values()].sort((left, right) => {
    if (left.baseLevel !== right.baseLevel) {
      return left.baseLevel - right.baseLevel;
    }
    return String(left.family).localeCompare(String(right.family), props.preferredLocale);
  });
  if (groups.length === 0) {
    return (
      <article className="contentCard">
        <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyWeapon")}</p>
      </article>
    );
  }
  return (
    <article className="contentCard encyclopediaGroupListCard">
      <div className="encyclopediaGroupList">
        {groups.map((group) => (
          <section
            className="encyclopediaGroupSection"
            key={`weapon-${props.encyclopediaWeaponArchetype}-${group.family}-${group.baseLevel}`}
          >
            <div className="encyclopediaSetHeader">
              <h3>{props.formatTokenLabel(group.family)}</h3>
              <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: group.baseLevel })}</span>
            </div>
            <div className="encyclopediaGroupGrid">
              {group.items
                .slice()
                .sort((left, right) => String(left.itemName).localeCompare(String(right.itemName), props.preferredLocale))
                .map((item) => (
                  <div key={item.key}>
                    <EncyclopediaItemCard item={item} formatTokenLabel={props.formatTokenLabel} />
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function renderJewelryPanel(allItems: GeneratedEncyclopediaItem[], props: EncyclopediaPanelProps) {
  const jewelryItems = allItems.filter((item) => item.majorCategory === "jewelry");
  if (jewelryItems.length === 0) {
    return (
      <article className="contentCard">
        <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyJewelry")}</p>
      </article>
    );
  }
  type JewelryGroup = {
    family: string;
    baseLevel: number;
    items: GeneratedEncyclopediaItem[];
  };
  const byGroup = new Map<string, JewelryGroup>();
  for (const item of jewelryItems) {
    const key = `${item.family}:${item.baseLevel}`;
    const current = byGroup.get(key);
    if (current) {
      current.items.push(item);
      continue;
    }
    byGroup.set(key, { family: item.family, baseLevel: item.baseLevel, items: [item] });
  }
  const groups = [...byGroup.values()].sort((left, right) => {
    if (left.family !== right.family) {
      return String(left.family).localeCompare(String(right.family), props.preferredLocale);
    }
    return left.baseLevel - right.baseLevel;
  });
  return (
    <article className="contentCard encyclopediaGroupListCard">
      <div className="encyclopediaGroupList">
        {groups.map((group) => (
          <section className="encyclopediaGroupSection" key={`jewelry-${group.family}-${group.baseLevel}`}>
            <div className="encyclopediaSetHeader">
              <h3>{props.formatTokenLabel(group.family)}</h3>
              <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: group.baseLevel })}</span>
            </div>
            <div className="encyclopediaGroupGrid">
              {group.items
                .slice()
                .sort((left, right) => String(left.itemName).localeCompare(String(right.itemName), props.preferredLocale))
                .map((item) => (
                  <div key={item.key}>
                    <EncyclopediaItemCard item={item} formatTokenLabel={props.formatTokenLabel} />
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function renderMonsterPanel(allItems: GeneratedEncyclopediaItem[], props: EncyclopediaPanelProps) {
  const monsterItems = allItems.filter((item) => item.majorCategory === "monster");
  if (monsterItems.length === 0) {
    return (
      <article className="contentCard">
        <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyMonster")}</p>
      </article>
    );
  }
  type MonsterGroup = {
    familyId: string;
    familyName: string;
    locationName: string;
    baseLevel: number;
    items: GeneratedEncyclopediaItem[];
  };
  const byGroup = new Map<string, MonsterGroup>();
  for (const item of monsterItems) {
    const key = item.familyId || `${item.family}:${item.baseLevel}`;
    const current = byGroup.get(key);
    if (current) {
      current.items.push(item);
      continue;
    }
    byGroup.set(key, {
      familyId: item.familyId,
      familyName: item.family,
      locationName: item.locationName,
      baseLevel: item.baseLevel,
      items: [item]
    });
  }
  const groups = [...byGroup.values()].sort((left, right) => {
    if (left.baseLevel !== right.baseLevel) {
      return left.baseLevel - right.baseLevel;
    }
    return String(left.familyName).localeCompare(String(right.familyName), props.preferredLocale);
  });
  return (
    <article className="contentCard encyclopediaGroupListCard">
      <div className="encyclopediaGroupList">
        {groups.map((group) => (
          <section className="encyclopediaGroupSection" key={`monster-${group.familyId}-${group.baseLevel}`}>
            <div className="encyclopediaSetHeader">
              <div className="encyclopediaSectionHeading">
                <h3>{group.familyName}</h3>
                {group.locationName ? (
                  <p className="encyclopediaSectionSubline">
                    {i18n.t("encyclopedia.location", { value: group.locationName })}
                  </p>
                ) : null}
              </div>
              <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: group.baseLevel })}</span>
            </div>
            <div className="encyclopediaGroupGrid encyclopediaMonsterGrid">
              {group.items
                .slice()
                .sort((left, right) => left.sequence - right.sequence)
                .map((item) => (
                  <div key={item.key}>
                    <EncyclopediaItemCard item={item} formatTokenLabel={props.formatTokenLabel} />
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
