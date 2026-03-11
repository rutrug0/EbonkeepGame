import type { ReactElement } from "react";

import type { EquipmentSlotId } from "@ebonkeep/shared/core";
import type { PlayerState } from "@ebonkeep/shared/player";

import i18n from "../../i18n";

type TrainableStatKey = "strength" | "intelligence" | "dexterity" | "vitality" | "initiative" | "luck";
type InventoryStatFlashKey = TrainableStatKey | "gearScore";
type InventoryStatFlash = {
  direction: "positive" | "negative";
};
type StatContributionLine = {
  label: string;
  ratioLabel: string;
  valueLabel: string;
};
type CurrencyState = {
  ducats: number;
  imperials: number;
};
type ActiveStatTraining = {
  stat: TrainableStatKey;
  completesAt: number;
} | null;
type MainStatColumn = {
  key: TrainableStatKey;
  label: string;
  iconPath: string;
};

export type InventoryManagementPanelProps = {
  isLoadingState: boolean;
  playerState: PlayerState | null;
  baseStats: Record<TrainableStatKey, number> | null;
  currencies: CurrencyState | null;
  minimumPreviewDucats: number;
  equipmentStatBonuses: Record<TrainableStatKey, number>;
  inventoryStatFlashes: Partial<Record<InventoryStatFlashKey, InventoryStatFlash>>;
  activeStatTraining: ActiveStatTraining;
  nowMs: number;
  statTrainDurationMs: number;
  profileName: string;
  activeCharacterVisualPath: string | null;
  activeCharacterVisualName: string | null;
  canCycleCharacterVisuals: boolean;
  imperialsIconPath: string;
  equipmentLeftSlots: EquipmentSlotId[];
  equipmentRightSlots: EquipmentSlotId[];
  equipmentVestigeSlots: EquipmentSlotId[];
  renderCharacterHubTabs: () => ReactElement;
  renderEquipmentSlotCell: (
    slotId: EquipmentSlotId,
    extraClassName?: string,
    tooltipPlacement?: "left" | "right" | "top"
  ) => ReactElement;
  onShowPreviousPortrait: () => void;
  onShowNextPortrait: () => void;
  onStartStatTraining: (stat: TrainableStatKey) => void;
  getTrainingCost: (baseValue: number) => number;
  getStatContributionLines: (
    stat: TrainableStatKey,
    statValue: number,
    playerClass: PlayerState["class"]
  ) => StatContributionLine[];
  formatDurationFromMs: (value: number) => string;
};

const MAIN_STAT_COLUMNS: MainStatColumn[] = [
  {
    key: "strength",
    label: "STR",
    iconPath: "M6.2 17c-1.2 0-2.2-1-2.2-2.2V10h1.9V7.8a1 1 0 112 0V10h.8V7.2a1 1 0 112 0V10h.8V7.5a1 1 0 112 0V10h.7a2 2 0 012 2v2.8c0 1.2-1 2.2-2.2 2.2H6.2z"
  },
  { key: "intelligence", label: "INT", iconPath: "M4 4h5a3 3 0 013 3v9a3 3 0 00-3-3H4V4zm12 0h-5a3 3 0 00-3 3v9a3 3 0 013-3h5V4z" },
  { key: "dexterity", label: "DEX", iconPath: "M4 5h5l1 4h4l2 3H4V5zm0 8h13v2H4v-2z" },
  {
    key: "vitality",
    label: "VIT",
    iconPath: "M10 17l-1.4-1.2C5 12.6 3 10.8 3 8.5 3 6.6 4.6 5 6.5 5c1.1 0 2.2.5 2.9 1.4.7-.9 1.8-1.4 2.9-1.4C14.4 5 16 6.6 16 8.5c0 2.3-2 4.1-5.6 7.3L10 17zM9 7h2v2h2v2h-2v2H9v-2H7V9h2V7z"
  },
  { key: "initiative", label: "INI", iconPath: "M9 2l-5 9h4l-1 7 8-11h-4l1-5H9z" },
  {
    key: "luck",
    label: "LCK",
    iconPath: "M5 4h10a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm2 2a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zM10 9a1 1 0 100 2 1 1 0 000-2zm-3 3a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2z"
  }
];

