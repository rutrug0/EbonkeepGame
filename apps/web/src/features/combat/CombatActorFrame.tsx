import { useState, type CSSProperties, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { CombatPlaybackActor } from "./playback";
import {
  buildTooltipPositionFromElement,
  buildTooltipPositionFromPointer,
  type TooltipOverlayPosition
} from "./tooltipPosition";

type CombatActorFrameProps = {
  actor: CombatPlaybackActor;
  currentHp: number;
  label: string;
  isAttacking: boolean;
  isHit: boolean;
  isReferenced: boolean;
  isDead: boolean;
  size?: "default" | "compact" | "boss";
  style?: CSSProperties;
};

const COMBAT_ACTOR_TOOLTIP_SIZING = {
  width: 360,
  estimatedHeight: 220
} as const;

function formatCombatStatLabel(combatStat: "strength" | "dexterity" | "intelligence"): string {
  switch (combatStat) {
    case "strength":
      return "Strength";
    case "dexterity":
      return "Dexterity";
    case "intelligence":
      return "Intelligence";
    default:
      return combatStat;
  }
}

function CombatStatIcon({ combatStat }: { combatStat: "strength" | "dexterity" | "intelligence" }) {
  switch (combatStat) {
    case "strength":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14 4h3l2 2v4l-2 2h-2l-2 2v3l-3 3H5l-2-2v-4l3-3h3l2-2V8l2-2V4Z" />
        </svg>
      );
    case "dexterity":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 18 18 4l2 2-14 14H4v-2Zm9-14h7v7h-2V7.41l-8.29 8.3-1.42-1.42 8.3-8.29H13V4Z" />
        </svg>
      );
    case "intelligence":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2 6 9l4 .5L8 16l8-9-4-.5L12 2Zm-4.5 15h9v2h-9v-2Zm1 3h7v2h-7v-2Z" />
        </svg>
      );
    default:
      return null;
  }
}

function formatBasisPoints(value: number): string {
  return `${(value / 100).toFixed(1)}%`;
}

function formatDamageLabel(actor: CombatPlaybackActor, t: (key: string, options?: Record<string, string | number>) => string): string {
  const damageKind = actor.rollStats?.damageKind;
  if (damageKind === "ranged") {
    return t("profile.rangedDamage");
  }
  if (damageKind === "spell") {
    return t("profile.spellDamage");
  }
  return t("profile.meleeDamage");
}

