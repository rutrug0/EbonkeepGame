import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type CSSProperties
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  FORGE_MAX_ENCHANT_LEVEL,
  FORGE_SAFE_ENCHANT_LEVEL,
  type ForgeAttemptResult,
  type ForgeState,
  getForgeAttemptCostDucats,
  getForgeCatalystRarity,
  getForgeDamageBonusBps,
  getForgeSuccessChancePct
} from "@ebonkeep/shared/forge";
import type { InventoryItem } from "@ebonkeep/shared/inventory";
import type { PlayerState } from "@ebonkeep/shared/player";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
import { getViewBackgroundStyle } from "../../lib/viewBackgrounds";
import { attemptForgeEnchant, cleanseForgeInstability, fetchForgeState } from "./api";

export type ForgePanelProps = {
  token: string | null;
  playerState: PlayerState | null;
  onPlayerStateChange: (next: PlayerState) => void;
};

type ForgeWeaponEntry = {
  item: InventoryItem;
  location: "equipped" | "inventory";
};

function normalizeItemNameForArtLookup(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getWeaponIconPath(item: InventoryItem): string | undefined {
  if (item.archetype.majorCategory !== "weapon" || !item.archetype.weaponArchetype) {
    return undefined;
  }
  return GENERATED_ITEM_ICON_PATHS[`weapon:${item.archetype.weaponArchetype}:${normalizeItemNameForArtLookup(item.itemName)}`];
}

function getItemDisplayName(item: InventoryItem): string {
  const enchantPrefix = item.enchanting?.level ? `+${item.enchanting.level} ` : "";
  const prefixName = item.prefix?.name ? `${item.prefix.name} ` : "";
  const affixName = item.affix?.name ? ` ${item.affix.name}` : "";
  return `${enchantPrefix}${prefixName}${item.itemName}${affixName}`.trim();
}

function getBaseDamageAverage(item: InventoryItem): number {
  const averageDamage = item.damageRoll?.averageDamage ?? 0;
  const bonusScaleBps = item.enchanting?.bonusScaleBps ?? 0;
  if (averageDamage <= 0 || bonusScaleBps <= 0) return averageDamage;
  return Math.round((averageDamage / (1 + bonusScaleBps / 10_000)) * 100) / 100;
}

function formatPercentFromBps(value: number): string {
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

function formatRarityLabel(value: InventoryItem["rarity"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ForgePanel({ token, playerState, onPlayerStateChange }: ForgePanelProps) {
  const { t } = useTranslation("common");
  const forgeSceneStyle = getViewBackgroundStyle("forge") as CSSProperties;
  const [forgeState, setForgeState] = useState<ForgeState | null>(null);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCleansing, setIsCleansing] = useState(false);
  const [spinResult, setSpinResult] = useState<ForgeAttemptResult | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ForgeAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showEnchantPicker, setShowEnchantPicker] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [forgeHover, setForgeHover] = useState<{ kind: "weapon" | "enchant"; style: CSSProperties } | null>(null);

  useEffect(() => {
    if (!token) {
      setForgeState(null);
      return;
    }
    let active = true;
    setError(null);
    void fetchForgeState(token)
      .then((nextState) => { if (active) setForgeState(nextState); })
      .catch((nextError) => {
        if (active) setError(nextError instanceof Error ? nextError.message : t("forge.loadFailed"));
      });
    return () => { active = false; };
  }, [token, t]);

  const weaponEntries = useMemo<ForgeWeaponEntry[]>(() => {
    if (!playerState) return [];
    const entries: ForgeWeaponEntry[] = [];
    if (playerState.equipment.weapon) {
      entries.push({ item: playerState.equipment.weapon, location: "equipped" });
    }
    for (const item of playerState.inventory) {
      if (item.archetype.majorCategory === "weapon") {
        entries.push({ item, location: "inventory" });
      }
    }
    return entries;
  }, [playerState]);

  useEffect(() => {
    if (!weaponEntries.length) { setSelectedWeaponId(null); return; }
    if (!selectedWeaponId || !weaponEntries.some((e) => e.item.id === selectedWeaponId)) {
      setSelectedWeaponId(weaponEntries[0]?.item.id ?? null);
    }
  }, [selectedWeaponId, weaponEntries]);

  const selectedWeaponEntry = weaponEntries.find((e) => e.item.id === selectedWeaponId) ?? weaponEntries[0] ?? null;
  const selectedWeapon = selectedWeaponEntry?.item ?? null;
  const currentEnchantLevel = selectedWeapon?.enchanting?.level ?? 0;
  const nextEnchantLevel = selectedWeapon && currentEnchantLevel < FORGE_MAX_ENCHANT_LEVEL ? currentEnchantLevel + 1 : null;
  const nextBonusBps = nextEnchantLevel ? getForgeDamageBonusBps(nextEnchantLevel) : null;
  const successChancePct = nextEnchantLevel ? getForgeSuccessChancePct(nextEnchantLevel) : null;
  const attemptCostDucats = nextEnchantLevel ? getForgeAttemptCostDucats(nextEnchantLevel) : null;
  const catalystRarity = nextEnchantLevel ? getForgeCatalystRarity(nextEnchantLevel) : null;
  const currentDamageAverage = selectedWeapon?.damageRoll?.averageDamage ?? 0;
  const baseDamageAverage = selectedWeapon ? getBaseDamageAverage(selectedWeapon) : 0;
  const projectedDamageAverage =
    nextBonusBps !== null
      ? Math.round(baseDamageAverage * (1 + nextBonusBps / 10_000) * 100) / 100
      : null;
  const hasInstability = Boolean(forgeState?.instability);
  const canAffordAttempt = attemptCostDucats !== null && (playerState?.currency.ducats ?? 0) >= attemptCostDucats;
  const canAffordCleanse = (forgeState?.instability?.cleanseCostDucats ?? 0) <= (playerState?.currency.ducats ?? 0);

  const animState = spinResult
    ? "spinning"
    : resolvedResult
      ? resolvedResult.outcome === "success" ? "success" : "failure"
      : "idle";

  const spinStyle = spinResult
    ? ({
        "--forge-orbit-end-angle": `${spinResult.spinTurns * 360 + (spinResult.landedAt === "weapon" ? 180 : 0)}deg`,
        "--forge-orbit-duration": `${Math.min(6.4, 3 + spinResult.spinTurns * 0.32).toFixed(2)}s`
      } as CSSProperties)
    : undefined;

  async function handleEnchant() {
    if (!token || !selectedWeapon || !nextEnchantLevel || isSubmitting || hasInstability) return;
    setError(null);
    setResolvedResult(null);
    setIsSubmitting(true);
    try {
      const response = await attemptForgeEnchant(token, { weaponItemId: selectedWeapon.id });
      startTransition(() => {
        onPlayerStateChange(response.playerState);
        setForgeState(response.forge);
        setSpinResult(response.result);
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("forge.attemptFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCleanse() {
    if (!token || !forgeState?.instability || isCleansing) return;
    setError(null);
    setIsCleansing(true);
    try {
      const response = await cleanseForgeInstability(token);
      startTransition(() => {
        onPlayerStateChange(response.playerState);
        setForgeState(response.forge);
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("forge.cleanseFailed"));
    } finally {
      setIsCleansing(false);
    }
  }

  if (!token || !playerState) {
    return (
      <section className="contentShell indoorSceneShell forgeSceneShell" style={forgeSceneStyle}>
        <section className="contentStack">
          <article className="contentCard forgeUnavailableCard">
            <h2>{t("menu.forge")}</h2>
            <p>{t("inventory.unavailable")}</p>
          </article>
        </section>
      </section>
    );
  }

  return (
    <>
    <section className="contentShell indoorSceneShell forgeSceneShell" style={forgeSceneStyle}>
      <div className="forgePanelRoot">

        {/* ── Top bar ─────────────────────────────────── */}
        <div className="forgeTopBar">
          <div className="forgeTopBarRight">
            <button type="button" className="forgeRulesButton" onClick={() => setShowRulesPanel(true)}>
              {t("forge.rulesButton")}
            </button>
          </div>
        </div>

        {error ? (
          <article className="contentCard forgeErrorCard"><p>{error}</p></article>
        ) : null}

        {/* ── Instability banner ───────────────────────── */}
        {forgeState?.instability ? (
          <div className="forgeInstabilityBanner">
            <div className="forgeInstabilityBannerBody">
              <span className="sectionEyebrow">{t("forge.instabilityTitle")}</span>
              <strong>{forgeState.instability.weaponName}</strong>
              <span>{t("forge.damagePenaltyLabel", { value: formatPercentFromBps(forgeState.instability.damagePenaltyBps) })}</span>
            </div>
            <button
              type="button"
              className="primaryButton forgeCleanseButton"
              onClick={handleCleanse}
              disabled={isCleansing || !canAffordCleanse}
            >
              {isCleansing
                ? t("forge.cleansing")
                : `${t("forge.cleanse")} (${forgeState.instability.cleanseCostDucats.toLocaleString()} ${t("currencies.ducats")})`}
            </button>
          </div>
        ) : null}

        {/* ── Main slot grid ───────────────────────────── */}
        <div className="forgeSlotGrid">

          {/* Left: Weapon slot */}
          <div className="forgeSlotColumn">
            <button
              type="button"
              className={`forgeSlot${selectedWeapon ? ` forgeSlot--filled rarity-${selectedWeapon.rarity}` : ""}`}
              onClick={() => setShowWeaponPicker(true)}
              disabled={spinResult !== null || isSubmitting}
              onMouseEnter={(e) => {
                if (!selectedWeapon) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const w = 300;
                const spaceRight = window.innerWidth - rect.right;
                const left = spaceRight >= w + 16 ? rect.right + 12 : rect.left - w - 12;
                setForgeHover({ kind: "weapon", style: { position: "fixed", top: Math.max(8, Math.min(rect.top, window.innerHeight - 480)), left: Math.max(8, left), width: w, zIndex: 9999, pointerEvents: "none" } });
              }}
              onMouseLeave={() => setForgeHover(null)}
            >
              {selectedWeapon ? (
                <>
                  <div className="forgeSlotVisual">
                    {getWeaponIconPath(selectedWeapon) ? (
                      <img src={getWeaponIconPath(selectedWeapon)} alt="" className="forgeSlotImage" draggable={false} />
                    ) : (
                      <span className="forgeSlotFallback">{selectedWeapon.itemName.charAt(0)}</span>
                    )}
                  </div>
                  <div className="forgeSlotMeta">
                    <strong>+{currentEnchantLevel} {selectedWeapon.itemName}</strong>
                  </div>
                </>
              ) : (
                <div className="forgeSlotEmpty">
                  <span className="forgeSlotEmptyIcon">⚔</span>
                  <span>{t("forge.weaponSlotEmpty")}</span>
                </div>
              )}
            </button>
          </div>

          {/* Center: Animation + controls */}
          <div className="forgeCenterColumn">
            <div className={`forgeAnvil forgeAnvil--${animState}`} style={spinStyle}>
              <div className="forgeRing forgeRing--outer" />
              <div className="forgeRing forgeRing--mid" />
              <div className="forgeRing forgeRing--inner" />
              <div
                className={`forgeOrbitTrack${spinResult ? " isSpinning" : ""}`}
                onAnimationEnd={() => {
                  if (spinResult) {
                    setResolvedResult(spinResult);
                    setSpinResult(null);
                  }
                }}
              >
                <div
                  className={`forgeOrbitOrb${
                    spinResult
                      ? ` is${spinResult.outcome === "success" ? "Success" : "Failure"}`
                      : resolvedResult
                        ? ` is${resolvedResult.outcome === "success" ? "Success" : "Failure"}`
                        : ""
                  }`}
                />
              </div>
              <div className="forgeAnvilCore">
                {spinResult ? (
                  <span className="forgeAnvilCoreText">{t("forge.resolving")}</span>
                ) : resolvedResult ? (
                  <span className={`forgeAnvilCoreResult${resolvedResult.outcome === "success" ? " isSuccess" : " isFailure"}`}>
                    {resolvedResult.outcome === "success" ? "✓" : "✕"}
                  </span>
                ) : null}
              </div>
              <div className="forgeSparks">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="forgeSpark" style={{ "--spark-index": i } as CSSProperties} />
                ))}
              </div>
            </div>

            {selectedWeapon ? (
              <div className="forgeSuccessChip">
                <span>{t("forge.successChance")}</span>
                <strong>{successChancePct !== null ? `${successChancePct}%` : "MAX"}</strong>
              </div>
            ) : null}

            <div className="forgeActionRow">
              <button
                type="button"
                className="primaryButton forgeAttemptButton"
                onClick={handleEnchant}
                disabled={!nextEnchantLevel || hasInstability || isSubmitting || spinResult !== null || !canAffordAttempt}
              >
                {isSubmitting ? t("forge.enchanting") : t("forge.enchantNow")}
              </button>
            </div>
            {attemptCostDucats !== null ? (
              <span className="forgeActionMeta">{t("forge.attemptCostLabel", { cost: attemptCostDucats.toLocaleString() })}</span>
            ) : null}

            {resolvedResult ? (
              <div className={`forgeResultBanner${resolvedResult.outcome === "success" ? " isSuccess" : " isFailure"}`}>
                <strong>
                  {resolvedResult.outcome === "success"
                    ? t("forge.resultSuccess", { level: resolvedResult.currentEnchantLevel })
                    : t("forge.resultReset")}
                </strong>
                <span>
                  {resolvedResult.outcome === "success"
                    ? t("forge.resultSuccessBody", { before: resolvedResult.damageBefore, after: resolvedResult.damageAfter })
                    : t("forge.resultResetBody", { penalty: formatPercentFromBps(forgeState?.instability?.damagePenaltyBps ?? 0) })}
                </span>
              </div>
            ) : null}
          </div>

          {/* Right: Enchant slot */}
          <div className="forgeSlotColumn">
            <button
              type="button"
              className={`forgeSlot${catalystRarity ? ` forgeSlot--filled rarity-${catalystRarity}` : ""}${!selectedWeapon ? " forgeSlot--locked" : ""}`}
              onClick={() => { if (selectedWeapon && nextEnchantLevel) setShowEnchantPicker(true); }}
              disabled={!selectedWeapon || !nextEnchantLevel || spinResult !== null || isSubmitting}
              onMouseEnter={(e) => {
                if (!catalystRarity) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const w = 280;
                const left = rect.left >= w + 16 ? rect.left - w - 12 : rect.right + 12;
                setForgeHover({ kind: "enchant", style: { position: "fixed", top: Math.max(8, Math.min(rect.top, window.innerHeight - 360)), left: Math.max(8, left), width: w, zIndex: 9999, pointerEvents: "none" } });
              }}
              onMouseLeave={() => setForgeHover(null)}
            >
              {catalystRarity && nextEnchantLevel ? (
                <>
                  <div className="forgeSlotVisual forgeCatalystVisual">
                    <img
                      src={`/assets/enchants/weapon_${catalystRarity}.png`}
                      alt=""
                      className="forgeSlotImage"
                      draggable={false}
                    />
                  </div>
                  <div className="forgeSlotMeta">
                    <strong>{formatRarityLabel(catalystRarity)} {t("forge.weaponCatalyst")}</strong>
                    {projectedDamageAverage !== null ? (
                      <span>{t("forge.damagePreview", { before: currentDamageAverage, after: projectedDamageAverage })}</span>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="forgeSlotEmpty">
                  <span className="forgeSlotEmptyIcon">✦</span>
                  <span>{!selectedWeapon ? t("forge.enchantSlotLocked") : t("forge.enchantSlotEmpty")}</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* ── Weapon picker modal ──────────────────────── */}
        {showWeaponPicker ? (
          <div
            className="forgePickerOverlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowWeaponPicker(false)}
          >
            <div className="forgePickerModal" onClick={(e) => e.stopPropagation()}>
              <div className="forgePickerHeader">
                <h3>{t("forge.weaponPickerTitle")}</h3>
                <button type="button" className="forgePickerClose" onClick={() => setShowWeaponPicker(false)}>×</button>
              </div>
              <div className="forgePickerList">
                {weaponEntries.length ? weaponEntries.map((entry) => {
                  const iconPath = getWeaponIconPath(entry.item);
                  const isSelected = entry.item.id === selectedWeapon?.id;
                  return (
                    <button
                      key={entry.item.id}
                      type="button"
                      className={`forgeWeaponCard rarity-${entry.item.rarity}${isSelected ? " isSelected" : ""}`}
                      onClick={() => { setSelectedWeaponId(entry.item.id); setShowWeaponPicker(false); }}
                    >
                      <div className="forgeWeaponCardVisual">
                        {iconPath ? (
                          <img src={iconPath} alt="" className="forgeWeaponCardImage" draggable={false} />
                        ) : (
                          <span className="forgeWeaponCardFallback">{entry.item.itemName.charAt(0)}</span>
                        )}
                      </div>
                      <div className="forgeWeaponCardBody">
                        <strong>{getItemDisplayName(entry.item)}</strong>
                        <span>{entry.location === "equipped" ? t("forge.equipped") : t("forge.inventory")}</span>
                        <span>{t("forge.weaponDamageLabel")}: {entry.item.damageRoll?.averageDamage ?? 0}</span>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="forgeEmptyState">
                    <h3>{t("forge.emptyTitle")}</h3>
                    <p>{t("forge.emptyBody")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Enchant picker modal ─────────────────────── */}
        {showEnchantPicker && selectedWeapon && nextEnchantLevel && catalystRarity ? (
          <div
            className="forgePickerOverlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowEnchantPicker(false)}
          >
            <div className="forgePickerModal forgeEnchantPickerModal" onClick={(e) => e.stopPropagation()}>
              <div className="forgePickerHeader">
                <h3>{t("forge.enchantPickerTitle")}</h3>
                <button type="button" className="forgePickerClose" onClick={() => setShowEnchantPicker(false)}>×</button>
              </div>
              <div className="forgeEnchantOption">
                <div className={`forgeEnchantOptionCard rarity-${catalystRarity}`}>
                  <img
                    src={`/assets/enchants/weapon_${catalystRarity}.png`}
                    alt=""
                    className="forgeEnchantOptionImage"
                    draggable={false}
                  />
                  <div className="forgeEnchantOptionDetails">
                    <strong>+{nextEnchantLevel} — {formatRarityLabel(catalystRarity)} {t("forge.weaponCatalyst")}</strong>
                    <span>{t("forge.successChance")}: {successChancePct}%</span>
                    <span>{t("forge.bonusAfterSuccess", { value: formatPercentFromBps(nextBonusBps ?? 0) })}</span>
                    {projectedDamageAverage !== null ? (
                      <span>{t("forge.damagePreview", { before: currentDamageAverage, after: projectedDamageAverage })}</span>
                    ) : null}
                    <span>{t("forge.attemptCostLabel", { cost: (attemptCostDucats ?? 0).toLocaleString() })}</span>
                    {nextEnchantLevel > FORGE_SAFE_ENCHANT_LEVEL ? (
                      <span className="forgeEnchantOptionWarning">{t("forge.ruleRisk")}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={() => setShowEnchantPicker(false)}
                >
                  {t("forge.enchantOptionConfirm")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Rules panel ──────────────────────────────── */}
        {showRulesPanel ? (
          <div className="forgeRulesPanelBackdrop" onClick={() => setShowRulesPanel(false)}>
            <aside className="forgeRulesPanel" onClick={(e) => e.stopPropagation()}>
              <div className="forgeRulesPanelHeader">
                <h3>{t("forge.rulesTitle")}</h3>
                <button type="button" className="forgePickerClose" onClick={() => setShowRulesPanel(false)}>×</button>
              </div>
              <div className="forgeRulesPanelBody">
                <p>{t("forge.subtitle")}</p>
                <div className="forgeRulesPanelChips">
                  <span className="forgeHeroChip">{t("forge.safeUntil", { level: FORGE_SAFE_ENCHANT_LEVEL })}</span>
                  <span className="forgeHeroChip">{t("forge.baseDamageOnly")}</span>
                </div>
                <ul className="forgeRuleList">
                  <li>{t("forge.ruleSafe", { level: FORGE_SAFE_ENCHANT_LEVEL })}</li>
                  <li>{t("forge.ruleRisk")}</li>
                  <li>{t("forge.ruleScale")}</li>
                </ul>
              </div>
            </aside>
          </div>
        ) : null}

      </div>
    </section>

    {/* ── Item hover card portal ───────────────────── */}
    {forgeHover && createPortal(
      forgeHover.kind === "weapon" && selectedWeapon ? (
        <article className={`inventoryDetailCard rarity-${selectedWeapon.rarity}`} style={forgeHover.style}>
          <div className="inventoryCardTop">
            <div className="inventoryCardMeta">
              <h4>{getItemDisplayName(selectedWeapon)}</h4>
              {selectedWeapon.archetype?.weaponArchetype ? (
                <p className="inventoryCardCategory">{selectedWeapon.archetype.weaponArchetype}</p>
              ) : null}
            </div>
            <div className="inventoryCardTopAside">
              <span className="inventoryCardRarity">{formatRarityLabel(selectedWeapon.rarity)}</span>
            </div>
          </div>
          {getWeaponIconPath(selectedWeapon) ? (
            <div className="inventoryCardVisual">
              <img className="itemVisualImageCard" src={getWeaponIconPath(selectedWeapon)} alt="" />
            </div>
          ) : null}
          <div className="inventoryCardContent">
            {currentDamageAverage > 0 ? (
              <div className="inventoryCardDamageBlock">
                <p className="inventoryCardDamagePrimary">{t("forge.weaponDamageLabel")}: {currentDamageAverage}</p>
              </div>
            ) : null}
          </div>
          <div className="inventoryCardDetails">
            <div className="inventoryCardFooter">
              <span className="inventoryCardPower">{t("inventory.power", { value: selectedWeapon.power })}</span>
              <span className="inventoryCardLevel">{t("inventory.requiredLevel", { value: selectedWeapon.levelRequirement })}</span>
            </div>
          </div>
        </article>
      ) : forgeHover.kind === "enchant" && catalystRarity && nextEnchantLevel ? (
        <article className={`inventoryDetailCard rarity-${catalystRarity}`} style={forgeHover.style}>
          <div className="inventoryCardTop">
            <div className="inventoryCardMeta">
              <h4>{formatRarityLabel(catalystRarity)} {t("forge.weaponCatalyst")}</h4>
              <p className="inventoryCardCategory">{t("forge.requiredForLevel", { level: nextEnchantLevel })}</p>
            </div>
            <div className="inventoryCardTopAside">
              <span className="inventoryCardRarity">{formatRarityLabel(catalystRarity)}</span>
            </div>
          </div>
          <div className="inventoryCardVisual">
            <img className="itemVisualImageCard" src={`/assets/enchants/weapon_${catalystRarity}.png`} alt="" />
          </div>
          <div className="inventoryCardContent">
            <div className="inventoryCardDamageBlock">
              <p className="inventoryCardDamagePrimary">{t("forge.bonusAfterSuccess", { value: formatPercentFromBps(nextBonusBps ?? 0) })}</p>
              {projectedDamageAverage !== null ? (
                <p className="inventoryCardDamageRollMeta">{t("forge.damagePreview", { before: currentDamageAverage, after: projectedDamageAverage })}</p>
              ) : null}
            </div>
          </div>
        </article>
      ) : null,
      document.body
    )}
  </>
  );
}
