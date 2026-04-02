import type { DragEvent, RefObject } from "react";

export type InventoryInsertPosition = "before" | "after";

type DragPayload<SlotId extends string> =
  | { source: "inventory"; itemId: string }
  | { source: "equipment"; slotId: SlotId; itemId: string }
  | { source: "merchant"; offerId: string; itemId: string };

type EquipmentDropState = "valid" | "invalid" | null;

type InventoryItemLike = {
  id: string;
};

type MerchantOfferLike = {
  offerId: string;
  item: InventoryItemLike;
};

type CreateInventoryInteractionsArgs<SlotId extends string, Item extends InventoryItemLike, Offer extends MerchantOfferLike> = {
  allEquipmentSlots: readonly SlotId[];
  dragPayloadMime: string;
  sidePanelScrollRef: RefObject<HTMLDivElement | null>;
  equippedItems: Record<SlotId, Item | null>;
  merchantOffers?: Offer[] | null;
  draggingEquipmentSlotId: SlotId | null;
  draggingInventoryCardId: string | null;
  draggingMerchantOfferId: string | null;
  dropTargetInventoryCardId: string | null;
  dropInsertPosition: InventoryInsertPosition;
  equipmentDropTargetSlotId: SlotId | null;
  setDraggingInventoryCardId: (value: string | null) => void;
  setDraggingEquipmentSlotId: (value: SlotId | null) => void;
  setDraggingMerchantOfferId: (value: string | null) => void;
  setDropTargetInventoryCardId: (value: string | null) => void;
  setDropInsertPosition: (value: InventoryInsertPosition) => void;
  setEquipmentDropTargetSlotId: (value: SlotId | null) => void;
  setEquipmentDropState: (value: EquipmentDropState) => void;
  onClearDragState?: () => void;
  clearInventoryComparisonHover: () => void;
  getItemById: (itemId: string) => Item | null;
  getEquipValidationError: (item: Item, targetSlotId: SlotId) => string | null;
  performInventoryMove: (itemId: string, fromSlot: string, toSlot: string) => Promise<void> | void;
  handleMerchantPlayerItemInteract: (itemId: string, fromSlot: string) => Promise<void> | void;
  handleMerchantOfferInteract: (offerId: string) => Promise<void> | void;
};

function isEquipmentSlotId<SlotId extends string>(value: string, allEquipmentSlots: readonly SlotId[]): value is SlotId {
  return allEquipmentSlots.includes(value as SlotId);
}

function setDragPayload<SlotId extends string>(
  event: DragEvent<HTMLElement>,
  payload: DragPayload<SlotId>,
  dragPayloadMime: string
) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(dragPayloadMime, JSON.stringify(payload));
  event.dataTransfer.setData("application/x-ebonkeep-item-id", payload.itemId);
  if (payload.source === "merchant") {
    event.dataTransfer.setData("application/x-ebonkeep-merchant-offer-id", payload.offerId);
  }
  event.dataTransfer.setData("text/plain", payload.itemId);
}

export function createInventoryInteractions<
  SlotId extends string,
  Item extends InventoryItemLike,
  Offer extends MerchantOfferLike
