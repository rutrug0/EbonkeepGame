import type { CSSProperties, KeyboardEvent } from "react";

import { CombatEncounterPanel } from "../combat";
import {
  getEncounterAnimationRate,
  type ActiveContractEncounterState,
  type ContractEfficiencyTier,
  type ContractOffer,
  type ContractRoll,
  type ContractSlotState
} from "./mockData";
import i18n from "../../i18n";
import { getViewBackgroundStyle } from "../../lib/viewBackgrounds";

export type ContractsPanelProps = {
  isLoadingState: boolean;
  hasPlayerState: boolean;
  activeContractEncounter: ActiveContractEncounterState | null;
  nowMs: number;
  contractSlots: ContractSlotState[];
  availableContractCount: number;
  replenishingContractCount: number;
  onToggleFastForward: () => void;
  onReplayCombat: () => void;
  onBackToBoard: () => void;
  onStartContractEncounter: (slotIndex: number, offer: ContractOffer) => void;
  onContractRowKeyDown: (
    event: KeyboardEvent<HTMLTableRowElement>,
    slotIndex: number,
    offer: ContractOffer
  ) => void;
  onAbandonContractSlot: (slotIndex: number) => void;
  formatContractEfficiencyTier: (tier: ContractEfficiencyTier) => string;
  formatContractRoll: (roll: ContractRoll) => string;
  formatDurationFromMs: (value: number) => string;
};

