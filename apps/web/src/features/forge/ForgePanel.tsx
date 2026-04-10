import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
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
  getEffectiveCatalystRarity,
  getForgeDamageBonusBps,
  getForgeSuccessChancePct
} from "@ebonkeep/shared/forge";
import { isItemUsableByClass, type InventoryItem, type ItemModifier, type ModifierTier } from "@ebonkeep/shared/inventory";
import type { PlayerState } from "@ebonkeep/shared/player";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
import { useHoverOverlayPresence } from "../../lib/useHoverOverlayPresence";
import { getViewBackgroundStyle } from "../../lib/viewBackgrounds";
import { attemptForgeEnchant, mendForgeWeapon, fetchForgeState } from "./api";

export type ForgePanelProps = {
  token: string | null;
  playerState: PlayerState | null;
  onPlayerStateChange: (next: PlayerState) => void;
  onFirstPaintReadyChange?: (ready: boolean) => void;
};

type ForgeWeaponEntry = {
  item: InventoryItem;
  location: "equipped" | "inventory";
};

type ForgeResolvePhase =
  | "idle"
  | "charge"
  | "chaos"
  | "feint"
  | "eclipse"
  | "reveal-success"
  | "reveal-failure"
  | "settle";

type ForgeResolveBeat = {
  startAngleDeg: number;
  targetAngleDeg: number;
  overshootDeg: number;
  durationMs: number;
};

type ForgeResolveSequence = {
  chargeMs: number;
  chaosMs: number;
  chaosStartAngleDeg: number;
  chaosEndAngleDeg: number;
  eclipseMs: number;
  revealMs: number;
  settleMs: number;
  feints: ForgeResolveBeat[];
};