>(args: CreateInventoryInteractionsArgs<SlotId, Item, Offer>) {
  function readDragPayload(event: DragEvent<HTMLElement>): DragPayload<SlotId> | null {
    const serializedPayload = event.dataTransfer.getData(args.dragPayloadMime);
    if (serializedPayload) {
      try {
        const parsedPayload = JSON.parse(serializedPayload) as Partial<DragPayload<SlotId>>;
        if (parsedPayload.source === "inventory" && typeof parsedPayload.itemId === "string") {
          return { source: "inventory", itemId: parsedPayload.itemId };
        }
        if (
          parsedPayload.source === "equipment" &&
          typeof parsedPayload.itemId === "string" &&
          typeof parsedPayload.slotId === "string" &&
          isEquipmentSlotId(parsedPayload.slotId, args.allEquipmentSlots)
        ) {
          return { source: "equipment", itemId: parsedPayload.itemId, slotId: parsedPayload.slotId };
        }
        if (
          parsedPayload.source === "merchant" &&
          typeof parsedPayload.itemId === "string" &&
          typeof parsedPayload.offerId === "string"
        ) {
          return { source: "merchant", itemId: parsedPayload.itemId, offerId: parsedPayload.offerId };
        }
      } catch {
        return null;
      }
    }

    const fallbackItemId =
      event.dataTransfer.getData("application/x-ebonkeep-item-id") || event.dataTransfer.getData("text/plain");
    if (fallbackItemId) {
      return { source: "inventory", itemId: fallbackItemId };
    }

    if (args.draggingEquipmentSlotId) {
      const equippedItem = args.equippedItems[args.draggingEquipmentSlotId];
      if (equippedItem) {
        return { source: "equipment", slotId: args.draggingEquipmentSlotId, itemId: equippedItem.id };
      }
    }

    if (args.draggingInventoryCardId) {
      return { source: "inventory", itemId: args.draggingInventoryCardId };
    }

    if (args.draggingMerchantOfferId) {
      const merchantOffer = args.merchantOffers?.find((offer) => offer.offerId === args.draggingMerchantOfferId);
      if (merchantOffer) {
        return { source: "merchant", offerId: merchantOffer.offerId, itemId: merchantOffer.item.id };
      }
    }

    return null;
  }

  function clearDragState() {
    args.setDraggingInventoryCardId(null);
    args.setDraggingEquipmentSlotId(null);
    args.setDraggingMerchantOfferId(null);
    args.setDropTargetInventoryCardId(null);
    args.setEquipmentDropTargetSlotId(null);
    args.setEquipmentDropState(null);
    args.onClearDragState?.();
    args.clearInventoryComparisonHover();
  }

  function autoScrollInventoryList(pointerY: number) {
    const scrollContainer = args.sidePanelScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const edgeThreshold = 72;
    const maxStep = 24;

    if (pointerY < containerRect.top + edgeThreshold) {
      const intensity = (containerRect.top + edgeThreshold - pointerY) / edgeThreshold;
      scrollContainer.scrollTop -= Math.ceil(maxStep * intensity);
      return;
    }

    if (pointerY > containerRect.bottom - edgeThreshold) {
      const intensity = (pointerY - (containerRect.bottom - edgeThreshold)) / edgeThreshold;
      scrollContainer.scrollTop += Math.ceil(maxStep * intensity);
    }
  }

  async function handleEquipmentSlotDoubleClick(slotId: SlotId) {
    const sourceItem = args.equippedItems[slotId];
    if (!sourceItem) {
      return;
    }
    await args.performInventoryMove(sourceItem.id, slotId, "inventory");
  }

  function handleInventoryCardDragStart(event: DragEvent<HTMLElement>, itemId: string) {
    setDragPayload(event, { source: "inventory", itemId }, args.dragPayloadMime);
    args.setDraggingInventoryCardId(itemId);
    args.setDraggingEquipmentSlotId(null);
    args.setDraggingMerchantOfferId(null);
    args.setDropTargetInventoryCardId(itemId);
    args.setDropInsertPosition("before");
    args.setEquipmentDropTargetSlotId(null);
    args.setEquipmentDropState(null);
    args.clearInventoryComparisonHover();
  }

  function handleEquipmentSlotDragStart(event: DragEvent<HTMLElement>, slotId: SlotId) {
    const sourceItem = args.equippedItems[slotId];
    if (!sourceItem) {
      return;
    }

    setDragPayload(event, { source: "equipment", slotId, itemId: sourceItem.id }, args.dragPayloadMime);
    args.setDraggingEquipmentSlotId(slotId);
    args.setDraggingInventoryCardId(null);
    args.setDraggingMerchantOfferId(null);
    args.setDropTargetInventoryCardId(null);
    args.setEquipmentDropTargetSlotId(null);
    args.setEquipmentDropState(null);
  }

  function handleMerchantOfferDragStart(event: DragEvent<HTMLElement>, offerId: string, itemId: string) {
    setDragPayload(event, { source: "merchant", offerId, itemId }, args.dragPayloadMime);
    args.setDraggingMerchantOfferId(offerId);
    args.setDraggingInventoryCardId(null);
    args.setDraggingEquipmentSlotId(null);
    args.setDropTargetInventoryCardId(null);
    args.setEquipmentDropTargetSlotId(null);
    args.setEquipmentDropState(null);
    args.clearInventoryComparisonHover();
  }

  function handleInventoryCardDragOver(event: DragEvent<HTMLElement>, targetItemId: string) {
    const payload = readDragPayload(event);
    if (!payload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const cardRect = event.currentTarget.getBoundingClientRect();
    const insertPosition: InventoryInsertPosition =
      event.clientY < cardRect.top + cardRect.height / 2 ? "before" : "after";
    if (args.dropTargetInventoryCardId !== targetItemId) {
      args.setDropTargetInventoryCardId(targetItemId);
    }
    if (args.dropInsertPosition !== insertPosition) {
      args.setDropInsertPosition(insertPosition);
    }
    if (args.equipmentDropTargetSlotId !== null) {
      args.setEquipmentDropTargetSlotId(null);
      args.setEquipmentDropState(null);
    }
    autoScrollInventoryList(event.clientY);
  }

  function handleInventoryCardDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (payload?.source === "equipment") {
      void args.performInventoryMove(payload.itemId, payload.slotId, "inventory");
    }
    clearDragState();
  }

  function handleMerchantInventoryDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload) {
      clearDragState();
      return;
    }

    if (payload.source === "inventory") {
      void args.handleMerchantPlayerItemInteract(payload.itemId, "inventory");
    } else if (payload.source === "equipment") {
      void args.handleMerchantPlayerItemInteract(payload.itemId, payload.slotId);
    }

    clearDragState();
  }

  function handlePlayerMerchantListDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload) {
      clearDragState();
      return;
    }

    if (payload.source === "merchant") {
      void args.handleMerchantOfferInteract(payload.offerId);
    }

    clearDragState();
  }

  function handleInventoryCardDragEnd() {
    clearDragState();
  }

  function handleEquipmentSlotDragOver(event: DragEvent<HTMLElement>, targetSlotId: SlotId, invalidItemLabel: string) {
    const payload = readDragPayload(event);
    if (!payload) {
      return;
    }

    event.preventDefault();
    const sourceItem =
      payload.source === "inventory"
        ? args.getItemById(payload.itemId)
        : payload.source === "equipment" && payload.slotId
          ? args.equippedItems[payload.slotId]
          : null;
    const validationError = sourceItem ? args.getEquipValidationError(sourceItem, targetSlotId) : invalidItemLabel;
    event.dataTransfer.dropEffect = validationError ? "none" : "move";
    args.setEquipmentDropTargetSlotId(targetSlotId);
    args.setEquipmentDropState(validationError ? "invalid" : "valid");
  }

  function handleEquipmentSlotDrop(event: DragEvent<HTMLElement>, targetSlotId: SlotId) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (payload?.source === "inventory") {
      void args.performInventoryMove(payload.itemId, "inventory", targetSlotId);
    } else if (payload?.source === "equipment") {
      void args.performInventoryMove(payload.itemId, payload.slotId, targetSlotId);
    }
    clearDragState();
  }

  function handleEquipmentSlotDragLeave(event: DragEvent<HTMLElement>, targetSlotId: SlotId) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    if (args.equipmentDropTargetSlotId === targetSlotId) {
      args.setEquipmentDropTargetSlotId(null);
      args.setEquipmentDropState(null);
    }
  }

  function handleInventoryListDragOver(event: DragEvent<HTMLDivElement>) {
    const payload = readDragPayload(event as DragEvent<HTMLElement>);
    if (!payload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (args.equipmentDropTargetSlotId !== null) {
      args.setEquipmentDropTargetSlotId(null);
      args.setEquipmentDropState(null);
    }
    autoScrollInventoryList(event.clientY);
  }

  function handleInventoryListDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const payload = readDragPayload(event as DragEvent<HTMLElement>);
    if (!payload) {
      clearDragState();
      return;
    }

    if (payload.source === "equipment") {
      void args.performInventoryMove(payload.itemId, payload.slotId, "inventory");
      clearDragState();
      return;
    }
    clearDragState();
  }

  return {
    readDragPayload,
    handleEquipmentSlotDoubleClick,
    handleInventoryCardDragStart,
    handleEquipmentSlotDragStart,
    handleMerchantOfferDragStart,
    handleInventoryCardDragOver,
    handleInventoryCardDrop,
    handleMerchantInventoryDrop,
    handlePlayerMerchantListDrop,
    handleInventoryCardDragEnd,
    handleEquipmentSlotDragOver,
    handleEquipmentSlotDrop,
    handleEquipmentSlotDragLeave,
    handleInventoryListDragOver,
    handleInventoryListDrop
  };
}
