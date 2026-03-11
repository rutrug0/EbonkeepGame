import type { DragEventHandler, ReactElement, RefObject, UIEventHandler } from "react";

import type { PlayerState } from "@ebonkeep/shared/player";

import i18n from "../../i18n";

type InventoryItemLike = {
  category: string;
} & Record<string, any>;

type StatsGroup = {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
};

export type ProfileSidePanelProps = {
  isLoadingState: boolean;
  playerState: PlayerState | null;
  inventoryItems: InventoryItemLike[];
  profileSideTab: "inventory" | "consumables" | "stats";
  sidePanelScrollRef: RefObject<HTMLDivElement | null>;
  filteredInventoryItems: InventoryItemLike[];
  consumableItems: InventoryItemLike[];
  groupedStats: StatsGroup[];
  onTabChange: (tab: "inventory" | "consumables" | "stats") => void;
  onInventoryScroll: () => void;
  onInventoryDragOver: DragEventHandler<HTMLDivElement>;
  onInventoryDrop: DragEventHandler<HTMLDivElement>;
  onToggleInventoryPowerSort: () => void;
  onToggleInventoryCategory: (filter: "weapon" | "armor" | "jewelry") => void;
  onToggleWearable: () => void;
  showOnlyWeapons: boolean;
  showOnlyArmor: boolean;
  showOnlyJewelry: boolean;
  showOnlyWearable: boolean;
  renderInventoryCards: (items: any[], allowDrag: boolean) => ReactElement;
  renderInventoryComparisonOverlay: () => ReactElement | null;
  formatClassLabel: (playerClass: PlayerState["class"]) => string;
  renderUnavailablePanel: (title: string, description: string) => ReactElement;
};

