import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { CombatPlaybackRollBreakdown } from "./playback";
import type { TooltipOverlayPosition } from "./tooltipPosition";

type CombatLogRollTooltipProps = {
  breakdown: CombatPlaybackRollBreakdown;
  tooltipId: string;
  position: TooltipOverlayPosition;
};

const TOOLTIP_VIEWPORT_PADDING_PX = 16;

function formatBasisPoints(value: number): string {
  return `${(value / 100).toFixed(1)}%`;
}

function formatMultiplier(value: number): string {
  return (value / 10_000).toFixed(2);
}

function formatRatio(value: number): string {
  return value.toFixed(2);
}

function getMitigationLabelKey(label: CombatPlaybackRollBreakdown["mitigationStatLabel"]): string {
  switch (label) {
    case "armor":
      return "profile.armor";
    case "missileResistance":
      return "profile.missileResistance";
    case "spellShield":
      return "profile.spellShield";
    default:
      return "profile.armor";
  }
}

function getDefenseLabelKey(damageKind: CombatPlaybackRollBreakdown["damageKind"]): string {
  return damageKind === "spell" ? "profile.magicDefense" : "profile.physicalDefense";
}

export function CombatLogRollTooltip({ breakdown, tooltipId, position }: CombatLogRollTooltipProps) {
  const { t } = useTranslation();
  const mitigationLabel = t(getMitigationLabelKey(breakdown.mitigationStatLabel));
  const defenseLabel = t(getDefenseLabelKey(breakdown.damageKind));
  const outcomeKey = !breakdown.didHit
    ? "contracts.combatTooltip.missed"
    : breakdown.didCrit
      ? "contracts.combatTooltip.criticalHit"
      : "contracts.combatTooltip.hit";
  const damageHeadlineKey = breakdown.finalDamage > 0
    ? "contracts.combatTooltip.finalDamage"
    : "contracts.combatTooltip.noDamage";
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [resolvedPosition, setResolvedPosition] = useState(() => ({
    left: position.left,
    top: position.top
  }));

  useLayoutEffect(() => {
    const tooltipElement = tooltipRef.current;
    if (!tooltipElement) {
      return;
    }

    const rect = tooltipElement.getBoundingClientRect();
    const nextLeft = Math.min(
      Math.max(position.left, TOOLTIP_VIEWPORT_PADDING_PX),
      window.innerWidth - rect.width - TOOLTIP_VIEWPORT_PADDING_PX
    );
    const nextTop = Math.min(
      Math.max(position.top - rect.height / 2, TOOLTIP_VIEWPORT_PADDING_PX),
      window.innerHeight - rect.height - TOOLTIP_VIEWPORT_PADDING_PX
    );

    setResolvedPosition((currentPosition) =>
      currentPosition.left === nextLeft && currentPosition.top === nextTop
        ? currentPosition
        : {
            left: nextLeft,
            top: nextTop
          }
    );
  }, [position.left, position.top]);

  return createPortal(
    <div
      ref={tooltipRef}
      id={tooltipId}
      className="uiHoverTooltip combatActorStatsTooltip combatLogRollTooltip isVisible"
      role="tooltip"
      style={{
        left: `${resolvedPosition.left}px`,
        top: `${resolvedPosition.top}px`
      }}
    >
      <div className="combatActorStatsTooltipHeader">
        <div className="combatLogRollTooltipSummary">
          <p
            className={`combatLogRollTooltipOutcome${
              !breakdown.didHit ? " isMiss" : breakdown.didCrit ? " isCrit" : " isHit"
            }`}
          >
            {t(outcomeKey)}
          </p>
          <p className="uiHoverTooltipTitle">{t(damageHeadlineKey, { value: breakdown.finalDamage })}</p>
          <p className="combatLogRollTooltipSubtitle">
            {breakdown.attacker.name} vs {breakdown.defender.name} •{" "}
            {t("contracts.combatTooltip.hpFlow", { before: breakdown.targetHpBefore, after: breakdown.targetHpAfter })}
          </p>
        </div>
      </div>

      <div className="combatLogRollTooltipSteps">
        <section className="combatLogRollStep combatLogRollStep-hit" aria-label="Hit">
          <p className="combatLogRollStepLabel">{t("contracts.combatTooltip.hitCheck")}</p>
          <p className="combatLogRollStepSummary">
            {t("contracts.combatTooltip.hitCheckSummary", {
              chance: formatBasisPoints(breakdown.hitChanceBps)
            })}
          </p>
          <p className="combatLogRollStepDetail">
            {t("contracts.combatTooltip.hitCheckDetail", {
              accuracy: breakdown.attacker.accuracy,
              dodge: formatBasisPoints(breakdown.defender.dodgeChance)
            })}
          </p>
          <p className="combatLogRollStepMath">
            {t("contracts.combatTooltip.math")}: clamp(25%, 97.5%, {breakdown.attacker.accuracy}*100 -{" "}
            {breakdown.defender.dodgeChance}) = {formatBasisPoints(breakdown.hitChanceBps)}
          </p>
        </section>

        <section className="combatLogRollStep combatLogRollStep-damage" aria-label="Damage">
          <p className="combatLogRollStepLabel">{t("contracts.combatTooltip.damageRoll")}</p>
          <p className="combatLogRollStepSummary">
            {breakdown.didHit
              ? t("contracts.combatTooltip.damageRollSummary", {
                  roll: breakdown.baseDamageRoll ?? 0,
                  min: breakdown.attacker.minDamage,
                  max: breakdown.attacker.maxDamage
                })
              : t("contracts.combatTooltip.damageRollMiss")}
          </p>
          <p className="combatLogRollStepDetail">
            {breakdown.didHit
              ? breakdown.didCrit
                ? t("contracts.combatTooltip.damageRollCrit", {
                    multiplier: formatMultiplier(breakdown.attacker.critMultiplier),
                    raw: breakdown.rawDamage
                  })
                : t("contracts.combatTooltip.damageRollNormal", { raw: breakdown.rawDamage })
              : `${t("profile.critChance")} ${formatBasisPoints(breakdown.attacker.critChance)}`}
          </p>
          <p className="combatLogRollStepMath">
            {t("contracts.combatTooltip.math")}:{" "}
            {breakdown.didHit
              ? breakdown.didCrit
                ? `${breakdown.baseDamageRoll ?? 0} * ${formatMultiplier(breakdown.attacker.critMultiplier)} = ${breakdown.rawDamage}`
                : `raw = ${breakdown.baseDamageRoll ?? 0}`
              : "raw = 0"}
          </p>
        </section>

        <section className="combatLogRollStep combatLogRollStep-defense" aria-label="Mitigation">
          <p className="combatLogRollStepLabel">{t("contracts.combatTooltip.defenseReduction")}</p>
          <p className="combatLogRollStepSummary">
            {breakdown.didHit
              ? t("contracts.combatTooltip.defenseReductionSummary", {
                  percent: formatBasisPoints(breakdown.mitigationPercentBps),
                  effectiveDefense: breakdown.effectiveDefense
                })
              : t("contracts.combatTooltip.defenseReductionNone")}
          </p>
          <p className="combatLogRollStepDetail">
            {t("contracts.combatTooltip.defenseReductionDetail", {
              mitigation: mitigationLabel,
              resistance: breakdown.mitigationResistance,
              defense: defenseLabel,
              defenseValue: breakdown.mitigationDefense,
              effectiveDefense: breakdown.effectiveDefense,
              attackerPower: breakdown.attackerPower,
              scale: breakdown.mitigationScale
            })}{" "}
            •{" "}
            {t("contracts.combatTooltip.minimumFloor", {
              value: breakdown.minimumDamage,
              percent: formatBasisPoints(breakdown.floorPercentBps)
            })}
          </p>
          <p className="combatLogRollStepMath">
            {t("contracts.combatTooltip.math")}: mitigation% = {breakdown.effectiveDefense}/({breakdown.effectiveDefense} +{" "}
            {breakdown.mitigationScale}) = {formatBasisPoints(breakdown.mitigationPercentBps)}; post = round(
            {breakdown.rawDamage} * (1 - {formatRatio(breakdown.mitigationPercentBps / 10_000)})) ={" "}
            {breakdown.postMitigationDamage}; final = max({breakdown.minimumDamage}, {breakdown.postMitigationDamage}) ={" "}
            {breakdown.finalDamage}
          </p>
        </section>
      </div>
    </div>,
    document.body
  );
}
