import type { CSSProperties, ReactElement } from "react";

import type { PlayerState } from "@ebonkeep/shared/player";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
import i18n from "../../i18n";

const MERCHANT_BACKGROUND_KEY = "indoors:merchant";

type MerchantStateLike = {
  offers: unknown[];
  nextRefreshAtMs: number;
};

type CurrencyStateLike = {
  ducats: number;
};

type MerchantSellEntryLike = {
  item: any;
  fromSlot: string;
};

type InventoryFilterStateLike = {
  showOnlyWeapons: boolean;
  showOnlyArmor: boolean;
  showOnlyJewelry: boolean;
  showOnlyWearable: boolean;
  powerSortDirection: "desc" | "asc";
};

export type MerchantPanelProps = {
  isMerchantLoading: boolean;
  playerState: PlayerState | null;
  merchantState: MerchantStateLike | null;
  nowMs: number;
  currencies: CurrencyStateLike | null;
  isMerchantMutating: boolean;
  merchantOfferFilters: InventoryFilterStateLike;
  merchantPlayerFilters: InventoryFilterStateLike;
  merchantInventoryItemsCount: number;
  filteredMerchantOffersCount: number;
  filteredMerchantInventoryItems: MerchantSellEntryLike[];
  onRestock: () => void;
  formatDurationFromMs: (value: number) => string;
  renderPlaceholderPanel: (title: string, description: string) => ReactElement;
  renderInventoryControlsRow: (args: {
    idPrefix: string;
    filters: InventoryFilterStateLike;
    totalCount: number;
    shownCount: number;
    onTogglePowerSort: () => void;
    onToggleCategory: (filter: "weapon" | "armor" | "jewelry") => void;
    onToggleWearable: () => void;
  }) => ReactElement;
  renderMerchantOffers: () => ReactElement;
  renderMerchantSellCards: (entries: any[]) => ReactElement;
  onToggleOfferPowerSort: () => void;
  onToggleOfferCategory: (filter: "weapon" | "armor" | "jewelry") => void;
  onToggleOfferWearable: () => void;
  onTogglePlayerPowerSort: () => void;
  onTogglePlayerCategory: (filter: "weapon" | "armor" | "jewelry") => void;
  onTogglePlayerWearable: () => void;
  renderInventoryComparisonOverlay: () => ReactElement | null;
};

export function MerchantPanel(props: MerchantPanelProps): ReactElement {
  if (props.isMerchantLoading) {
    return props.renderPlaceholderPanel(i18n.t("menu.merchant"), "Loading merchant stock...");
  }

  if (!props.playerState || !props.merchantState) {
    return props.renderPlaceholderPanel(i18n.t("menu.merchant"), "Merchant stock is unavailable.");
  }

  const nextRefreshMs = Math.max(0, props.merchantState.nextRefreshAtMs - props.nowMs);
  const inventorySellEntries = props.filteredMerchantInventoryItems.map((entry) => ({
    item: entry.item,
    fromSlot: "inventory"
  }));
  const currentDucats = props.currencies?.ducats ?? props.playerState.currency.ducats;
  const merchantBackgroundPath = GENERATED_ITEM_ICON_PATHS[MERCHANT_BACKGROUND_KEY];
  const merchantSceneStyle = merchantBackgroundPath
    ? ({
        "--indoor-scene-image": `url("${merchantBackgroundPath}")`
      } as CSSProperties)
    : undefined;

  return (
    <section className="contentShell merchantShell indoorSceneShell" style={merchantSceneStyle}>
      <section className="contentStack merchantStack">
        <section className="merchantColumns merchantSceneCard">
          <div className="merchantTradeActionRow">
            <button
              type="button"
              className="merchantTradeButton"
              onClick={props.onRestock}
              disabled={props.isMerchantMutating}
            >
              Restock
            </button>
          </div>
          <article className="contentCard merchantColumnCard">
            <div className="inventoryHeader">
              <h3>Merchant Inventory</h3>
              <p>{props.filteredMerchantOffersCount} offers</p>
            </div>
            {props.renderInventoryControlsRow({
              idPrefix: "merchant-stock",
              filters: props.merchantOfferFilters,
              totalCount: props.merchantState.offers.length,
              shownCount: props.filteredMerchantOffersCount,
              onTogglePowerSort: props.onToggleOfferPowerSort,
              onToggleCategory: props.onToggleOfferCategory,
              onToggleWearable: props.onToggleOfferWearable
            })}
            <div className="merchantColumnBody">{props.renderMerchantOffers()}</div>
          </article>

          <article className="contentCard merchantColumnCard">
            <div className="inventoryHeader">
              <h3>Your Inventory</h3>
              <p>{inventorySellEntries.length} bag items</p>
            </div>
            {props.renderInventoryControlsRow({
              idPrefix: "merchant-player",
              filters: props.merchantPlayerFilters,
              totalCount: props.merchantInventoryItemsCount,
              shownCount: inventorySellEntries.length,
              onTogglePowerSort: props.onTogglePlayerPowerSort,
              onToggleCategory: props.onTogglePlayerCategory,
              onToggleWearable: props.onTogglePlayerWearable
            })}
            <div className="merchantColumnBody merchantColumnBodyStacked">
              {props.renderMerchantSellCards(inventorySellEntries)}
            </div>
          </article>
        </section>
        {props.renderInventoryComparisonOverlay()}
      </section>
    </section>
  );
}
