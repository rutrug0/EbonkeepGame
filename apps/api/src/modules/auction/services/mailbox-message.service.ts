import { parseAuctionStoredItem } from "./item-payload.service.js";

function buildAuctionWingLabel(levelBracketMin: number, levelBracketMax: number): string {
  return levelBracketMin === levelBracketMax
    ? `Auction House Wing Lv ${levelBracketMin}`
    : `Auction House Wing Lv ${levelBracketMin}-${levelBracketMax}`;
}

export function buildAuctionOutbidMailboxMessage(args: {
  storedItemCode: string;
  levelBracketMin: number;
  levelBracketMax: number;
  refundedDucats: number;
}): { subject: string; body: string } {
  const item = parseAuctionStoredItem(args.storedItemCode);
  const wingLabel = buildAuctionWingLabel(args.levelBracketMin, args.levelBracketMax);

  return {
    subject: `Outbid: ${item.viewData.itemName} - ${wingLabel}`,
    body: `You were outbid on ${item.viewData.itemName} in ${wingLabel}. Your locked ${args.refundedDucats.toLocaleString()} ducats have been returned to this message and can now be claimed from your mailbox.`
  };
}

export function buildAuctionWonMailboxMessage(args: {
  storedItemCode: string;
  levelBracketMin: number;
  levelBracketMax: number;
  refundedDucats: number;
}): { subject: string; body: string } {
  const item = parseAuctionStoredItem(args.storedItemCode);
  const wingLabel = buildAuctionWingLabel(args.levelBracketMin, args.levelBracketMax);
  const ducatLine =
    args.refundedDucats > 0
      ? ` Your unused ${args.refundedDucats.toLocaleString()} reserved ducats were attached as well.`
      : "";

  return {
    subject: `Won: ${item.viewData.itemName} - ${wingLabel}`,
    body: `You won ${item.viewData.itemName} in ${wingLabel}. Claim the item from this message.${ducatLine}`
  };
}
