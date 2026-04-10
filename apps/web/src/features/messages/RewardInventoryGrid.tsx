import { type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  isItemUsableByClass,
  type EquipmentState,
  type InventoryItem,
  type ItemModifier,
  type ItemRarity
} from "@ebonkeep/shared/inventory";
import type { ArmorArchetype, EquipmentSlotId, ItemMajorCategory, PlayerClass, WeaponArchetype } from "@ebonkeep/shared/core";
import type { PlayerState } from "@ebonkeep/shared/player";

import { GENERATED_WEAPON_ICON_PATHS_BY_NAME } from "../profile/mockInventoryData";
import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
import { getUploadedItemIconPathByItemCode } from "../../lib/itemIcons";
import { useHoverOverlayPresence } from "../../lib/useHoverOverlayPresence";

type RewardInventoryGridProps = {
  items: InventoryItem[];
  playerState: PlayerState | null;
  itemCardAttributeName?: string;
};

type HoverState = {
  hoverKey: string;
  sourceItem: InventoryItem;
  comparisonItem: InventoryItem | null;
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type ItemIconVariant =
  | "armor"
  | "weapon"
  | "jewelry"
  | "vestige"
  | "consumable"
  | "material"
  | "container"
  | "utility"
  | "generic";

type ModifierLine = {
  id: string;
  tier: ItemModifier["tier"];
  label: string;
  value: string;
};

function formatOneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatModifierStatLabel(t: (key: string) => string, stat: string): string {
  const knownLabels: Record<string, string> = {
    strength: t("profile.strength"),
    intelligence: t("profile.intelligence"),
    dexterity: t("profile.dexterity"),
    vitality: t("profile.vitality"),
    initiative: t("profile.initiative"),
    luck: t("profile.luck"),
    armor: t("profile.armor"),
    spell_shield: t("profile.spellShield"),
    missile_resistance: t("profile.missileResistance"),
    melee_damage: t("profile.meleeDamage"),
    ranged_damage: t("profile.rangedDamage"),
    spell_damage: t("profile.spellDamage"),
    max_hitpoints: t("profile.maxHitpoints"),
    crit_damage: t("profile.critDamage"),
    crit_chance: t("profile.critChance"),
    extra_attack_chance: t("profile.extraAttackChance"),
    double_attack_chance: t("profile.extraAttackChance")
  };

  if (knownLabels[stat]) {
    return knownLabels[stat];
  }

  return stat
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatModifierValue(value: number, unit: "flat" | "basis_points"): string {
  if (unit === "basis_points") {
    return `${value >= 0 ? "+" : ""}${formatOneDecimal(value / 100)}%`;
  }
  return `${value >= 0 ? "+" : ""}${value}`;
}

function localizeKnownLabel(t: (key: string) => string, label: string): string {
  const keyByLabel: Record<string, string> = {
    "Melee Damage": "profile.meleeDamage",
    "Ranged Damage": "profile.rangedDamage",
    "Spell Damage": "profile.spellDamage",
    "Crit Damage": "profile.critDamage",
    "Crit Chance": "profile.critChance",
    Threat: "profile.threat",
    "Extra Attack Chance": "profile.extraAttackChance",
    Armor: "profile.armor",
    "Spell Shield": "profile.spellShield",
    "Missile Resistance": "profile.missileResistance",
    "Physical Defense": "profile.physicalDefense",
    "P.Def": "profile.physicalDefense",
    "Magic Defense": "profile.magicDefense",
    "M.Def": "profile.magicDefense",
    "Max Hitpoints": "profile.maxHitpoints"
  };

  const key = keyByLabel[label];
  if (!key) {
    return label;
  }

  const translated = t(key);
  return translated === key ? label : translated;
}

function normalizeItemNameForArtLookup(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getJewelryTypeForSlot(slotId: EquipmentSlotId | undefined): "ring" | "necklace" | undefined {
  if (!slotId) {
    return undefined;
  }
  if (slotId === "ringLeft" || slotId === "ringRight") {
    return "ring";
  }
  if (slotId === "necklace") {
    return "necklace";
  }
  return undefined;
}

function getGeneratedItemIconPath(args: {
  majorCategory?: ItemMajorCategory;
  itemName: string;
  weaponArchetype?: WeaponArchetype;
  armorArchetype?: ArmorArchetype;
  equipSlotId?: EquipmentSlotId;
}): string | undefined {
  const itemName = normalizeItemNameForArtLookup(args.itemName);
  if (!itemName || !args.majorCategory) {
    return undefined;
  }

  if (args.majorCategory === "weapon" && args.weaponArchetype) {
    const key = `weapon:${args.weaponArchetype}:${itemName}`;
    return GENERATED_ITEM_ICON_PATHS[key] ?? GENERATED_WEAPON_ICON_PATHS_BY_NAME[itemName];
  }

  if (args.majorCategory === "armor" && args.armorArchetype) {
    const key = `armor:${args.armorArchetype}:${itemName}`;
    return GENERATED_ITEM_ICON_PATHS[key];
  }

  if (args.majorCategory === "jewelry") {
    const jewelryType = getJewelryTypeForSlot(args.equipSlotId);
    if (!jewelryType) {
      return undefined;
    }
    const key = `jewelry:${jewelryType}:${itemName}`;
    return GENERATED_ITEM_ICON_PATHS[key];
  }

  return undefined;
}

function resolveItemIconVisual(args: {
  majorCategory?: ItemMajorCategory;
  category?: string;
  itemName?: string | null;
}): { variant: ItemIconVariant; label: string } {
  const category = (args.category ?? "").toLowerCase();
  if (
    category.includes("material")
    || category.includes("catalyst")
    || category.includes("reagent")
    || category.includes("seed")
    || category.includes("plant")
    || category.includes("ingredient")
  ) {
    return { variant: "material", label: "MT" };
  }

  if (args.majorCategory === "armor") {
    return { variant: "armor", label: "AR" };
  }
  if (args.majorCategory === "weapon") {
    return { variant: "weapon", label: "WP" };
  }
  if (args.majorCategory === "jewelry") {
    return { variant: "jewelry", label: "JW" };
  }
  if (args.majorCategory === "vestige") {
    return { variant: "vestige", label: "VS" };
  }
  if (args.majorCategory === "consumable") {
    return { variant: "consumable", label: "CO" };
  }

  if (category.includes("consumable")) {
    return { variant: "consumable", label: "CO" };
  }
  if (category.includes("container")) {
    return { variant: "container", label: "CT" };
  }
  if (category.includes("utility")) {
    return { variant: "utility", label: "UT" };
  }

  const letters = (args.itemName ?? "IT").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  return {
    variant: "generic",
    label: letters.length === 2 ? letters : "IT"
  };
}

function getDisplayItemName(item: InventoryItem): string {
  const enchantPrefix = item.enchanting?.level ? `+${item.enchanting.level} ` : "";
  const prefixName = item.prefix?.name ? `${item.prefix.name} ` : "";
  const affixName = item.affix?.name ? ` ${item.affix.name}` : "";
  return `${enchantPrefix}${prefixName}${item.itemName}${affixName}`.trim();
}

function renderItemDisplayName(item: InventoryItem): ReactElement {
  return (
    <>
      {item.enchanting?.level ? <span>{`+${item.enchanting.level} `}</span> : null}
      {item.prefix ? <>{item.prefix.name} </> : null}
      <span>{item.itemName}</span>
      {item.affix ? <> {item.affix.name}</> : null}
    </>
  );
}

function formatRarityLabel(t: (key: string) => string, rarity: ItemRarity): string {
  return t(`rarity.${rarity}`);
}

function formatArchetypeLabel(t: (key: string) => string, value: string): string {
  const translated = t(`archetype.${value}`);
  return translated && translated !== `archetype.${value}` ? translated : value;
}

function getItemSubtypeLabel(t: (key: string) => string, item: InventoryItem): string {
  const majorCategory = item.archetype?.majorCategory;
  if (majorCategory === "armor" && item.archetype?.armorArchetype) {
    return `${formatArchetypeLabel(t, item.archetype.armorArchetype)} ${t("profile.armor")}`;
  }
  if (majorCategory === "weapon" && item.archetype?.weaponArchetype) {
    return `${formatArchetypeLabel(t, item.archetype.weaponArchetype)} ${t("slots.weapon")}`;
  }
  return item.category;
}

function getModifierTierClassName(tier: ItemModifier["tier"]): string {
  if (tier === "T1") {
    return "modifierTier-t1";
  }
  if (tier === "T2") {
    return "modifierTier-t2";
  }
  return "modifierTier-t3";
}

function getItemModifierStatLines(t: (key: string) => string, item: InventoryItem): ModifierLine[] {
  const lines: ModifierLine[] = [];
  if (item.prefix) {
    lines.push({
      id: `${item.id}-prefix`,
      tier: item.prefix.tier,
      label: formatModifierStatLabel(t, item.prefix.statKey),
      value: formatModifierValue(item.prefix.value, item.prefix.unit)
    });
  }
  if (item.affix) {
    lines.push({
      id: `${item.id}-affix`,
      tier: item.affix.tier,
      label: formatModifierStatLabel(t, item.affix.statKey),
      value: formatModifierValue(item.affix.value, item.affix.unit)
    });
  }
  return lines;
}

function getWeaponDamageSummary(t: (key: string, options?: Record<string, unknown>) => string, item: InventoryItem): {
  damageLine: string;
  rollLine: string;
} | null {
  if (!item.damageRoll) {
    return null;
  }

  const { minRollRange, maxRollRange, rolledMin, rolledMax, averageDamage } = item.damageRoll;
  let damageLine: string;

  if (item.temperingFailed && item.damagePenaltyBps && item.damagePenaltyBps > 0) {
    const penaltyAmount = Math.round((averageDamage * item.damagePenaltyBps / (10_000 - item.damagePenaltyBps)) * 10) / 10;
    damageLine = t("item.damageWithPenalty", {
      value: formatOneDecimal(averageDamage),
      penalty: formatOneDecimal(penaltyAmount)
    });
  } else {
    damageLine = t("item.damage", { value: formatOneDecimal(averageDamage) });
  }

  return {
    damageLine,
    rollLine: t("item.roll", {
      minLow: minRollRange[0],
      minHigh: minRollRange[1],
      rolledMin,
      rolledMax,
      maxLow: maxRollRange[0],
      maxHigh: maxRollRange[1]
    })
  };
}

function getDefenseSummary(t: (key: string) => string, item: InventoryItem): { primaryLine: string; secondaryLine?: string } | null {
  const physicalDefense = item.statBonuses?.physicalDefense;
  if (typeof physicalDefense === "number" && physicalDefense > 0) {
    return {
      primaryLine: `${t("profile.physicalDefense")}: ${physicalDefense}`
    };
  }

  const magicDefense = item.statBonuses?.magicDefense;
  if (typeof magicDefense === "number" && magicDefense > 0) {
    return {
      primaryLine: `${t("profile.magicDefense")}: ${magicDefense}`
    };
  }

  return null;
}

function canPlayerUseItem(item: InventoryItem, playerState: PlayerState | null): boolean {
  if (!item.equipable || !playerState) {
    return true;
  }

  const archetypeClassKey = item.archetype.weaponArchetype ?? item.archetype.armorArchetype;
  return isItemUsableByClass(playerState.class, item.archetype.majorCategory, archetypeClassKey)
    && playerState.level >= item.levelRequirement;
}

function getAllowedSlotIds(item: InventoryItem): EquipmentSlotId[] {
  return item.allowedSlotIds.length > 0 ? [...item.allowedSlotIds] : [];
}

function getPreferredEquipSlot(item: InventoryItem, equipment: EquipmentState): EquipmentSlotId | null {
  const allowedSlotIds = getAllowedSlotIds(item);
  const currentlyEquippedSlotId = allowedSlotIds.find((slotId) => equipment[slotId]?.id === item.id);
  if (currentlyEquippedSlotId) {
    return currentlyEquippedSlotId;
  }

  const emptySlotId = allowedSlotIds.find((slotId) => equipment[slotId] === null);
  return emptySlotId ?? allowedSlotIds[0] ?? null;
}

function resolveRewardItemIconAssetPath(item: InventoryItem): string | undefined {
  if (item.iconAssetPath) {
    return item.iconAssetPath;
  }

  const uploadedIconPath = getUploadedItemIconPathByItemCode(item.itemCode);
  if (uploadedIconPath) {
    return uploadedIconPath;
  }

  return getGeneratedItemIconPath({
    majorCategory: item.archetype.majorCategory,
    itemName: item.itemName,
    weaponArchetype: item.archetype.weaponArchetype,
    armorArchetype: item.archetype.armorArchetype,
    equipSlotId: item.allowedSlotIds[0]
  });
}

function renderItemIcon(args: {
  majorCategory?: ItemMajorCategory;
  category?: string;
  itemName?: string | null;
  iconAssetPath?: string;
  enchantLevel?: number | null;
  className?: string;
  renderMode?: "default" | "imageOnly";
}): ReactElement {
  const iconVisual = resolveItemIconVisual(args);
  const extraClass = args.className ? ` ${args.className}` : "";
  const enchantLevel = Math.max(0, Math.floor(args.enchantLevel ?? 0));
  const enchantBadge = enchantLevel > 0 ? (
    <span className="itemVisualEnchantBadge" aria-hidden="true">{`+${enchantLevel}`}</span>
  ) : null;

  if (args.iconAssetPath && args.renderMode === "imageOnly") {
    return (
      <span className="itemVisualFrame itemVisualFrame--imageOnly" aria-hidden="true">
        <img className="itemVisualImage itemVisualImageCard" src={args.iconAssetPath} alt="" loading="lazy" />
        {enchantBadge}
      </span>
    );
  }

  return (
    <span className="itemVisualFrame" aria-hidden="true">
      <span className={`itemVisualIcon itemVisual-${iconVisual.variant}${extraClass}`}>
        {args.iconAssetPath ? (
          <img className="itemVisualImage" src={args.iconAssetPath} alt="" loading="lazy" />
        ) : (
          iconVisual.label
        )}
      </span>
      {enchantBadge}
    </span>
  );
}

function renderInventoryItemCardBody(t: (key: string, options?: Record<string, unknown>) => string, item: InventoryItem, canUseItem: boolean): ReactElement {
  const displayItemName = getDisplayItemName(item);
  const iconAssetPath = resolveRewardItemIconAssetPath(item);
  const useImageOnlyIcon = Boolean(iconAssetPath);
  const showPowerBadge = item.equipable || item.power > 0;
  const showLevelBadge = item.equipable || item.levelRequirement > 1;
  const showQuantityBadge = !item.equipable && typeof item.quantity === "number" && item.quantity > 0;

  return (
    <div className={`inventoryCompactVisual${canUseItem ? "" : " isRestricted"}${item.temperingFailed ? " isTemperingFailed" : ""}`}>
      {item.temperingFailed ? <span className="inventoryTemperingFailedBadge" aria-label={t("forge.instabilityTitle")}>!</span> : null}
      {renderItemIcon({
        majorCategory: item.archetype.majorCategory,
        category: item.category,
        itemName: displayItemName,
        iconAssetPath,
        enchantLevel: item.enchanting?.level,
        className: useImageOnlyIcon ? undefined : `inventoryCompactIcon${canUseItem ? "" : " isRestricted"}`,
        renderMode: useImageOnlyIcon ? "imageOnly" : "default"
      })}
      {showPowerBadge ? (
        <span className="inventoryCompactPowerBadge" aria-hidden="true">
          {item.power}
        </span>
      ) : null}
      {showLevelBadge ? (
        <span className={`inventoryCompactLevelBadge${canUseItem ? "" : " isRestricted"}`} aria-hidden="true">
          Lv. {item.levelRequirement}
        </span>
      ) : null}
      {showQuantityBadge ? (
        <span className="inventoryCompactQuantityBadge" aria-hidden="true">
          {t("profile.stackCountCompact", { count: item.quantity })}
        </span>
      ) : null}
    </div>
  );
}

function renderInventoryItemDetailCardBody(
  t: (key: string, options?: Record<string, unknown>) => string,
  item: InventoryItem,
  canUseItem: boolean,
  asideNote?: string,
  powerDelta?: number
): ReactElement {
  const subtypeLabel = getItemSubtypeLabel(t, item);
  const modifierLines = getItemModifierStatLines(t, item);
  const weaponDamageSummary = getWeaponDamageSummary(t, item);
  const defenseSummary = getDefenseSummary((key) => t(key), item);
  const displayItemName = getDisplayItemName(item);
  const iconAssetPath = resolveRewardItemIconAssetPath(item);
  const useImageOnlyIcon = Boolean(iconAssetPath);
  const showPowerFooter = item.equipable || item.power > 0;
  const showLevelFooter = item.equipable || item.levelRequirement > 1;
  const stackCountLabel =
    !item.equipable && typeof item.quantity === "number" && item.quantity > 0
      ? t("profile.stackCountLabel", { count: item.quantity })
      : null;

  return (
    <>
      <div className="inventoryCardTop">
        <div className="inventoryCardMeta">
          <h4>{renderItemDisplayName(item)}</h4>
          <p className="inventoryCardCategory">{subtypeLabel}</p>
        </div>
        <div className="inventoryCardTopAside">
          <span className="inventoryCardRarity">{formatRarityLabel((key) => t(key), item.rarity)}</span>
          {stackCountLabel ? <span className="inventoryCardStackCount">{stackCountLabel}</span> : null}
          {asideNote ? <span className="inventoryCardTopAsideNote">{asideNote}</span> : null}
        </div>
      </div>
      <div className={`inventoryCardVisual${canUseItem ? "" : " isRestricted"}${item.temperingFailed ? " isTemperingFailed" : ""}`}>
        {item.temperingFailed ? (
          <span className="inventoryTemperingFailedBadge" aria-label={t("forge.instabilityTitle")}>!</span>
        ) : null}
        {renderItemIcon({
          majorCategory: item.archetype.majorCategory,
          category: item.category,
          itemName: displayItemName,
          iconAssetPath,
          enchantLevel: item.enchanting?.level,
          className: useImageOnlyIcon ? undefined : `inventoryCardIcon${canUseItem ? "" : " isRestricted"}`,
          renderMode: useImageOnlyIcon ? "imageOnly" : "default"
        })}
      </div>
      <div className="inventoryCardContent">
        {weaponDamageSummary ? (
          <div className={`inventoryCardDamageBlock${item.temperingFailed ? " isTemperingFailed" : ""}`}>
            <p className="inventoryCardDamagePrimary">{weaponDamageSummary.damageLine}</p>
            <p className="inventoryCardDamageRollMeta">{weaponDamageSummary.rollLine}</p>
          </div>
        ) : null}
        {defenseSummary ? (
          <div className="inventoryCardDamageBlock">
            <p className="inventoryCardDamagePrimary">{defenseSummary.primaryLine}</p>
            {defenseSummary.secondaryLine ? (
              <p className="inventoryCardDamageRollMeta">{defenseSummary.secondaryLine}</p>
            ) : null}
          </div>
        ) : null}
        {modifierLines.length > 0 ? (
          <div className="inventoryCardModifierList">
            {modifierLines.map((line) => (
              <p key={line.id} className="inventoryCardModifierLine">
                <span className={`inventoryModifierTier ${getModifierTierClassName(line.tier)}`}>({line.tier})</span>{" "}
                <span>
                  {localizeKnownLabel((key) => t(key), line.label)} {line.value}
                </span>
              </p>
            ))}
          </div>
        ) : null}
        {item.temperingFailed ? (
          <div className="inventoryCardTemperingFailedWarning">
            <span>! {t("forge.instabilityTitle")}</span>
            <span>{t("forge.temperingFailedCardNote")}</span>
          </div>
        ) : null}
      </div>
      <div className="inventoryCardDetails">
        <p className="inventoryCardDescription inventoryCardFlavor">{item.description}</p>
        <div className="inventoryCardFooter">
          {showPowerFooter ? (
            <span className="inventoryCardPower">
              {t("inventory.power", { value: item.power })}
              {typeof powerDelta === "number" && powerDelta !== 0 ? (
                <span className={`inventoryCardPowerDelta ${powerDelta > 0 ? "positive" : "negative"}`}>
                  {" "}
                  ({powerDelta > 0 ? `+${powerDelta}` : powerDelta})
                </span>
              ) : null}
            </span>
          ) : <span />}
          {showLevelFooter ? (
            <span className={`inventoryCardLevel${canUseItem ? "" : " isRestricted"}`}>
              {t("inventory.requiredLevel", { value: item.levelRequirement })}
            </span>
          ) : stackCountLabel ? (
            <span className="inventoryCardLevel">{stackCountLabel}</span>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function RewardInventoryGrid(props: RewardInventoryGridProps): ReactElement | null {
  const { t } = useTranslation();
  const {
    hoverState,
    isClosing: isHoverClosing,
    showHoverOverlay,
    beginHideHoverOverlay
  } = useHoverOverlayPresence<HoverState>();
  const itemCardAttributeName = props.itemCardAttributeName ?? "data-message-reward-item";

  if (props.items.length === 0) {
    return null;
  }

  function handleMouseEnter(item: InventoryItem, hoverKey: string, cardElement: HTMLElement) {
    const equipment = props.playerState?.equipment;
    const comparisonSlotId = item.equipable && equipment ? getPreferredEquipSlot(item, equipment) : null;
    const comparisonItem = comparisonSlotId && equipment ? equipment[comparisonSlotId] : null;
    const rect = cardElement.getBoundingClientRect();
    const viewportPadding = 8;
    const gapPx = 12;
    const panelWidth = Math.min(360, Math.max(320, rect.width * 3));
    const maxHeight = Math.max(240, window.innerHeight - viewportPadding * 2);
    const estimatedPanelHeight = Math.min(maxHeight, comparisonItem && comparisonItem.id !== item.id ? 640 : 360);
    const leftSpace = rect.left - viewportPadding;
    const rightSpace = window.innerWidth - rect.right - viewportPadding;
    const canPlaceRight = rightSpace >= panelWidth + gapPx;
    const canPlaceLeft = leftSpace >= panelWidth + gapPx;
    let placeOnRight = rightSpace >= leftSpace;

    if (placeOnRight && !canPlaceRight && canPlaceLeft) {
      placeOnRight = false;
    } else if (!placeOnRight && !canPlaceLeft && canPlaceRight) {
      placeOnRight = true;
    } else if (!canPlaceLeft && !canPlaceRight) {
      placeOnRight = rightSpace >= leftSpace;
    }

    const unclampedLeft = placeOnRight ? rect.right + gapPx : rect.left - panelWidth - gapPx;
    const left = Math.round(
      Math.max(viewportPadding, Math.min(unclampedLeft, window.innerWidth - viewportPadding - panelWidth))
    );
    const top = Math.round(
      Math.max(viewportPadding, Math.min(rect.top, window.innerHeight - viewportPadding - estimatedPanelHeight))
    );

    showHoverOverlay({
      hoverKey,
      sourceItem: item,
      comparisonItem: comparisonItem && comparisonItem.id !== item.id ? comparisonItem : null,
      top,
      left,
      width: panelWidth,
      maxHeight
    });
  }

  function handleMouseLeave(hoverKey: string) {
    beginHideHoverOverlay((currentHover) => currentHover.hoverKey === hoverKey);
  }

  return (
    <>
      <div className="inventoryCards messagesRewardInventoryGrid">
        {props.items.map((item) => {
          const canUseItem = canPlayerUseItem(item, props.playerState);
          return (
            <article
              key={item.id}
              className={`inventoryItemCard rarity-${item.rarity}`}
              data-testid={`message-reward-item-${item.id}`}
              {...{ [itemCardAttributeName]: "true" }}
              onMouseEnter={(event) => handleMouseEnter(item, item.id, event.currentTarget)}
              onMouseLeave={() => handleMouseLeave(item.id)}
            >
              {renderInventoryItemCardBody(t, item, canUseItem)}
            </article>
          );
        })}
      </div>
      {hoverState
        ? createPortal(
            <div
              className={`inventoryComparisonOverlay${isHoverClosing ? " isClosing" : " isVisible"}`}
              style={{
                top: hoverState.top,
                left: hoverState.left,
                width: hoverState.width,
                maxHeight: hoverState.maxHeight
              }}
            >
              <div className="inventoryComparisonOverlayStack">
                <article className={`inventoryDetailCard inventoryHoverDetailCard rarity-${hoverState.sourceItem.rarity}`}>
                  {renderInventoryItemDetailCardBody(
                    t,
                    hoverState.sourceItem,
                    canPlayerUseItem(hoverState.sourceItem, props.playerState),
                    undefined,
                    hoverState.comparisonItem ? hoverState.sourceItem.power - hoverState.comparisonItem.power : 0
                  )}
                </article>
                {hoverState.comparisonItem ? (
                  <article className={`inventoryDetailCard inventoryComparisonCard rarity-${hoverState.comparisonItem.rarity}`}>
                    {renderInventoryItemDetailCardBody(
                      t,
                      hoverState.comparisonItem,
                      canPlayerUseItem(hoverState.comparisonItem, props.playerState),
                      "Equipped"
                    )}
                  </article>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