export function ProfileSidePanel(props: ProfileSidePanelProps): ReactElement {
  if (props.isLoadingState) {
    return props.renderUnavailablePanel(i18n.t("profile.panel"), i18n.t("profile.loading"));
  }

  if (!props.playerState) {
    return props.renderUnavailablePanel(i18n.t("profile.panel"), i18n.t("inventory.unavailable"));
  }

  return (
    <section className="contentShell statsViewportShell">
      <section className="contentStack statsViewportStack sidePanelStack">
        <article className="contentCard sidePanelTabsCard">
          <div className="profileSideTabs">
            <button
              className={`profileSwitchButton${props.profileSideTab === "inventory" ? " active" : ""}`}
              onClick={() => props.onTabChange("inventory")}
            >
              {i18n.t("profile.inventoryTab")}
            </button>
            <button
              className={`profileSwitchButton${props.profileSideTab === "consumables" ? " active" : ""}`}
              onClick={() => props.onTabChange("consumables")}
            >
              {i18n.t("profile.consumablesTab")}
            </button>
            <button
              className={`profileSwitchButton${props.profileSideTab === "stats" ? " active" : ""}`}
              onClick={() => props.onTabChange("stats")}
            >
              {i18n.t("profile.statsTab")}
            </button>
          </div>
        </article>

        <article className="contentCard statsViewportBody sidePanelBodyCard">
          <div
            className="sidePanelScroll"
            ref={props.sidePanelScrollRef}
            onScroll={props.profileSideTab === "inventory" ? props.onInventoryScroll : undefined}
            onDragOver={props.profileSideTab === "inventory" ? props.onInventoryDragOver : undefined}
            onDrop={props.profileSideTab === "inventory" ? props.onInventoryDrop : undefined}
          >
            {props.profileSideTab === "inventory" ? (
              <>
                <div className="inventoryToolbarSticky">
                  <div className="inventoryControlsRow">
                    <div className="inventoryControlWithTooltip">
                      <button
                        type="button"
                        className="inventoryIconButton"
                        onClick={props.onToggleInventoryPowerSort}
                        aria-label={i18n.t("inventory.sortByPower")}
                        aria-describedby="inventory-power-sort-tooltip"
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                          <path d="M7 4L4 7h2v9h2V7h2L7 4zM13 16l3-3h-2V4h-2v9h-2l3 3z" />
                        </svg>
                      </button>
                      <div
                        id="inventory-power-sort-tooltip"
                        className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorStart"
                        role="tooltip"
                      >
                        <p className="uiHoverTooltipTitle">{i18n.t("inventory.sortItems")}</p>
                      </div>
                    </div>

                    <div className="inventoryFilterButtons">
                      <FilterButton
                        active={props.showOnlyWeapons}
                        ariaLabel={i18n.t("inventory.filterWeaponsAria")}
                        tooltipId="inventory-filter-weapons-tooltip"
                        tooltipLabel={i18n.t("inventory.filterWeapons")}
                        onClick={() => props.onToggleInventoryCategory("weapon")}
                        path="M4 16l4-4 2 2-4 4H4v-2zm8-9l1.5-1.5L16 8l-1.5 1.5L12 7zM10.5 8.5l1-1 1.5 1.5-1 1-1.5-1.5zM8 11l2-2 1.5 1.5-2 2L8 11z"
                      />
                      <FilterButton
                        active={props.showOnlyArmor}
                        ariaLabel={i18n.t("inventory.filterArmorAria")}
                        tooltipId="inventory-filter-armor-tooltip"
                        tooltipLabel={i18n.t("inventory.filterArmor")}
                        onClick={() => props.onToggleInventoryCategory("armor")}
                        path="M10 3l5 2v4c0 3.5-2.2 6-5 8-2.8-2-5-4.5-5-8V5l5-2zm0 2.2L7 6.3v2.6c0 2.4 1.4 4.3 3 5.8 1.6-1.5 3-3.4 3-5.8V6.3l-3-1.1z"
                      />
                      <FilterButton
                        active={props.showOnlyJewelry}
                        ariaLabel={i18n.t("inventory.filterJewelryAria")}
                        tooltipId="inventory-filter-jewelry-tooltip"
                        tooltipLabel={i18n.t("inventory.filterJewelry")}
                        onClick={() => props.onToggleInventoryCategory("jewelry")}
                        path="M10 5a5 5 0 105 5 5 5 0 00-5-5zm0 2a3 3 0 110 6 3 3 0 010-6zM4 4h3v2H4zM13 4h3v2h-3z"
                      />
                      <FilterButton
                        active={props.showOnlyWearable}
                        ariaLabel={i18n.t("inventory.filterWearableAria")}
                        tooltipId="inventory-filter-wearable-tooltip"
                        tooltipLabel={i18n.t("inventory.filterWearable")}
                        onClick={props.onToggleWearable}
                        path="M7 3h6l2 3-2 2-1-1v9H8V7L7 8 5 6l2-3z"
                      />
                    </div>
                  </div>
                  <p className="inventoryFilterSummary">
                    {i18n.t("inventory.summary", {
                      shown: props.filteredInventoryItems.length,
                      total: props.inventoryItems.length
                    })}
                  </p>
                </div>
                {props.renderInventoryCards(props.filteredInventoryItems, true)}
              </>
            ) : null}

            {props.profileSideTab === "consumables" ? (
              <>
                <div className="inventoryHeader">
                  <h3>{i18n.t("inventory.consumables")}</h3>
                  <p>{i18n.t("inventory.itemCount", { count: props.consumableItems.length })}</p>
                </div>
                {props.renderInventoryCards(props.consumableItems, false)}
              </>
            ) : null}

            {props.profileSideTab === "stats" ? (
              <>
                <div className="profileMeta">
                  <p>
                    {i18n.t("profile.class")}: <strong>{props.formatClassLabel(props.playerState.class)}</strong>
                  </p>
                  <p>
                    {i18n.t("profile.level")}: <strong>{props.playerState.level}</strong>
                  </p>
                </div>
                <div className="statsGroups">
                  {props.groupedStats.map((group) => (
                    <section key={group.title} className="statsGroup">
                      <h3 className="statsGroupTitle">{group.title}</h3>
                      <div className="statsRows">
                        {group.rows.map((row) => (
                          <div key={row.label} className="statsRow">
                            <span className="statsRowLabel">{row.label}</span>
                            <span className="statsRowValue">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : null}
            {props.renderInventoryComparisonOverlay()}
          </div>
        </article>
      </section>
    </section>
  );
}

type FilterButtonProps = {
  active: boolean;
  ariaLabel: string;
  tooltipId: string;
  tooltipLabel: string;
  onClick: () => void;
  path: string;
};

function FilterButton(props: FilterButtonProps) {
  return (
    <div className="inventoryControlWithTooltip">
      <button
        type="button"
        className={`inventoryIconButton${props.active ? " active" : ""}`}
        onClick={props.onClick}
        aria-label={props.ariaLabel}
        aria-pressed={props.active}
        aria-describedby={props.tooltipId}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d={props.path} />
        </svg>
      </button>
      <div id={props.tooltipId} className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorEnd" role="tooltip">
        <p className="uiHoverTooltipTitle">{props.tooltipLabel}</p>
      </div>
    </div>
  );
}
