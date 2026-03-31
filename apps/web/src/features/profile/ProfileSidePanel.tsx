import type { CSSProperties, DragEventHandler, ReactElement, RefObject } from "react";

import type { PlayerState } from "@ebonkeep/shared/player";

import i18n from "../../i18n";
import { getViewBackgroundStyle } from "../../lib/viewBackgrounds";

type InventoryItemLike = {
  category: string;
  profileSideSubtype?: "potion" | "tonic" | "elixir" | "seed" | "plant" | "other";
} & Record<string, any>;

type StatsGroup = {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
};

type ProfileSideTab = "inventory" | "consumables" | "materials" | "stats";
type ConsumableFilter = "potion" | "tonic" | "elixir";
type MaterialFilter = "seed" | "plant" | "other";

export type ProfileSidePanelProps = {
  embedded?: boolean;
  isLoadingState: boolean;
  playerState: PlayerState | null;
  inventoryItems: InventoryItemLike[];
  inventorySlotCapacity: number;
  profileSideTab: ProfileSideTab;
  sidePanelScrollRef: RefObject<HTMLDivElement | null>;
  filteredInventoryItems: InventoryItemLike[];
  consumableItems: InventoryItemLike[];
  filteredConsumableItems: InventoryItemLike[];
  materialItems: InventoryItemLike[];
  filteredMaterialItems: InventoryItemLike[];
  activeConsumableFilter: ConsumableFilter | null;
  activeMaterialFilter: MaterialFilter | null;
  groupedStats: StatsGroup[];
  onTabChange: (tab: ProfileSideTab) => void;
  onInventoryScroll: () => void;
  onInventoryDragOver: DragEventHandler<HTMLDivElement>;
  onInventoryDrop: DragEventHandler<HTMLDivElement>;
  onToggleInventoryPowerSort: () => void;
  onToggleInventoryCategory: (filter: "weapon" | "armor" | "jewelry") => void;
  onToggleConsumableFilter: (filter: ConsumableFilter) => void;
  onToggleMaterialFilter: (filter: MaterialFilter) => void;
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
  const inventorySceneStyle = getViewBackgroundStyle("inventory") as CSSProperties;

  if (props.isLoadingState && !props.embedded) {
    return props.renderUnavailablePanel(i18n.t("profile.panel"), i18n.t("profile.loading"));
  }

  if (!props.playerState && !props.embedded) {
    return props.renderUnavailablePanel(i18n.t("profile.panel"), i18n.t("inventory.unavailable"));
  }

  const stackClassName = `contentStack statsViewportStack sidePanelStack${props.embedded ? " mergedCharacterSideStack" : ""}`;
  const tabsCardClassName = `contentCard sidePanelTabsCard${props.embedded ? " merchantSceneCard mergedCharacterSideTabsCard" : ""}`;
  const bodyClassName = `contentCard statsViewportBody sidePanelBodyCard${
    props.embedded ? " merchantSceneCard mergedCharacterSideBodyCard" : " indoorSceneShell"
  }`;

  const content = (
    <section className={stackClassName}>
      <article className={tabsCardClassName}>
        <div className="profileSideTabs">
          <div className="profileSideTabGroup">
            <TabIconButton
              active={props.profileSideTab === "inventory"}
              ariaLabel={i18n.t("profile.inventoryTabAria")}
              tooltipId="profile-tab-inventory-tooltip"
              tooltipLabel={i18n.t("profile.inventoryTab")}
              onClick={() => props.onTabChange("inventory")}
              path="M4 6.5h12l1.5 2.4V16a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 3 16V8.9L4 6.5zm1.1 2.2-.6.9V16h11V9.6l-.6-.9H5.1zm2 1.3h5.8v2H7.1v-2z"
            />
            <TabIconButton
              active={props.profileSideTab === "consumables"}
              ariaLabel={i18n.t("profile.consumablesTabAria")}
              tooltipId="profile-tab-consumables-tooltip"
              tooltipLabel={i18n.t("profile.consumablesTab")}
              onClick={() => props.onTabChange("consumables")}
              path="M8 3h4v2l1 1.2v2.1l2.2 5.1A2.2 2.2 0 0 1 13.2 17H6.8a2.2 2.2 0 0 1-2-3.6L7 8.3V6.2L8 5V3zm.6 6.3-2 4.5a.8.8 0 0 0 .7 1.2h5.4a.8.8 0 0 0 .7-1.2l-2-4.5H8.6z"
            />
            <TabIconButton
              active={props.profileSideTab === "materials"}
              ariaLabel={i18n.t("profile.materialsTabAria")}
              tooltipId="profile-tab-materials-tooltip"
              tooltipLabel={i18n.t("profile.materialsTab")}
              onClick={() => props.onTabChange("materials")}
              path="M10 3c1.8 0 3 1.2 3 3 0 .3 0 .6-.1.9 2 .4 3.1 1.8 3.1 3.8 0 2.6-2.3 4.5-6 6.3-3.7-1.8-6-3.7-6-6.3 0-2 1.1-3.4 3.1-3.8C7 6.6 7 6.3 7 6c0-1.8 1.2-3 3-3zm0 2c-.6 0-1 .4-1 1 0 .4.1.7.4 1l.6.7.6-.7c.3-.3.4-.6.4-1 0-.6-.4-1-1-1z"
            />
          </div>
          <div className="profileSideTabGroup profileSideTabGroupRight">
            <TabIconButton
              active={props.profileSideTab === "stats"}
              ariaLabel={i18n.t("profile.statsTabAria")}
              tooltipId="profile-tab-stats-tooltip"
              tooltipLabel={i18n.t("profile.statsTab")}
              onClick={() => props.onTabChange("stats")}
              path="M4 15h2V9H4v6zm5 0h2V5H9v10zm5 0h2V11h-2v4zM3 17h14v1H3z"
              align="right"
            />
          </div>
        </div>
      </article>

      <article className={bodyClassName} style={props.embedded ? undefined : inventorySceneStyle}>
        <div
          className="sidePanelScroll"
          ref={props.sidePanelScrollRef}
          onScroll={props.onInventoryScroll}
          onDragOver={props.profileSideTab === "inventory" ? props.onInventoryDragOver : undefined}
          onDrop={props.profileSideTab === "inventory" ? props.onInventoryDrop : undefined}
        >
          {props.isLoadingState ? <p>{i18n.t("profile.loading")}</p> : null}
          {!props.isLoadingState && !props.playerState ? <p>{i18n.t("inventory.unavailable")}</p> : null}

          {!props.isLoadingState && props.playerState && props.profileSideTab === "inventory" ? (
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

          {!props.isLoadingState && props.playerState && props.profileSideTab === "consumables" ? (
            <>
              <ReadOnlyCollectionToolbar
                title={i18n.t("profile.consumablesTab")}
                shownCount={props.filteredConsumableItems.length}
                totalCount={props.consumableItems.length}
              >
                <FilterButton
                  active={props.activeConsumableFilter === "potion"}
                  ariaLabel={i18n.t("profile.potionsFilter")}
                  tooltipId="consumables-filter-potion-tooltip"
                  tooltipLabel={i18n.t("profile.potionsFilter")}
                  onClick={() => props.onToggleConsumableFilter("potion")}
                  path="M8 3h4v2l1 1v2.2l2 5A2.1 2.1 0 0 1 13 16H7a2.1 2.1 0 0 1-2-2.8l2-5V6l1-1V3zm.8 6.2-1.2 3.2h4.8l-1.2-3.2H8.8z"
                />
                <FilterButton
                  active={props.activeConsumableFilter === "tonic"}
                  ariaLabel={i18n.t("profile.tonicsFilter")}
                  tooltipId="consumables-filter-tonic-tooltip"
                  tooltipLabel={i18n.t("profile.tonicsFilter")}
                  onClick={() => props.onToggleConsumableFilter("tonic")}
                  path="M9 3h2v2l2 2v1.5L15.5 12A2.5 2.5 0 0 1 13.4 16H6.6A2.5 2.5 0 0 1 4.5 12L7 8.5V7l2-2V3zm-.8 6-1.7 2.7a.9.9 0 0 0 .8 1.3h5.4a.9.9 0 0 0 .8-1.3L11.8 9H8.2z"
                />
                <FilterButton
                  active={props.activeConsumableFilter === "elixir"}
                  ariaLabel={i18n.t("profile.elixirsFilter")}
                  tooltipId="consumables-filter-elixir-tooltip"
                  tooltipLabel={i18n.t("profile.elixirsFilter")}
                  onClick={() => props.onToggleConsumableFilter("elixir")}
                  path="M10 2.8 11.2 6l3.3.2-2.6 2.1.9 3.2L10 9.9 7.2 11.5l.9-3.2-2.6-2.1L8.8 6 10 2.8zm-2 10.4h4l1.6 2.8H6.4L8 13.2z"
                />
              </ReadOnlyCollectionToolbar>
              {props.renderInventoryCards(props.filteredConsumableItems, false)}
            </>
          ) : null}

          {!props.isLoadingState && props.playerState && props.profileSideTab === "materials" ? (
            <>
              <ReadOnlyCollectionToolbar
                title={i18n.t("profile.materialsTab")}
                shownCount={props.filteredMaterialItems.length}
                totalCount={props.materialItems.length}
              >
                <FilterButton
                  active={props.activeMaterialFilter === "seed"}
                  ariaLabel={i18n.t("profile.seedsFilter")}
                  tooltipId="materials-filter-seeds-tooltip"
                  tooltipLabel={i18n.t("profile.seedsFilter")}
                  onClick={() => props.onToggleMaterialFilter("seed")}
                  path="M10 3c1.6 0 2.8 1.3 2.8 2.8 0 2.6-2 4.5-2.8 5.1-.8-.6-2.8-2.5-2.8-5.1C7.2 4.3 8.4 3 10 3zm0 2a.8.8 0 0 0-.8.8c0 .9.5 1.8.8 2.3.3-.5.8-1.4.8-2.3A.8.8 0 0 0 10 5zm-.8 8.4h1.6V17H9.2z"
                />
                <FilterButton
                  active={props.activeMaterialFilter === "plant"}
                  ariaLabel={i18n.t("profile.plantsFilter")}
                  tooltipId="materials-filter-plants-tooltip"
                  tooltipLabel={i18n.t("profile.plantsFilter")}
                  onClick={() => props.onToggleMaterialFilter("plant")}
                  path="M10 17v-6.4c0-2.9 2.1-5.1 4.8-5.4-.3 3.1-2.1 5.6-4.8 6V17H8.8v-2.8c-2.1-.3-3.8-1.9-4.1-4.1 2.4.2 4.1 1.6 4.5 4.1H10z"
                />
                <FilterButton
                  active={props.activeMaterialFilter === "other"}
                  ariaLabel={i18n.t("profile.otherMaterialsFilter")}
                  tooltipId="materials-filter-other-tooltip"
                  tooltipLabel={i18n.t("profile.otherMaterialsFilter")}
                  onClick={() => props.onToggleMaterialFilter("other")}
                  path="M6 6.5 10 4l4 2.5v4.8L10 14l-4-2.7V6.5zm4 .1-2 1.2V10l2 1.3 2-1.3V7.8L10 6.6zm-5 7.5 2.4-1.4 1 .6L6 14.8V17H5v-2.9zm10 0V17h-1v-2.2l-2.4-1.5 1-.6L15 14.1z"
                />
              </ReadOnlyCollectionToolbar>
              {props.renderInventoryCards(props.filteredMaterialItems, false)}
            </>
          ) : null}

          {!props.isLoadingState && props.playerState && props.profileSideTab === "stats" ? (
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
  );

  if (props.embedded) {
    return content;
  }

  return <section className="contentShell statsViewportShell">{content}</section>;
}

type ReadOnlyCollectionToolbarProps = {
  title: string;
  shownCount: number;
  totalCount: number;
  children: ReactElement | ReactElement[];
};

function ReadOnlyCollectionToolbar(props: ReadOnlyCollectionToolbarProps) {
  return (
    <div className="inventoryToolbarSticky">
      <div className="inventoryControlsRow inventoryControlsRowReadOnly">
        <div className="inventoryHeader inventoryHeaderCompact">
          <h3>{props.title}</h3>
          <p>{i18n.t("inventory.itemCount", { count: props.totalCount })}</p>
        </div>
        <div className="inventoryFilterButtons">{props.children}</div>
      </div>
      <p className="inventoryFilterSummary">
        {i18n.t("inventory.summary", {
          shown: props.shownCount,
          total: props.totalCount
        })}
      </p>
    </div>
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

type TabIconButtonProps = {
  active: boolean;
  ariaLabel: string;
  tooltipId: string;
  tooltipLabel: string;
  onClick: () => void;
  path: string;
  align?: "left" | "right";
};

function TabIconButton(props: TabIconButtonProps) {
  const tooltipAnchorClass = props.align === "right" ? "uiHoverTooltipAnchorEnd" : "uiHoverTooltipAnchorStart";

  return (
    <div className="inventoryControlWithTooltip profileSideTabControl">
      <button
        type="button"
        className={`profileSideTabButton${props.active ? " active" : ""}`}
        onClick={props.onClick}
        aria-label={props.ariaLabel}
        aria-pressed={props.active}
        aria-describedby={props.tooltipId}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d={props.path} />
        </svg>
      </button>
      <div id={props.tooltipId} className={`uiHoverTooltip uiHoverTooltipBottom ${tooltipAnchorClass}`} role="tooltip">
        <p className="uiHoverTooltipTitle">{props.tooltipLabel}</p>
      </div>
    </div>
  );
}