export function InventoryManagementPanel(props: InventoryManagementPanelProps): ReactElement {
  if (props.isLoadingState) {
    return (
      <section className="contentShell">
        <section className="contentStack">
          {props.renderCharacterHubTabs()}
          <article className="contentCard">
            <h2>Character</h2>
            <p>{i18n.t("inventory.loading")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (!props.playerState) {
    return (
      <section className="contentShell">
        <section className="contentStack">
          {props.renderCharacterHubTabs()}
          <article className="contentCard">
            <h2>Character</h2>
            <p>{i18n.t("inventory.unavailable")}</p>
          </article>
        </section>
      </section>
    );
  }

  const playerState = props.playerState;
  const activeStatTraining = props.activeStatTraining;
  const effectiveBaseStats: Record<TrainableStatKey, number> = props.baseStats ?? {
    strength: playerState.stats.strength,
    intelligence: playerState.stats.intelligence,
    dexterity: playerState.stats.dexterity,
    vitality: playerState.stats.vitality,
    initiative: playerState.stats.initiative,
    luck: playerState.stats.luck
  };
  const effectiveCurrencies = props.currencies ?? {
    ducats: Math.max(playerState.currency.ducats, props.minimumPreviewDucats),
    imperials: playerState.currency.imperials
  };

  return (
    <section className="contentShell">
      <section className="contentStack">
        {props.renderCharacterHubTabs()}

        <article className="contentCard">
          <div className="equipmentBoard">
            <div className="equipmentColumn equipmentColumnLeft">
              {props.equipmentLeftSlots.map((slotId) => props.renderEquipmentSlotCell(slotId, "", "right"))}
            </div>

            <div className="equipmentCenterColumn">
              <div className="characterVisual">
                <div className="characterVisualFrame">
                  {props.activeCharacterVisualPath ? (
                    <img
                      src={props.activeCharacterVisualPath}
                      alt={`${props.activeCharacterVisualName ?? props.profileName} ${i18n.t("profile.portraitSuffix")}`}
                      className="characterVisualImage"
                      draggable={false}
                    />
                  ) : (
                    <div className="characterSilhouette" aria-hidden="true" />
                  )}
                  {props.canCycleCharacterVisuals ? (
                    <>
                      <button
                        type="button"
                        className="characterCycleButton characterCycleButtonPrev"
                        onClick={props.onShowPreviousPortrait}
                        aria-label={i18n.t("profile.showPreviousPortrait")}
                      >
                        <span aria-hidden="true">{"<"}</span>
                      </button>
                      <button
                        type="button"
                        className="characterCycleButton characterCycleButtonNext"
                        onClick={props.onShowNextPortrait}
                        aria-label={i18n.t("profile.showNextPortrait")}
                      >
                        <span aria-hidden="true">{">"}</span>
                      </button>
                    </>
                  ) : null}
                  <p className="characterVisualLabel">{props.profileName}</p>
                  {props.renderEquipmentSlotCell("weapon", "equipmentWeaponCell equipmentWeaponOverlay", "top")}
                  <div className="vestigeRack vestigeRackOverlay">
                    {props.equipmentVestigeSlots.map((slotId) => props.renderEquipmentSlotCell(slotId, "vestigeCell", "top"))}
                  </div>
                </div>
              </div>
            </div>

            <div className="equipmentColumn equipmentColumnRight">
              {props.equipmentRightSlots.map((slotId) => props.renderEquipmentSlotCell(slotId, "", "left"))}
            </div>
          </div>

          <div className="equipmentEconomyBar">
            <div className="economyItem">
              <span className="currencyIcon ducatIcon" aria-hidden="true">
                {"\u25ce"}
              </span>
              <span>{i18n.t("currencies.ducats")}</span>
              <strong>{effectiveCurrencies.ducats}</strong>
            </div>
            <div className="economyItem">
              <span className="currencyIcon imperialIcon" aria-hidden="true">
                <img className="currencyIconImage" src={props.imperialsIconPath} alt="" />
              </span>
              <span>{i18n.t("currencies.imperials")}</span>
              <strong>{effectiveCurrencies.imperials}</strong>
            </div>
            <div
              className={`economyItem${
                props.inventoryStatFlashes.gearScore
                  ? ` inventoryStatFlash inventoryStatFlash-${props.inventoryStatFlashes.gearScore.direction}`
                  : ""
              }`}
            >
              <span className="currencyIcon gearScoreIcon" aria-hidden="true">
                {"\u26E8"}
              </span>
              <span>{i18n.t("currencies.gearScore")}</span>
              <strong
                className={`economyValue${
                  props.inventoryStatFlashes.gearScore
                    ? ` inventoryStatFlashValue inventoryStatFlashValue-${props.inventoryStatFlashes.gearScore.direction}`
                    : ""
                }`}
              >
                {playerState.gearScore}
              </strong>
            </div>
          </div>

          <div className="mainStatsTraining">
            <div className="statTrainingColumns">
              {MAIN_STAT_COLUMNS.map((statColumn, statIndex) => {
                const baseValue = effectiveBaseStats[statColumn.key];
                const itemBonus = props.equipmentStatBonuses[statColumn.key];
                const statFlash = props.inventoryStatFlashes[statColumn.key];
                const statContributionLines = props.getStatContributionLines(
                  statColumn.key,
                  baseValue,
                  playerState.class
                );
                const trainingCost = props.getTrainingCost(baseValue);
                const hasEnoughDucats = effectiveCurrencies.ducats >= trainingCost;
                const isTrainingThisStat = activeStatTraining?.stat === statColumn.key;
                const isTrainingAnyStat = activeStatTraining !== null;
                const trainingCountdown = isTrainingThisStat
                  ? props.formatDurationFromMs(activeStatTraining.completesAt - props.nowMs)
                  : null;
                const trainingProgressPercent = isTrainingThisStat
                  ? Math.round(
                      ((props.statTrainDurationMs - Math.max(0, activeStatTraining.completesAt - props.nowMs)) /
                        props.statTrainDurationMs) *
                        100
                    )
                  : 0;
                const statTooltipAnchorClass =
                  statIndex === 0
                    ? "statTrainingTooltipAnchorStart"
                    : statIndex === MAIN_STAT_COLUMNS.length - 1
                      ? "statTrainingTooltipAnchorEnd"
                      : "";

                return (
                  <div
                    key={statColumn.key}
                    className={`statTrainingColumn${statFlash ? ` inventoryStatFlash inventoryStatFlash-${statFlash.direction}` : ""}`}
                  >
                    <span className="statTrainingSymbol" aria-hidden="true">
                      <svg viewBox="0 0 20 20" focusable="false">
                        <path d={statColumn.iconPath} />
                      </svg>
                    </span>
                    <span className="statTrainingLabel">{statColumn.label}</span>
                    <div
                      className={`statTrainingTooltip${statTooltipAnchorClass ? ` ${statTooltipAnchorClass}` : ""}`}
                      role="tooltip"
                    >
                      <p className="statTrainingTooltipTitle">{i18n.t("training.derivedContributions")}</p>
                      {statContributionLines.map((line) => (
                        <p key={`${statColumn.key}-${line.label}`} className="statTrainingTooltipLine">
                          <span>
                            {line.label} ({line.ratioLabel})
                          </span>
                          <strong>{line.valueLabel}</strong>
                        </p>
                      ))}
                    </div>
                    <span
                      className={`statTrainingValue${
                        statFlash ? ` inventoryStatFlashValue inventoryStatFlashValue-${statFlash.direction}` : ""
                      }`}
                    >
                      {baseValue}
                      <span className="itemBonusValue">(+{itemBonus})</span>
                    </span>
                    <div className="statTrainingAction">
                      <span className="statTrainingCost">
                        {trainingCost}
                        <span className="currencyIcon ducatIcon" aria-hidden="true">
                          {"\u25ce"}
                        </span>
                      </span>
                      <button
                        className="statTrainButton"
                        onClick={() => props.onStartStatTraining(statColumn.key)}
                        disabled={!hasEnoughDucats || isTrainingAnyStat}
                      >
                        {isTrainingThisStat
                          ? i18n.t("training.training")
                          : isTrainingAnyStat
                            ? i18n.t("training.busy")
                            : i18n.t("training.train")}
                      </button>
                      {isTrainingThisStat ? (
                        <>
                          <div
                            className="statTrainingProgressTrack"
                            role="progressbar"
                            aria-label={i18n.t("training.progressAria", { stat: statColumn.label })}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={trainingProgressPercent}
                          >
                            <span
                              className="statTrainingProgressFill"
                              style={{ width: `${Math.max(0, Math.min(100, trainingProgressPercent))}%` }}
                            />
                          </div>
                          <span className="statTrainingTimer">{trainingCountdown}</span>
                        </>
                      ) : (
                        <div className="statTrainingIdleSpacer" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