export function ContractsPanel(props: ContractsPanelProps) {
  const contractsSceneStyle = getViewBackgroundStyle("contracts") as CSSProperties;

  if (props.isLoadingState) {
    return (
      <section className="contentShell contractsPanelShell indoorSceneShell" style={contractsSceneStyle}>
        <section className="contentStack">
          <article className="contentCard">
            <h2>{i18n.t("menu.contracts")}</h2>
            <p>{i18n.t("contracts.loading")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (!props.hasPlayerState) {
    return (
      <section className="contentShell contractsPanelShell indoorSceneShell" style={contractsSceneStyle}>
        <section className="contentStack">
          <article className="contentCard">
            <h2>{i18n.t("menu.contracts")}</h2>
            <p>{i18n.t("inventory.unavailable")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (props.activeContractEncounter && props.activeContractEncounter.phase === "travel") {
    return (
      <CombatEncounterPanel
        phase={props.activeContractEncounter.phase}
        encounter={props.activeContractEncounter.encounter}
        timeline={props.activeContractEncounter.timeline}
        currentEventIndex={props.activeContractEncounter.currentEventIndex}
        nowMs={props.nowMs}
        travelEndsAt={props.activeContractEncounter.travelEndsAt}
        travelDurationMs={props.activeContractEncounter.travelDurationMs}
        travelDescription={props.activeContractEncounter.travelDescription}
        hpByActorId={props.activeContractEncounter.hpByActorId}
        combatLogEntries={props.activeContractEncounter.combatLogEntries}
        combatLogEventIds={props.activeContractEncounter.combatLogEventIds}
        currentAction={props.activeContractEncounter.activeAction}
        impactTargetId={props.activeContractEncounter.impactTargetId}
        resolutionState={props.activeContractEncounter.resolutionState}
        typedSummaryLine={props.activeContractEncounter.typedSummaryLine}
        playbackRate={getEncounterAnimationRate(props.activeContractEncounter)}
        isFastForwardEnabled={props.activeContractEncounter.playbackRate === 5}
        onToggleFastForward={props.onToggleFastForward}
        onReplayCombat={props.onReplayCombat}
        onBackToBoard={props.onBackToBoard}
        formatDurationFromMs={props.formatDurationFromMs}
      />
    );
  }

  return (
    <section className="contentShell contractsPanelShell indoorSceneShell" style={contractsSceneStyle}>
      <section className="contentStack">
        <article className="contentCard">
          <div className="contractsHeader">
            <h2>{i18n.t("menu.contracts")}</h2>
            <p>
              {i18n.t("contracts.available", {
                available: props.availableContractCount,
                total: props.contractSlots.length,
                replenishing: props.replenishingContractCount
              })}
            </p>
          </div>
          <p>{i18n.t("contracts.description")}</p>
        </article>

        <article className="contentCard">
          <div className="contractsTableWrap">
            <table className="contractsTable">
              <thead>
                <tr>
                  <th>{i18n.t("contracts.table.contract")}</th>
                  <th>{i18n.t("contracts.table.contractLevel")}</th>
                  <th>{i18n.t("contracts.table.experienceRoll")}</th>
                  <th>{i18n.t("contracts.table.ducatsRoll")}</th>
                  <th>{i18n.t("contracts.table.materialsRoll")}</th>
                  <th>{i18n.t("contracts.table.itemDropRoll")}</th>
                  <th>{i18n.t("contracts.table.staminaCost")}</th>
                  <th>{i18n.t("contracts.table.expiresIn")}</th>
                  <th>{i18n.t("contracts.table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {props.contractSlots.map((slot) => {
                  if (!slot.offer) {
                    return (
                      <tr key={slot.slotIndex} className="contractsReplenishRow">
                        <td data-label={i18n.t("contracts.table.contract")}>
                          <div className="contractsNameCell">
                            <strong>{i18n.t("contracts.slot", { index: slot.slotIndex })}</strong>
                            <span>{i18n.t("contracts.replenishing")}</span>
                          </div>
                        </td>
                        <td data-label="Status" colSpan={8} className="contractsReplenishMessage">
                          {i18n.t("contracts.newIn", {
                            duration: slot.replenishReadyAt
                              ? props.formatDurationFromMs(slot.replenishReadyAt - props.nowMs)
                              : "00m 00s"
                          })}
                        </td>
                      </tr>
                    );
                  }

                  const { template, rollCue } = slot.offer;

                  return (
                    <tr
                      key={slot.slotIndex}
                      className="contractsActionRow"
                      data-testid={`contract-row-${slot.slotIndex}`}
                      tabIndex={0}
                      role="button"
                      aria-label={i18n.t("contracts.enterAria", {
                        contract: template.name,
                        level: template.contractLevel
                      })}
                      onClick={() => props.onStartContractEncounter(slot.slotIndex, slot.offer as ContractOffer)}
                      onKeyDown={(event) =>
                        props.onContractRowKeyDown(event, slot.slotIndex, slot.offer as ContractOffer)
                      }
                    >
                      <td data-label={i18n.t("contracts.table.contract")}>
                        <div className="contractsNameCell">
                          <strong>{template.name}</strong>
                          <span>
                            {i18n.t("contracts.slot", { index: slot.slotIndex })} |{" "}
                            {props.formatContractEfficiencyTier(slot.offer.efficiencyTier)}
                          </span>
                        </div>
                      </td>
                      <td data-label={i18n.t("contracts.table.contractLevel")}>
                        <span className={`contractDifficulty contractDifficulty-${template.levelBand}`}>
                          {template.contractLevel}
                        </span>
                      </td>
                      <td data-label={i18n.t("contracts.table.experienceRoll")}>
                        {props.formatContractRoll(rollCue.experience)}
                      </td>
                      <td data-label={i18n.t("contracts.table.ducatsRoll")}>
                        {props.formatContractRoll(rollCue.ducats)}
                      </td>
                      <td data-label={i18n.t("contracts.table.materialsRoll")}>
                        {props.formatContractRoll(rollCue.materials)}
                      </td>
                      <td data-label={i18n.t("contracts.table.itemDropRoll")}>
                        {props.formatContractRoll(rollCue.itemDrop)}
                      </td>
                      <td data-label={i18n.t("contracts.table.staminaCost")}>
                        {i18n.t("contracts.staminaCostValue", {
                          cost: slot.offer.staminaCostValue,
                          tier: props.formatContractEfficiencyTier(slot.offer.efficiencyTier)
                        })}
                      </td>
                      <td data-label={i18n.t("contracts.table.expiresIn")} className="contractsTimeCell">
                        {props.formatDurationFromMs(slot.offer.expiresAt - props.nowMs)}
                      </td>
                      <td data-label={i18n.t("contracts.table.action")}>
                        <button
                          className="contractAbandonButton"
                          onClick={(event) => {
                            event.stopPropagation();
                            props.onAbandonContractSlot(slot.slotIndex);
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          {i18n.t("contracts.abandon")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}