type ForgeItemModifierLine = {
  id: string;
  tier: ModifierTier;
  label: string;
  value: string;
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

function formatOneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function getModifierTierClassName(tier: ModifierTier): string {
  if (tier === "T1") {
    return "modifierTier-t1";
  }
  if (tier === "T2") {
    return "modifierTier-t2";
  }
  return "modifierTier-t3";
}

function formatPercentFromBps(value: number): string {
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

function formatRarityLabel(value: InventoryItem["rarity"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + ((max - min) * Math.random()));
}

function normalizeAngleDeg(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

function createForgeResolveSequence(prefersReducedMotion: boolean): ForgeResolveSequence {
  if (prefersReducedMotion) {
    return {
      chargeMs: randomBetween(160, 220),
      chaosMs: 0,
      chaosStartAngleDeg: 0,
      chaosEndAngleDeg: 0,
      eclipseMs: 0,
      revealMs: randomBetween(220, 280),
      settleMs: randomBetween(160, 220),
      feints: []
    };
  }

  const chargeMs = randomBetween(700, 1100);
  const chaosMs = randomBetween(1400, 2400);
  const chaosStartAngleDeg = randomBetween(-30, 30);
  const chaosDirection = Math.random() < 0.5 ? -1 : 1;
  const chaosRevolutions = randomBetween(6, 10);
  const chaosEndAngleDeg = chaosStartAngleDeg + (chaosDirection * chaosRevolutions * 360) + randomBetween(-24, 24);
  const feintCount = randomBetween(2, 4);
  const feintTotalMs = randomBetween(1200, 2800);
  const baseFeintMs = Math.max(320, Math.round(feintTotalMs / feintCount));
  const startTarget: "top" | "bottom" = Math.random() < 0.5 ? "top" : "bottom";
  const feints: ForgeResolveBeat[] = [];
  let currentStartAngle = normalizeAngleDeg(chaosEndAngleDeg);

  for (let index = 0; index < feintCount; index += 1) {
    const target = index % 2 === 0
      ? startTarget
      : startTarget === "top"
        ? "bottom"
        : "top";

    const targetAngleDeg = normalizeAngleDeg((target === "top" ? 0 : 180) + randomBetween(-18, 18));
    const overshootDeg = (Math.random() < 0.5 ? -1 : 1) * randomBetween(16, 34);
    const durationMs = Math.max(300, baseFeintMs + randomBetween(-140, 180));

    feints.push({
      startAngleDeg: currentStartAngle,
      targetAngleDeg,
      overshootDeg,
      durationMs
    });

    currentStartAngle = targetAngleDeg;
  }

  return {
    chargeMs,
    chaosMs,
    chaosStartAngleDeg,
    chaosEndAngleDeg,
    eclipseMs: randomBetween(280, 360),
    revealMs: randomBetween(600, 800),
    settleMs: randomBetween(400, 600),
    feints
  };
}

function renderForgeOrb(className: string) {
  return (
    <div className={className}>
      <span className="forgeOrbAura" />
      <span className="forgeOrbHalo" />
      <span className="forgeOrbRune" />
      <span className="forgeOrbRune forgeOrbRune--echo" />
      <span className="forgeOrbTail" />
      <span className="forgeOrbTail forgeOrbTail--echo" />
      <span className="forgeOrbTailRibbon forgeOrbTailRibbon--one" />
      <span className="forgeOrbTailRibbon forgeOrbTailRibbon--two" />
    </div>
  );
}

export function ForgePanel({ token, playerState, onPlayerStateChange, onFirstPaintReadyChange }: ForgePanelProps) {
  const { t } = useTranslation("common");
  const forgeSceneStyle = getViewBackgroundStyle("forge") as CSSProperties;
  const [forgeState, setForgeState] = useState<ForgeState | null>(null);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCleansing, setIsCleansing] = useState(false);
  const [pendingResult, setPendingResult] = useState<ForgeAttemptResult | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ForgeAttemptResult | null>(null);
  const [resolveSequence, setResolveSequence] = useState<ForgeResolveSequence | null>(null);
  const [resolvePhase, setResolvePhase] = useState<ForgeResolvePhase>("idle");
  const [resolveBeatIndex, setResolveBeatIndex] = useState<number>(-1);
  const [orbMotionKey, setOrbMotionKey] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showEnchantPicker, setShowEnchantPicker] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const {
    hoverState: forgeHover,
    isClosing: isForgeHoverClosing,
    showHoverOverlay: showForgeHover,
    beginHideHoverOverlay: beginHideForgeHover
  } = useHoverOverlayPresence<{ kind: "weapon" | "enchant"; style: CSSProperties }>();
  const resolveTimeoutsRef = useRef<number[]>([]);
  const activeResolveRunRef = useRef(0);
  const pendingPlayerStateRef = useRef<PlayerState | null>(null);
  const pendingForgeStateRef = useRef<ForgeState | null>(null);

  function clearResolveTimeline(options?: { preservePendingState?: boolean }) {
    for (const timeoutId of resolveTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    resolveTimeoutsRef.current = [];
    activeResolveRunRef.current += 1;

    if (!options?.preservePendingState) {
      pendingPlayerStateRef.current = null;
      pendingForgeStateRef.current = null;
    }
  }

  function restartOrbMotion() {
    setOrbMotionKey((currentKey) => currentKey + 1);
  }

  function queueResolveStep(runId: number, delayMs: number, callback: () => void) {
    const timeoutId = window.setTimeout(() => {
      if (activeResolveRunRef.current !== runId) {
        return;
      }
      callback();
    }, Math.max(0, delayMs));

    resolveTimeoutsRef.current.push(timeoutId);
  }

  function commitPendingResolveState() {
    const nextPlayerState = pendingPlayerStateRef.current;
    const nextForgeState = pendingForgeStateRef.current;

    if (!nextPlayerState || !nextForgeState) {
      return;
    }

    startTransition(() => {
      onPlayerStateChange(nextPlayerState);
      setForgeState(nextForgeState);
    });

    pendingPlayerStateRef.current = null;
    pendingForgeStateRef.current = null;
  }

  function commitPendingResolveStateOnUnmount() {
    const nextPlayerState = pendingPlayerStateRef.current;

    if (!nextPlayerState) {
      return;
    }

    onPlayerStateChange(nextPlayerState);
    pendingPlayerStateRef.current = null;
    pendingForgeStateRef.current = null;
  }

  function beginResolveSequence(args: {
    result: ForgeAttemptResult;
    playerState: PlayerState;
    forge: ForgeState;
  }) {
    clearResolveTimeline();

    const runId = activeResolveRunRef.current;
    const nextSequence = createForgeResolveSequence(prefersReducedMotion);
    const { result } = args;

    pendingPlayerStateRef.current = args.playerState;
    pendingForgeStateRef.current = args.forge;

    setResolvedResult(null);
    setPendingResult(result);
    setResolveSequence(nextSequence);
    setResolveBeatIndex(-1);
    setResolvePhase("charge");
    restartOrbMotion();

    const beginEclipse = () => {
      setResolveBeatIndex(-1);
      setResolvePhase("eclipse");
      restartOrbMotion();

      queueResolveStep(runId, nextSequence.eclipseMs, () => {
        commitPendingResolveState();
        setResolvedResult(result);
        setResolvePhase(result.outcome === "success" ? "reveal-success" : "reveal-failure");
        restartOrbMotion();

        queueResolveStep(runId, nextSequence.revealMs, () => {
          setResolvePhase("settle");
          restartOrbMotion();

          queueResolveStep(runId, nextSequence.settleMs, () => {
            setPendingResult(null);
            setResolveSequence(null);
            setResolveBeatIndex(-1);
            setResolvePhase("idle");
          });
        });
      });
    };

    const playFeint = (beatIndex: number) => {
      if (beatIndex >= nextSequence.feints.length) {
        beginEclipse();
        return;
      }

      setResolveBeatIndex(beatIndex);
      setResolvePhase("feint");
      restartOrbMotion();

      queueResolveStep(runId, nextSequence.feints[beatIndex]?.durationMs ?? 0, () => {
        playFeint(beatIndex + 1);
      });
    };

    const beginChaos = () => {
      if (nextSequence.chaosMs <= 0) {
        if (nextSequence.feints.length > 0) {
          playFeint(0);
          return;
        }

        beginEclipse();
        return;
      }

      setResolvePhase("chaos");
      restartOrbMotion();

      queueResolveStep(runId, nextSequence.chaosMs, () => {
        if (nextSequence.feints.length > 0) {
          playFeint(0);
          return;
        }

        beginEclipse();
      });
    };

    queueResolveStep(runId, nextSequence.chargeMs, beginChaos);
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    syncMotionPreference();
    mediaQuery.addEventListener("change", syncMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", syncMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      clearResolveTimeline();
      setForgeState(null);
      setPendingResult(null);
      setResolvedResult(null);
      setResolveSequence(null);
      setResolveBeatIndex(-1);
      setResolvePhase("idle");
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

  useEffect(() => () => {
    commitPendingResolveStateOnUnmount();
    clearResolveTimeline();
  }, []);

  useEffect(() => {
    onFirstPaintReadyChange?.(Boolean(token) && Boolean(playerState) && Boolean(forgeState));
  }, [token, playerState, forgeState, onFirstPaintReadyChange]);

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
  const catalystRarity = nextEnchantLevel && selectedWeapon ? getEffectiveCatalystRarity(nextEnchantLevel, selectedWeapon.rarity) : null;
  const currentDamageAverage = selectedWeapon?.damageRoll?.averageDamage ?? 0;
  const baseDamageAverage = selectedWeapon ? getBaseDamageAverage(selectedWeapon) : 0;
  const projectedDamageAverage =
    nextBonusBps !== null
      ? Math.round(baseDamageAverage * (1 + nextBonusBps / 10_000) * 100) / 100
      : null;
  const hasInstability = Boolean(forgeState?.instability);
  const unstableWeaponItemId = forgeState?.instability?.weaponItemId ?? null;
  const unlimitedForgeConsumables = Boolean(playerState?.cheatSettings?.unlimitedForgeConsumablesEnabled);
  const canAffordAttempt = unlimitedForgeConsumables || (attemptCostDucats !== null && (playerState?.currency.ducats ?? 0) >= attemptCostDucats);
  const hasTemeringDraught = unlimitedForgeConsumables || Boolean(
    playerState?.inventory?.some((item) => item.itemCode === "all_tempering_draught")
  );
  const selectedWeaponIsUnstable = Boolean(selectedWeapon && unstableWeaponItemId === selectedWeapon.id);
  // Mend mode: selected weapon is damaged (temperingFailed) — show repair UI instead of enchant UI
  const isMendMode = Boolean(selectedWeapon?.temperingFailed);

  const isResolving = pendingResult !== null;
  const currentFeint = resolveBeatIndex >= 0 ? resolveSequence?.feints[resolveBeatIndex] ?? null : null;
  const resolveStyle = {
    "--forge-chaos-duration": `${resolveSequence?.chaosMs ?? 1800}ms`,
    "--forge-chaos-start-angle": `${resolveSequence?.chaosStartAngleDeg ?? 0}deg`,
    "--forge-chaos-end-angle": `${resolveSequence?.chaosEndAngleDeg ?? 2520}deg`,
    "--forge-feint-from-angle": `${currentFeint?.startAngleDeg ?? 0}deg`,
    "--forge-feint-angle": `${currentFeint?.targetAngleDeg ?? 180}deg`,
    "--forge-feint-overshoot": `${currentFeint?.overshootDeg ?? 20}deg`,
    "--forge-feint-duration": `${currentFeint?.durationMs ?? 480}ms`
  } as CSSProperties;
  const anvilClassName = `forgeAnvil forgeAnvil--phase-${resolvePhase}${
    resolvedResult ? ` forgeAnvil--result-${resolvedResult.outcome === "success" ? "success" : "failure"}` : ""
  }${isResolving ? " forgeAnvil--isResolving" : ""}`;
  const resolveOutcomeClassName = resolvedResult
    ? ` forgeSlot--result-${resolvedResult.outcome === "success" ? "success" : "failure"}`
    : "";
  const weaponSlotClassName = `forgeSlot forgeSlot--role-weapon forgeSlot--phase-${resolvePhase}${
    selectedWeapon ? ` forgeSlot--filled rarity-${selectedWeapon.rarity}` : ""
  }${isResolving ? " forgeSlot--isResolving" : ""}${resolveOutcomeClassName}${
    selectedWeaponIsUnstable ? " forgeSlot--unstable" : ""
  }`;
  const catalystSlotClassName = `forgeSlot forgeSlot--role-catalyst forgeSlot--phase-${resolvePhase}${
    catalystRarity ? ` forgeSlot--filled rarity-${catalystRarity}` : ""
  }${!selectedWeapon ? " forgeSlot--locked" : ""}${isResolving ? " forgeSlot--isResolving" : ""}${resolveOutcomeClassName}`;

  const renderForgeItemStatusBadge = (item: InventoryItem) => {
    if (unstableWeaponItemId === item.id || item.temperingFailed) {
      return (
        <span className="itemVisualEnchantBadge isUnstable" aria-hidden="true">
          !
        </span>
      );
    }

    return item.enchanting?.level ? (
      <span className="itemVisualEnchantBadge" aria-hidden="true">{`+${item.enchanting.level}`}</span>
    ) : null;
  };

  const formatModifierStatLabel = (stat: string): string => {
    const knownLabels: Record<string, string> = {
      strength: "Strength",
      intelligence: "Intelligence",
      dexterity: "Dexterity",
      vitality: "Vitality",
      initiative: "Initiative",
      luck: "Luck",
      armor: t("profile.armor"),
      spellShield: t("profile.spellShield"),
      missileResistance: t("profile.missileResistance"),
      meleeDamage: t("profile.meleeDamage"),
      rangedDamage: t("profile.rangedDamage"),
      spellDamage: t("profile.spellDamage"),
      critChance: t("profile.critChance"),
      critDamage: t("profile.critDamage"),
      extraAttackChance: t("profile.extraAttackChance"),
      threat: "Threat",
      maxHitpoints: t("profile.maxHitpoints"),
      healingPower: t("profile.healingPower"),
      lifeOnHit: t("profile.lifeOnHit"),
      moveSpeed: t("profile.moveSpeed"),
      physicalDefense: t("profile.physicalDefense"),
      magicDefense: t("profile.magicDefense")
    };

    return knownLabels[stat] ?? stat;
  };

  const formatModifierValue = (value: number, unit: ItemModifier["unit"]): string => {
    if (unit === "basis_points") {
      return `${value >= 0 ? "+" : ""}${formatOneDecimal(value / 100)}%`;
    }
    return `${value >= 0 ? "+" : ""}${value}`;
  };

  const formatArchetypeLabel = (value: string): string => {
    const translated = t(`archetype.${value}`);
    return translated && translated !== `archetype.${value}`
      ? translated
      : value.charAt(0).toUpperCase() + value.slice(1);
  };

  const getItemSubtypeLabel = (item: InventoryItem): string => {
    if (item.archetype?.majorCategory === "armor" && item.archetype.armorArchetype) {
      return `${formatArchetypeLabel(item.archetype.armorArchetype)} ${t("profile.armor")}`;
    }
    if (item.archetype?.majorCategory === "weapon" && item.archetype.weaponArchetype) {
      return `${formatArchetypeLabel(item.archetype.weaponArchetype)} ${t("slots.weapon")}`;
    }
    return item.category;
  };

  const getItemModifierStatLines = (item: InventoryItem): ForgeItemModifierLine[] => {
    const lines: ForgeItemModifierLine[] = [];
    if (item.prefix) {
      lines.push({
        id: `${item.id}-prefix`,
        tier: item.prefix.tier,
        label: formatModifierStatLabel(item.prefix.statKey),
        value: formatModifierValue(item.prefix.value, item.prefix.unit)
      });
    }
    if (item.affix) {
      lines.push({
        id: `${item.id}-affix`,
        tier: item.affix.tier,
        label: formatModifierStatLabel(item.affix.statKey),
        value: formatModifierValue(item.affix.value, item.affix.unit)
      });
    }
    return lines;
  };

  const getWeaponDamageSummary = (item: InventoryItem): { damageLine: string; rollLine: string } | null => {
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
  };

  const getDefenseSummary = (item: InventoryItem): { primaryLine: string; secondaryLine?: string } | null => {
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
  };

  const canUseForgeItem = (item: InventoryItem): boolean => {
    if (!item.equipable || !item.archetype || !playerState) {
      return true;
    }
    const archetypeClassKey = item.archetype.weaponArchetype ?? item.archetype.armorArchetype;
    return isItemUsableByClass(playerState.class, item.archetype.majorCategory, archetypeClassKey)
      && playerState.level >= item.levelRequirement;
  };

  async function handleEnchant() {
    if (!token || !selectedWeapon || !nextEnchantLevel || isSubmitting || hasInstability || isResolving) return;
    setError(null);
    setResolvedResult(null);
    setIsSubmitting(true);
    try {
      const response = await attemptForgeEnchant(token, { weaponItemId: selectedWeapon.id });
      if (unlimitedForgeConsumables) {
        startTransition(() => {
          onPlayerStateChange(response.playerState);
          setForgeState(response.forge);
          setResolvedResult(null);
          setResolvePhase("idle");
        });
      } else {
        beginResolveSequence({
          result: response.result,
          playerState: response.playerState,
          forge: response.forge
        });
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("forge.attemptFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCleanse() {
    const weaponItemId = forgeState?.instability?.weaponItemId;
    if (!token || !weaponItemId || isCleansing) return;
    setError(null);
    setIsCleansing(true);
    try {
      const response = await mendForgeWeapon(token, weaponItemId);
      startTransition(() => {
        onPlayerStateChange(response.playerState);
        setForgeState(response.forge);
        setResolvedResult(null);
        setResolvePhase("idle");
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("forge.mendFailed"));
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


        {/* ── Main slot grid ───────────────────────────── */}
        <div className="forgeSlotGrid">

          {/* Left: Weapon slot */}
          <div className="forgeSlotColumn">
            <button
              type="button"
              className={weaponSlotClassName}
              onClick={() => setShowWeaponPicker(true)}
              disabled={isResolving || isSubmitting}
              onMouseEnter={(e) => {
                if (!selectedWeapon) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const w = 300;
                const spaceRight = window.innerWidth - rect.right;
                const left = spaceRight >= w + 16 ? rect.right + 12 : rect.left - w - 12;
                showForgeHover({ kind: "weapon", style: { position: "fixed", top: Math.max(8, Math.min(rect.top, window.innerHeight - 480)), left: Math.max(8, left), width: w, zIndex: 9999, pointerEvents: "none" } });
              }}
              onMouseLeave={() => beginHideForgeHover((currentHover) => currentHover.kind === "weapon")}
            >
              {selectedWeapon ? (
                <>
                  <div className="forgeSlotVisual">
                    {getWeaponIconPath(selectedWeapon) ? (
                      <span className="itemVisualFrame itemVisualFrame--imageOnly forgeSlotItemFrame" aria-hidden="true">
                        <img
                          src={getWeaponIconPath(selectedWeapon)}
                          alt=""
                          className="itemVisualImage itemVisualImageCard"
                          draggable={false}
                        />
                        {renderForgeItemStatusBadge(selectedWeapon)}
                      </span>
                    ) : (
                      <span className="itemVisualFrame forgeSlotItemFrame" aria-hidden="true">
                        <span className="forgeSlotFallback">{selectedWeapon.itemName.charAt(0)}</span>
                        {renderForgeItemStatusBadge(selectedWeapon)}
                      </span>
                    )}
                    <span className="equipmentSlotPower forgeSlotPower" aria-hidden="true">
                      {selectedWeapon.power}
                    </span>
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
            <div className={anvilClassName} style={resolveStyle}>
              <div className="forgeAtmosphere">
                <div className="forgeHeatHaze forgeHeatHaze--one" />
                <div className="forgeHeatHaze forgeHeatHaze--two" />
              </div>
              <div className="forgeRing forgeRing--outer">
                <div className="forgeRingTicks" />
              </div>
              <div className="forgeRing forgeRing--mid" />
              <div className="forgeRing forgeRing--inner">
                {[...Array(8)].map((_, index) => (
                  <span
                    key={index}
                    className="forgeRingSegment"
                    style={{ "--segment-index": index } as CSSProperties}
                  />
                ))}
              </div>
              <div className="forgeStabilizers" aria-hidden="true">
                {[...Array(3)].map((_, index) => (
                  <span
                    key={index}
                    className={`forgeStabilizer forgeStabilizer--${index + 1}`}
                  />
                ))}
                <span className="forgeStabilityField forgeStabilityField--outer" />
                <span className="forgeStabilityField forgeStabilityField--inner" />
                <span className="forgeLockReticle forgeLockReticle--ring" />
                <span className="forgeLockReticle forgeLockReticle--cross" />
              </div>
              <div className="forgeOrbitLayer" key={orbMotionKey}>
                {resolvePhase === "charge" ? (
                  renderForgeOrb("forgeOrb forgeOrb--charging")
                ) : null}
                {resolvePhase === "chaos" ? (
                  <div className="forgeOrbitMotion forgeOrbitMotion--chaos">
                    {renderForgeOrb("forgeOrbitOrb")}
                  </div>
                ) : null}
                {resolvePhase === "feint" && currentFeint ? (
                  <div className="forgeOrbitMotion forgeOrbitMotion--feint">
                    {renderForgeOrb("forgeOrbitOrb")}
                  </div>
                ) : null}
                {resolvePhase === "eclipse" ? (
                  renderForgeOrb("forgeOrb forgeOrb--eclipse")
                ) : null}
                {resolvePhase === "reveal-success" ? (
                  renderForgeOrb("forgeOrb forgeOrb--successFinish")
                ) : null}
                {resolvePhase === "reveal-failure" ? (
                  renderForgeOrb("forgeOrb forgeOrb--failureFinish")
                ) : null}
              </div>
              <div className="forgeAnvilCore">
                <div className="forgeAnvilEmber" />
                <div className="forgeAnvilShutters" aria-hidden="true">
                  {[...Array(4)].map((_, index) => (
                    <span key={index} className={`forgeAnvilShutter forgeAnvilShutter--${index + 1}`} />
                  ))}
                </div>
                <div className="forgeAnvilCoreInner">
                  {isResolving && !resolvedResult ? (
                    <span className="forgeAnvilCoreText">{t("forge.resolving")}</span>
                  ) : resolvedResult ? (
                    <span className={`forgeAnvilCoreResult${resolvedResult.outcome === "success" ? " isSuccess" : " isFailure"}`}>
                      {resolvedResult.outcome === "success" ? "\u2713" : "\u2715"}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="forgeSparks">
                {[...Array(10)].map((_, index) => (
                  <div key={index} className="forgeSpark" style={{ "--spark-index": index } as CSSProperties} />
                ))}
              </div>
              <div className="forgeAsh" aria-hidden="true">
                {[...Array(6)].map((_, index) => (
                  <span key={index} className="forgeAshParticle" style={{ "--ash-index": index } as CSSProperties} />
                ))}
              </div>
              <div className="forgeFinishFx" aria-hidden="true">
                {resolvePhase === "reveal-success" ? (
                  <>
                    <span className="forgeFinishWave forgeFinishWave--success" />
                    <span className="forgeFinishSigil forgeFinishSigil--success" />
                    {[...Array(6)].map((_, index) => (
                      <span
                        key={`success-ray-${index}`}
                        className="forgeFinishRay"
                        style={{ "--finish-index": index } as CSSProperties}
                      />
                    ))}
                    {[...Array(6)].map((_, index) => (
                      <span
                        key={`success-mote-${index}`}
                        className="forgeFinishMote forgeFinishMote--success"
                        style={{ "--finish-index": index } as CSSProperties}
                      />
                    ))}
                  </>
                ) : null}
                {resolvePhase === "reveal-failure" ? (
                  <>
                    <span className="forgeFinishWave forgeFinishWave--failure" />
                    <span className="forgeFinishSigil forgeFinishSigil--failure" />
                    {[...Array(8)].map((_, index) => (
                      <span
                        key={`failure-shard-${index}`}
                        className="forgeFinishShard"
                        style={{ "--finish-index": index } as CSSProperties}
                      />
                    ))}
                    {[...Array(6)].map((_, index) => (
                      <span
                        key={`failure-ember-${index}`}
                        className="forgeFinishMote forgeFinishMote--failure"
                        style={{ "--finish-index": index } as CSSProperties}
                      />
                    ))}
                  </>
                ) : null}
              </div>
            </div>

            {selectedWeapon ? (
              <div className="forgeSuccessChip">
                <span>{t("forge.successChance")}</span>
                <strong>{isMendMode ? "100%" : (successChancePct !== null ? `${successChancePct}%` : "MAX")}</strong>
              </div>
            ) : null}

            <div className="forgeActionRow">
              {isMendMode ? (
                <button
                  type="button"
                  className="primaryButton forgeAttemptButton"
                  onClick={handleCleanse}
                  disabled={isCleansing || !hasTemeringDraught || !forgeState?.instability}
                >
                  {isCleansing ? t("forge.mending") : t("forge.mendWeapon")}
                </button>
              ) : (
                <button
                  type="button"
                  className="primaryButton forgeAttemptButton"
                  onClick={handleEnchant}
                  disabled={!nextEnchantLevel || hasInstability || isSubmitting || isResolving || !canAffordAttempt}
                >
                  {isSubmitting ? t("forge.enchanting") : t("forge.enchantNow")}
                </button>
              )}
            </div>
            {!isMendMode && attemptCostDucats !== null ? (
              <span className="forgeActionMeta">{t("forge.attemptCostLabel", { cost: attemptCostDucats.toLocaleString() })}</span>
            ) : null}

            {forgeState?.instability && !isMendMode ? (
              <div className={`forgeInstabilityInline${selectedWeaponIsUnstable ? " isSelectedWeapon" : ""}`}>
                <div className="forgeInstabilityInlineBody">
                  <span className="forgeInstabilityInlineTitle">⚠ {t("forge.instabilityTitle")}</span>
                  <strong>{forgeState.instability.weaponName}</strong>
                  <span>{t("forge.damagePenaltyLabel", { value: formatPercentFromBps(forgeState.instability.damagePenaltyBps) })}</span>
                  <span className="forgeInstabilityRequirement">{t("forge.mendRequirement")}</span>
                </div>
                <button
                  type="button"
                  className="primaryButton forgeCleanseButton"
                  onClick={handleCleanse}
                  disabled={isCleansing || !hasTemeringDraught}
                >
                  {isCleansing
                    ? t("forge.mending")
                    : t("forge.mendWeapon")}
                </button>
              </div>
            ) : null}

          </div>

          {/* Right: Mend slot (damaged weapon selected) or Enchant slot */}
          <div className="forgeSlotColumn">
            {isMendMode ? (
              <div className={`forgeSlot forgeSlot--role-catalyst${hasTemeringDraught ? " forgeSlot--filled rarity-uncommon" : ""}`}>
                {hasTemeringDraught ? (
                  <>
                    <div className="forgeSlotVisual forgeCatalystVisual">
                      <img
                        src="/assets/materials/mat_tempering_draught.png"
                        alt=""
                        className="forgeSlotImage"
                        draggable={false}
                      />
                    </div>
                    <div className="forgeSlotMeta">
                      <strong>{t("forge.temperingDraught")}</strong>
                      <span>{t("forge.mendRequirement")}</span>
                    </div>
                  </>
                ) : (
                  <div className="forgeSlotEmpty">
                    <img
                      src="/assets/materials/mat_tempering_draught.png"
                      alt=""
                      className="forgeSlotEmptyIcon"
                      style={{ width: 40, height: 40, opacity: 0.35, objectFit: "contain" }}
                      draggable={false}
                    />
                    <span>{t("forge.mendSlotEmpty")}</span>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className={catalystSlotClassName}
                onClick={() => { if (selectedWeapon && nextEnchantLevel) setShowEnchantPicker(true); }}
                disabled={!selectedWeapon || !nextEnchantLevel || isResolving || isSubmitting}
                onMouseEnter={(e) => {
                  if (!catalystRarity) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const w = 280;
                  const left = rect.left >= w + 16 ? rect.left - w - 12 : rect.right + 12;
                showForgeHover({ kind: "enchant", style: { position: "fixed", top: Math.max(8, Math.min(rect.top, window.innerHeight - 360)), left: Math.max(8, left), width: w, zIndex: 9999, pointerEvents: "none" } });
              }}
              onMouseLeave={() => beginHideForgeHover((currentHover) => currentHover.kind === "enchant")}
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
            )}
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
                      onClick={() => { setSelectedWeaponId(entry.item.id); setShowWeaponPicker(false); setResolvedResult(null); setResolvePhase("idle"); }}
                    >
                        <div className="forgeWeaponCardVisual">
                          {iconPath ? (
                            <span className="itemVisualFrame itemVisualFrame--imageOnly" aria-hidden="true">
                              <img src={iconPath} alt="" className="forgeWeaponCardImage" draggable={false} />
                              {renderForgeItemStatusBadge(entry.item)}
                            </span>
                          ) : (
                            <span className="itemVisualFrame" aria-hidden="true">
                              <span className="forgeWeaponCardFallback">{entry.item.itemName.charAt(0)}</span>
                              {renderForgeItemStatusBadge(entry.item)}
                            </span>
                          )}
                        </div>
                      <div className="forgeWeaponCardBody">
                        <strong>{getItemDisplayName(entry.item)}</strong>
                        <span>{entry.location === "equipped" ? t("forge.equipped") : t("forge.inventory")}</span>
                        {entry.item.temperingFailed ? (
                          <span className="forgeWeaponCardDamagedLabel">{t("forge.needsMending")}</span>
                        ) : (
                          <span>{t("forge.weaponDamageLabel")}: {entry.item.damageRoll?.averageDamage ?? 0}</span>
                        )}
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
      <div
        className={`inventoryComparisonOverlay${isForgeHoverClosing ? " isClosing" : " isVisible"}`}
        style={{ ...forgeHover.style, width: undefined }}
      >
        {forgeHover.kind === "weapon" && selectedWeapon ? (
        <article
          className={`inventoryDetailCard inventoryHoverDetailCard rarity-${selectedWeapon.rarity}`}
          style={forgeHover.style.width ? { width: forgeHover.style.width, maxWidth: forgeHover.style.width } : undefined}
        >
          {(() => {
            const canUseItem = canUseForgeItem(selectedWeapon);
            const displayItemName = getItemDisplayName(selectedWeapon);
            const useImageOnlyIcon = Boolean(getWeaponIconPath(selectedWeapon));
            const modifierLines = getItemModifierStatLines(selectedWeapon);
            const weaponDamageSummary = getWeaponDamageSummary(selectedWeapon);
            const defenseSummary = getDefenseSummary(selectedWeapon);

            return (
              <>
                <div className="inventoryCardTop">
                  <div className="inventoryCardMeta">
                    <h4>
                      {selectedWeapon.enchanting?.level ? <span>{`+${selectedWeapon.enchanting.level} `}</span> : null}
                      {selectedWeapon.prefix ? <>{selectedWeapon.prefix.name} </> : null}
                      <span>{selectedWeapon.itemName}</span>
                      {selectedWeapon.affix ? <> {selectedWeapon.affix.name}</> : null}
                    </h4>
                    <p className="inventoryCardCategory">{getItemSubtypeLabel(selectedWeapon)}</p>
                  </div>
                  <div className="inventoryCardTopAside">
                    <span className="inventoryCardRarity">{formatRarityLabel(selectedWeapon.rarity)}</span>
                  </div>
                </div>
                <div className={`inventoryCardVisual${canUseItem ? "" : " isRestricted"}`}>
                  {getWeaponIconPath(selectedWeapon) ? (
                    <span className="itemVisualFrame itemVisualFrame--imageOnly" aria-hidden="true">
                      <img className="itemVisualImage itemVisualImageCard" src={getWeaponIconPath(selectedWeapon)} alt="" />
                      {renderForgeItemStatusBadge(selectedWeapon)}
                    </span>
                  ) : (
                    <span className={`itemVisualFrame${useImageOnlyIcon ? " itemVisualFrame--imageOnly" : ""}`} aria-hidden="true">
                      <span className={`itemVisualIcon itemVisual-weapon${canUseItem ? " inventoryCardIcon" : " inventoryCardIcon isRestricted"}`}>
                        {displayItemName.charAt(0)}
                      </span>
                      {renderForgeItemStatusBadge(selectedWeapon)}
                    </span>
                  )}
                </div>
                <div className="inventoryCardContent">
                  {weaponDamageSummary ? (
                    <div className="inventoryCardDamageBlock">
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
                          <span>{line.label} {line.value}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="inventoryCardDetails">
                  <p className="inventoryCardDescription inventoryCardFlavor">{selectedWeapon.description}</p>
                  <div className="inventoryCardFooter">
                    <span className="inventoryCardPower">{t("inventory.power", { value: selectedWeapon.power })}</span>
                    <span className={`inventoryCardLevel${canUseItem ? "" : " isRestricted"}`}>
                      {t("inventory.requiredLevel", { value: selectedWeapon.levelRequirement })}
                    </span>
                  </div>
                </div>
              </>
            );
          })()}
        </article>
      ) : forgeHover.kind === "enchant" && catalystRarity && nextEnchantLevel ? (
        <article
          className={`inventoryDetailCard rarity-${catalystRarity}`}
          style={forgeHover.style.width ? { width: forgeHover.style.width, maxWidth: forgeHover.style.width } : undefined}
        >
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
      ) : null}
      </div>,
      document.body
    )}
  </>
  );
}
