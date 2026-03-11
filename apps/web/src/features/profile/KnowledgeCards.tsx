import type { ReactElement } from "react";

import type { GeneratedEncyclopediaItem } from "../../generated/itemEncyclopediaData";
import i18n from "../../i18n";

export type EncyclopediaItemCardProps = {
  item: GeneratedEncyclopediaItem | null;
  fallbackLabel?: string | null;
  formatTokenLabel: (value: unknown) => string;
};

export function EncyclopediaItemCard({
  item,
  fallbackLabel = null,
  formatTokenLabel
}: EncyclopediaItemCardProps): ReactElement {
  const isMonster = item?.majorCategory === "monster";
  const cardLabel = isMonster
    ? [
        item?.isBoss ? i18n.t("encyclopedia.boss") : formatTokenLabel(item?.slotFamily),
        formatTokenLabel(item?.itemType)
      ]
        .filter((value) => typeof value === "string" && value.length > 0)
        .join(" • ")
    : formatTokenLabel(item?.slotFamily || item?.family || item?.itemType || fallbackLabel || "item");

  return (
    <article
      className={`encyclopediaItemCard${item ? "" : " isMissing"}${isMonster ? " isMonster" : ""}${
        item?.isBoss ? " isBoss" : ""
      }`}
    >
      <div className="encyclopediaItemImageWrap" aria-hidden="true">
        {item?.iconPath ? (
          <img className="encyclopediaItemImage" src={item.iconPath} alt={item.itemName} loading="lazy" />
        ) : (
          <div className="encyclopediaItemPlaceholder">{i18n.t("item.artPending")}</div>
        )}
      </div>
      <div className="encyclopediaItemBody">
        <p className="encyclopediaItemMeta">{cardLabel}</p>
        <h3 className="encyclopediaItemName">{item?.itemName ?? i18n.t("item.missingItem")}</h3>
        <p className="encyclopediaItemFlavor">{item?.flavorText || i18n.t("item.noEntry")}</p>
      </div>
    </article>
  );
}

export type LedgerEntryCardProps = {
  item: GeneratedEncyclopediaItem;
  killCount: number;
  formatTokenLabel: (value: unknown) => string;
};

export function LedgerEntryCard({
  item,
  killCount,
  formatTokenLabel
}: LedgerEntryCardProps): ReactElement {
  const cardLabel = [
    item.isBoss ? i18n.t("encyclopedia.boss") : formatTokenLabel(item.slotFamily),
    formatTokenLabel(item.itemType)
  ]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" • ");

  return (
    <article className={`ledgerEntryCard${item.isBoss ? " isBoss" : ""}`}>
      <div className="ledgerEntryImageWrap" aria-hidden="true">
        {item.iconPath ? (
          <img className="ledgerEntryImage" src={item.iconPath} alt={item.itemName} loading="lazy" />
        ) : (
          <div className="encyclopediaItemPlaceholder">{i18n.t("item.artPending")}</div>
        )}
      </div>
      <div className="ledgerEntryBody">
        <p className="ledgerEntryMeta">{cardLabel}</p>
        <h3 className="ledgerEntryName">{item.itemName}</h3>
        <p className="ledgerEntryFlavor">{item.flavorText || i18n.t("item.noEntry")}</p>
        <div className="ledgerEntryStats">
          <p className="ledgerEntryStat">
            <span>Slain</span>
            <strong>{killCount}</strong>
          </p>
        </div>
      </div>
    </article>
  );
}