export function CombatActorFrame({
  actor,
  currentHp,
  label,
  isAttacking,
  isHit,
  isReferenced,
  isDead,
  size = "default",
  style
}: CombatActorFrameProps) {
  const { t } = useTranslation();
  const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / actor.maxHp) * 100)));
  const showStatsTooltip = actor.side === "enemy" && actor.rollStats;
  const rollStats = actor.rollStats;
  const tooltipId = showStatsTooltip ? `combat-actor-stats-${actor.id.replace(/[^a-zA-Z0-9_-]/g, "-")}` : undefined;
  const [tooltipPosition, setTooltipPosition] = useState<TooltipOverlayPosition | null>(null);
  const frameClassName = [
    "combatActorFrame",
    `combatActorFrame-${actor.side}`,
    size !== "default" ? `combatActorFrame--${size}` : "",
    showStatsTooltip ? "combatActorFrameTooltipTrigger" : "",
    tooltipPosition ? "isTooltipVisible" : "",
    isAttacking ? "isAttacking" : "",
    isHit ? "isHit" : "",
    isReferenced ? "isReferenced" : "",
    isDead ? "isDead" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const actorAriaLabel = `${label}: ${actor.name}, ${currentHp} of ${actor.maxHp} HP`;
  const actorCombatStat = actor.combatStat;
  const showActorMeta = typeof actor.power === "number" && actorCombatStat;
  const combatStatLabel = actorCombatStat ? formatCombatStatLabel(actorCombatStat) : "";
  const tooltipSections = rollStats
    ? [
        {
          title: t("profile.offensive"),
          rows: [
            { label: formatDamageLabel(actor, t), value: `${rollStats.minDamage}-${rollStats.maxDamage}` },
            { label: t("profile.combatSpeed"), value: rollStats.combatSpeed.toString() },
            { label: t("profile.accuracy"), value: rollStats.accuracy.toString() },
            { label: t("profile.critChance"), value: formatBasisPoints(rollStats.critChance) },
            { label: t("profile.critDamage"), value: formatBasisPoints(rollStats.critMultiplier) },
            { label: t("profile.chanceToExtraAttack"), value: formatBasisPoints(rollStats.extraAttackChance) },
            ...(typeof rollStats.threat === "number"
              ? [{ label: "Threat", value: rollStats.threat.toString() }]
              : [])
          ]
        },
        {
          title: t("profile.defensive"),
          rows: [
            { label: t("profile.armor"), value: rollStats.armor.toString() },
            { label: t("profile.spellShield"), value: rollStats.spellShield.toString() },
            { label: t("profile.missileResistance"), value: rollStats.missileResistance.toString() },
            { label: t("profile.physicalDefense"), value: rollStats.physicalDefense.toString() },
            { label: t("profile.magicDefense"), value: rollStats.magicDefense.toString() },
            { label: t("profile.dodgeChance"), value: formatBasisPoints(rollStats.dodgeChance) }
          ]
        }
      ]
    : [];

  function openTooltipFromPointer(event: MouseEvent<HTMLElement>) {
    if (!showStatsTooltip) {
      return;
    }
    setTooltipPosition(buildTooltipPositionFromPointer(event.clientX, event.clientY, COMBAT_ACTOR_TOOLTIP_SIZING));
  }

  function updateTooltipFromPointer(event: MouseEvent<HTMLElement>) {
    if (!showStatsTooltip || tooltipPosition === null) {
      return;
    }
    setTooltipPosition(buildTooltipPositionFromPointer(event.clientX, event.clientY, COMBAT_ACTOR_TOOLTIP_SIZING));
  }

  function openTooltipFromFocus(event: FocusEvent<HTMLElement>) {
    if (!showStatsTooltip) {
      return;
    }
    setTooltipPosition(buildTooltipPositionFromElement(event.currentTarget, COMBAT_ACTOR_TOOLTIP_SIZING));
  }

  function closeTooltip() {
    setTooltipPosition(null);
  }

  return (
    <article
      className={frameClassName}
      style={style}
      aria-label={actorAriaLabel}
      aria-describedby={tooltipPosition ? tooltipId : undefined}
      tabIndex={showStatsTooltip ? 0 : undefined}
      onMouseEnter={showStatsTooltip ? openTooltipFromPointer : undefined}
      onMouseMove={showStatsTooltip ? updateTooltipFromPointer : undefined}
      onMouseLeave={showStatsTooltip ? closeTooltip : undefined}
      onFocus={showStatsTooltip ? openTooltipFromFocus : undefined}
      onBlur={showStatsTooltip ? closeTooltip : undefined}
    >
      <div className="combatActorFrameShell">
        <div className="combatActorPortraitWrap">
          {actor.avatarPath && !actor.usesSilhouetteFallback ? (
            <img src={actor.avatarPath} alt={actor.name} className="combatActorPortrait" draggable={false} />
          ) : (
            <div className="combatActorSilhouette" aria-hidden="true" />
          )}
          {showActorMeta ? (
            <>
              <div className="combatActorMeta combatActorMetaPower">{actor.power}</div>
              <div
                className="combatActorMeta combatActorMetaType"
                aria-label={combatStatLabel}
                tabIndex={0}
              >
                <CombatStatIcon combatStat={actorCombatStat} />
                <span className="combatActorMetaTooltip" role="tooltip">
                  {combatStatLabel}
                </span>
              </div>
            </>
          ) : null}
        </div>
        <div className="combatActorNameplate" title={actor.name}>
          <span>{actor.name}</span>
        </div>
        <div
          className="combatActorHpBar"
          role="progressbar"
          aria-label={`${actor.name} health`}
          aria-valuemin={0}
          aria-valuemax={actor.maxHp}
          aria-valuenow={currentHp}
        >
          <div className="combatActorHpFill" style={{ width: `${hpPercent}%` }} />
          <span className="combatActorHpLabel">
            {currentHp}/{actor.maxHp}
          </span>
        </div>
      </div>
      {showStatsTooltip && rollStats && tooltipPosition
        ? createPortal(
            <div
              id={tooltipId}
              className="uiHoverTooltip combatActorStatsTooltip isVisible"
              role="tooltip"
              style={{
                left: `${tooltipPosition.left}px`,
                top: `${tooltipPosition.top}px`
              }}
            >
              <div className="combatActorStatsTooltipHeader">
                <p className="uiHoverTooltipTitle">{actor.name}</p>
                <p className="combatActorStatsTooltipLevel">{t("player.level", { value: rollStats.level })}</p>
              </div>
              {tooltipSections.map((section) => (
                <section key={section.title} className="combatActorStatsTooltipSection" aria-label={section.title}>
                  <p className="combatActorStatsTooltipSectionTitle">{section.title}</p>
                  {section.rows.map((row) => (
                    <p key={row.label} className="combatActorStatsTooltipRow">
                      <strong>{row.label}</strong>
                      <span>{row.value}</span>
                    </p>
                  ))}
                </section>
              ))}
            </div>,
            document.body
          )
        : null}
    </article>
  );
}
