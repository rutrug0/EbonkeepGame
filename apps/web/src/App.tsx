import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent
} from "react";

import type { PlayerState } from "@ebonkeep/shared";

import { devGuestLogin, fetchPlayerState, moveInventoryItem } from "./api";

type LandingTab =
  | "inventory"
  | "contracts"
  | "missions"
  | "arena"
  | "guild"
  | "castles"
  | "auctionHouse"
  | "merchant"
  | "leaderboards"
  | "settings";
type Rarity = "common" | "uncommon" | "rare" | "epic";
type ContractDifficulty = "easy" | "medium" | "hard";
type ContractRoll = "low" | "medium" | "high";

type EquipmentSlotId =
  | "helmet"
  | "necklace"
  | "upperArmor"
  | "belt"
  | "ringLeft"
  | "weapon"
  | "pauldrons"
  | "gloves"
  | "lowerArmor"
  | "boots"
  | "ringRight";

type EquipmentSlot = {
  label: string;
  itemName: string | null;
  rarity?: Rarity;
};

type InventoryItem = {
  id: string;
  slot: number;
  itemName: string;
  rarity: Rarity;
  width: number;
  height: number;
};

type InventoryTooltip = {
  item: InventoryItem;
  x: number;
  y: number;
};

type ContractBand = {
  low: number;
  medium: number;
  high: number;
};

type ContractTemplate = {
  id: string;
  name: string;
  difficulty: ContractDifficulty;
  experience: ContractBand;
  ducats: ContractBand;
  materials: ContractBand;
  itemDrop: ContractBand;
  staminaCost: ContractBand;
};

type ContractOffer = {
  instanceId: string;
  template: ContractTemplate;
  rollCue: {
    experience: ContractRoll;
    ducats: ContractRoll;
    materials: ContractRoll;
    itemDrop: ContractRoll;
    staminaCost: ContractRoll;
  };
  expiresAt: number;
};

type ContractSlotState = {
  slotIndex: number;
  offer: ContractOffer | null;
  replenishReadyAt: number | null;
};

const INVENTORY_COLUMNS = 12;
const INVENTORY_ROWS = 8;
const INVENTORY_SLOT_COUNT = INVENTORY_COLUMNS * INVENTORY_ROWS;
const CONTRACT_SLOT_COUNT = 6;
const CONTRACT_REPLENISH_MIN_MS = 60 * 60 * 1000;
const CONTRACT_REPLENISH_MAX_MS = 120 * 60 * 1000;

const MENU_ITEMS: Array<{ id: LandingTab; label: string }> = [
  { id: "inventory", label: "Inventory" },
  { id: "contracts", label: "Contracts" },
  { id: "missions", label: "Missions" },
  { id: "arena", label: "Arena" },
  { id: "guild", label: "Guild" },
  { id: "castles", label: "Castles" },
  { id: "auctionHouse", label: "Auction House" },
  { id: "merchant", label: "Merchant" },
  { id: "leaderboards", label: "Leaderboards" },
  { id: "settings", label: "Settings" }
];

const EQUIPMENT_LEFT_SLOTS: EquipmentSlotId[] = [
  "helmet",
  "necklace",
  "upperArmor",
  "belt",
  "ringLeft"
];
const EQUIPMENT_RIGHT_SLOTS: EquipmentSlotId[] = [
  "pauldrons",
  "gloves",
  "lowerArmor",
  "boots",
  "ringRight"
];

const MOCK_EQUIPMENT: Record<EquipmentSlotId, EquipmentSlot> = {
  helmet: { label: "Helmet", itemName: "Scout Hood", rarity: "uncommon" },
  necklace: { label: "Necklace", itemName: null },
  upperArmor: { label: "Upper Armor", itemName: "Riveted Vest", rarity: "common" },
  belt: { label: "Belt", itemName: null },
  ringLeft: { label: "Ring", itemName: "Band of Aim", rarity: "uncommon" },
  weapon: { label: "Weapon", itemName: "Initiate Iron Blade", rarity: "common" },
  pauldrons: { label: "Pauldrons", itemName: null },
  gloves: { label: "Gloves", itemName: null },
  lowerArmor: { label: "Lower Armor", itemName: "Braced Legguards", rarity: "common" },
  boots: { label: "Boots", itemName: "Dustwalker Boots", rarity: "rare" },
  ringRight: { label: "Ring", itemName: null }
};

const MOCK_INVENTORY_ITEMS: InventoryItem[] = [
  { id: "itm_brigandine_plate", slot: 1, itemName: "Brigandine Plate", rarity: "rare", width: 2, height: 3 },
  { id: "itm_steel_coffer", slot: 3, itemName: "Steel Coffer", rarity: "uncommon", width: 2, height: 2 },
  { id: "itm_stamina_minor", slot: 5, itemName: "Minor Stamina Draught", rarity: "common", width: 1, height: 1 },
  { id: "itm_rune_fragment", slot: 6, itemName: "Rune Fragment", rarity: "rare", width: 1, height: 1 },
  { id: "itm_worn_satchel", slot: 7, itemName: "Worn Satchel", rarity: "common", width: 2, height: 2 },
  { id: "itm_warden_signet", slot: 9, itemName: "Warden Signet", rarity: "rare", width: 1, height: 1 },
  { id: "itm_ashen_relic", slot: 10, itemName: "Ashen Relic", rarity: "uncommon", width: 2, height: 2 },
  { id: "itm_phoenix_feather", slot: 12, itemName: "Phoenix Feather", rarity: "epic", width: 1, height: 1 },
  { id: "itm_potion_cracked", slot: 27, itemName: "Cracked Potion", rarity: "common", width: 1, height: 1 },
  { id: "itm_bandit_emblem", slot: 28, itemName: "Bandit Emblem", rarity: "uncommon", width: 1, height: 1 }
];

const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "ashfen-trail",
    name: "Ashfen Caravan Escort",
    difficulty: "easy",
    experience: { low: 120, medium: 180, high: 260 },
    ducats: { low: 70, medium: 110, high: 170 },
    materials: { low: 2, medium: 4, high: 6 },
    itemDrop: { low: 8, medium: 14, high: 20 },
    staminaCost: { low: 8, medium: 11, high: 14 }
  },
  {
    id: "bogwatch-recon",
    name: "Bogwatch Recon Sweep",
    difficulty: "easy",
    experience: { low: 130, medium: 200, high: 280 },
    ducats: { low: 65, medium: 105, high: 165 },
    materials: { low: 3, medium: 5, high: 7 },
    itemDrop: { low: 9, medium: 15, high: 22 },
    staminaCost: { low: 9, medium: 12, high: 15 }
  },
  {
    id: "cinderhold-rats",
    name: "Cinderhold Purge Detail",
    difficulty: "medium",
    experience: { low: 200, medium: 300, high: 420 },
    ducats: { low: 120, medium: 180, high: 260 },
    materials: { low: 4, medium: 7, high: 10 },
    itemDrop: { low: 12, medium: 20, high: 29 },
    staminaCost: { low: 12, medium: 15, high: 18 }
  },
  {
    id: "spire-wardens",
    name: "Spire Warden Relief",
    difficulty: "medium",
    experience: { low: 210, medium: 320, high: 430 },
    ducats: { low: 125, medium: 190, high: 275 },
    materials: { low: 5, medium: 8, high: 11 },
    itemDrop: { low: 13, medium: 21, high: 30 },
    staminaCost: { low: 12, medium: 16, high: 19 }
  },
  {
    id: "blackbriar-break",
    name: "Blackbriar Siege Break",
    difficulty: "hard",
    experience: { low: 310, medium: 470, high: 620 },
    ducats: { low: 190, medium: 270, high: 380 },
    materials: { low: 7, medium: 11, high: 15 },
    itemDrop: { low: 18, medium: 28, high: 39 },
    staminaCost: { low: 16, medium: 19, high: 22 }
  },
  {
    id: "thornkeep-nightfall",
    name: "Thornkeep Nightfall Hunt",
    difficulty: "hard",
    experience: { low: 330, medium: 490, high: 650 },
    ducats: { low: 200, medium: 285, high: 395 },
    materials: { low: 8, medium: 12, high: 16 },
    itemDrop: { low: 19, medium: 30, high: 41 },
    staminaCost: { low: 17, medium: 20, high: 23 }
  }
];

const CONTRACT_AVAILABILITY_WINDOWS: Record<ContractDifficulty, { minMs: number; maxMs: number }> = {
  easy: { minMs: 35 * 60 * 1000, maxMs: 90 * 60 * 1000 },
  medium: { minMs: 25 * 60 * 1000, maxMs: 75 * 60 * 1000 },
  hard: { minMs: 20 * 60 * 1000, maxMs: 60 * 60 * 1000 }
};

function formatClassLabel(playerClass: PlayerState["class"]): string {
  return playerClass.charAt(0).toUpperCase() + playerClass.slice(1);
}

function formatRarityLabel(rarity: Rarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function getDisplayName(playerState: PlayerState): string {
  const idSuffix = playerState.playerId.slice(-6).toUpperCase();
  return `Warden ${idSuffix}`;
}

function slotToCoord(slot: number): { col: number; row: number } {
  const zeroBased = slot - 1;
  return {
    col: zeroBased % INVENTORY_COLUMNS,
    row: Math.floor(zeroBased / INVENTORY_COLUMNS)
  };
}

function coordToSlot(col: number, row: number): number {
  return row * INVENTORY_COLUMNS + col + 1;
}

function getItemSlots(item: InventoryItem, anchorSlot: number): number[] {
  const anchor = slotToCoord(anchorSlot);
  const slots: number[] = [];

  for (let rowOffset = 0; rowOffset < item.height; rowOffset += 1) {
    for (let colOffset = 0; colOffset < item.width; colOffset += 1) {
      const col = anchor.col + colOffset;
      const row = anchor.row + rowOffset;
      slots.push(coordToSlot(col, row));
    }
  }

  return slots;
}

function itemFitsWithinGrid(item: InventoryItem, anchorSlot: number): boolean {
  const anchor = slotToCoord(anchorSlot);
  return (
    anchor.col + item.width <= INVENTORY_COLUMNS &&
    anchor.row + item.height <= INVENTORY_ROWS
  );
}

function canPlaceItemAtSlot(
  items: InventoryItem[],
  itemToMove: InventoryItem,
  targetSlot: number
): boolean {
  if (!itemFitsWithinGrid(itemToMove, targetSlot)) {
    return false;
  }

  const targetSlots = new Set(getItemSlots(itemToMove, targetSlot));
  for (const existingItem of items) {
    if (existingItem.id === itemToMove.id) {
      continue;
    }
    const occupiedByExisting = getItemSlots(existingItem, existingItem.slot);
    if (occupiedByExisting.some((slot) => targetSlots.has(slot))) {
      return false;
    }
  }

  return true;
}

function getPlacementPreviewSlots(item: InventoryItem, targetSlot: number): Set<number> {
  const anchor = slotToCoord(targetSlot);
  const previewSlots = new Set<number>();

  for (let rowOffset = 0; rowOffset < item.height; rowOffset += 1) {
    for (let colOffset = 0; colOffset < item.width; colOffset += 1) {
      const col = anchor.col + colOffset;
      const row = anchor.row + rowOffset;
      if (col < INVENTORY_COLUMNS && row < INVENTORY_ROWS) {
        previewSlots.add(coordToSlot(col, row));
      }
    }
  }

  return previewSlots;
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDurationFromMs(value: number): string {
  const clampedSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

function randomContractRoll(): ContractRoll {
  const roll = randomInRange(1, 3);
  if (roll === 1) {
    return "low";
  }
  if (roll === 2) {
    return "medium";
  }
  return "high";
}

function createContractOffer(nowMs: number): ContractOffer {
  const template = CONTRACT_TEMPLATES[randomInRange(0, CONTRACT_TEMPLATES.length - 1)];
  const availabilityWindow = CONTRACT_AVAILABILITY_WINDOWS[template.difficulty];
  const durationMs = randomInRange(availabilityWindow.minMs, availabilityWindow.maxMs);
  return {
    instanceId: `${template.id}-${nowMs}-${randomInRange(1000, 9999)}`,
    template,
    rollCue: {
      experience: randomContractRoll(),
      ducats: randomContractRoll(),
      materials: randomContractRoll(),
      itemDrop: randomContractRoll(),
      staminaCost: randomContractRoll()
    },
    expiresAt: nowMs + durationMs
  };
}

function createContractSlots(nowMs: number): ContractSlotState[] {
  return Array.from({ length: CONTRACT_SLOT_COUNT }, (_, index) => ({
    slotIndex: index + 1,
    offer: createContractOffer(nowMs),
    replenishReadyAt: null
  }));
}

export function App() {
  const initialContractSlots = useMemo(() => createContractSlots(Date.now()), []);
  const [token, setToken] = useState<string | null>(
    () => window.localStorage.getItem("ebonkeep.dev.token")
  );
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [activeTab, setActiveTab] = useState<LandingTab>("inventory");
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryTooltip, setInventoryTooltip] = useState<InventoryTooltip | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => MOCK_INVENTORY_ITEMS);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [activeDropSlot, setActiveDropSlot] = useState<number | null>(null);
  const [contractSlots, setContractSlots] = useState<ContractSlotState[]>(() => initialContractSlots);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const occupiedInventorySlots = useMemo(() => {
    const occupied = new Set<number>();
    for (const item of inventoryItems) {
      for (const slot of getItemSlots(item, item.slot)) {
        occupied.add(slot);
      }
    }
    return occupied;
  }, [inventoryItems]);

  const inventoryItemsById = useMemo(() => {
    return new Map(inventoryItems.map((item) => [item.id, item]));
  }, [inventoryItems]);

  const dragPreview = useMemo(() => {
    if (!draggingItemId || !activeDropSlot) {
      return null;
    }
    const draggedItem = inventoryItemsById.get(draggingItemId);
    if (!draggedItem) {
      return null;
    }

    return {
      slots: getPlacementPreviewSlots(draggedItem, activeDropSlot),
      isValid: canPlaceItemAtSlot(inventoryItems, draggedItem, activeDropSlot)
    };
  }, [activeDropSlot, draggingItemId, inventoryItems, inventoryItemsById]);

  const profileName = playerState ? getDisplayName(playerState) : "Warden";
  const avatarInitial = profileName.charAt(0);

  const availableContractSlots = useMemo(
    () => contractSlots.filter((slot) => slot.offer !== null),
    [contractSlots]
  );
  const replenishingContractSlots = useMemo(
    () => contractSlots.filter((slot) => slot.offer === null && slot.replenishReadyAt !== null),
    [contractSlots]
  );

  const healthPercent = playerState
    ? Math.max(10, Math.min(100, Math.round((playerState.stats.vitality / 20) * 100)))
    : 0;
  const xpPercent = playerState ? Math.max(6, (playerState.level * 13) % 100) : 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!token) {
      setPlayerState(null);
      setIsLoadingState(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingState(true);
    setError(null);

    void fetchPlayerState(token)
      .then((state) => {
        if (active) {
          setPlayerState(state);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setPlayerState(null);
          setError(err instanceof Error ? err.message : "State load failed.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingState(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    setInventoryTooltip(null);
    setDraggingItemId(null);
    setActiveDropSlot(null);
  }, [activeTab]);

  useEffect(() => {
    setContractSlots((previousSlots) => {
      let hasChanges = false;
      const nextSlots = previousSlots.map((slot) => {
        if (slot.offer && nowMs >= slot.offer.expiresAt) {
          hasChanges = true;
          return {
            ...slot,
            offer: null,
            replenishReadyAt: nowMs + randomInRange(CONTRACT_REPLENISH_MIN_MS, CONTRACT_REPLENISH_MAX_MS)
          };
        }
        if (!slot.offer && slot.replenishReadyAt !== null && nowMs >= slot.replenishReadyAt) {
          hasChanges = true;
          return {
            ...slot,
            offer: createContractOffer(nowMs),
            replenishReadyAt: null
          };
        }
        return slot;
      });
      return hasChanges ? nextSlots : previousSlots;
    });
  }, [nowMs]);

  async function handleGuestLogin() {
    try {
      setError(null);
      const login = await devGuestLogin();
      window.localStorage.setItem("ebonkeep.dev.token", login.accessToken);
      setActiveTab("inventory");
      setToken(login.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("ebonkeep.dev.token");
    setToken(null);
    setPlayerState(null);
    setActiveTab("inventory");
    setError(null);
    setInventoryTooltip(null);
    setInventoryItems(MOCK_INVENTORY_ITEMS);
    setDraggingItemId(null);
    setActiveDropSlot(null);
    setContractSlots(createContractSlots(Date.now()));
  }

  function showInventoryTooltip(event: MouseEvent<HTMLDivElement>, item: InventoryItem) {
    setInventoryTooltip({
      item,
      x: event.clientX + 14,
      y: event.clientY + 16
    });
  }

  function updateInventoryTooltip(event: MouseEvent<HTMLDivElement>, item: InventoryItem) {
    setInventoryTooltip({
      item,
      x: event.clientX + 14,
      y: event.clientY + 16
    });
  }

  function hideInventoryTooltip() {
    setInventoryTooltip(null);
  }

  function toInventorySlotKey(slotNumber: number): string {
    return `inventory-${slotNumber}`;
  }

  function handleInventoryItemDragStart(
    event: DragEvent<HTMLDivElement>,
    itemId: string
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.setData("application/x-ebonkeep-item-id", itemId);
    const dragImage = event.currentTarget.cloneNode(true) as HTMLDivElement;
    const { width, height } = event.currentTarget.getBoundingClientRect();
    dragImage.style.width = `${width}px`;
    dragImage.style.height = `${height}px`;
    dragImage.style.position = "fixed";
    dragImage.style.top = "-9999px";
    dragImage.style.left = "-9999px";
    dragImage.style.pointerEvents = "none";
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, width / 2, height / 2);
    window.setTimeout(() => {
      dragImage.remove();
    }, 0);
    window.setTimeout(() => {
      setDraggingItemId(itemId);
    }, 0);
    setInventoryTooltip(null);
    setError(null);
  }

  function handleInventoryItemDragEnd() {
    setDraggingItemId(null);
    setActiveDropSlot(null);
  }

  function handleInventoryCellDragOver(
    event: DragEvent<HTMLDivElement>,
    slotNumber: number
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!draggingItemId) {
      return;
    }
    if (activeDropSlot !== slotNumber) {
      setActiveDropSlot(slotNumber);
    }
  }

  function handleInventoryCellDragEnter(
    event: DragEvent<HTMLDivElement>,
    slotNumber: number
  ) {
    event.preventDefault();
    if (!draggingItemId) {
      return;
    }
    if (activeDropSlot !== slotNumber) {
      setActiveDropSlot(slotNumber);
    }
  }

  async function moveDraggedItemToSlot(targetSlot: number, explicitItemId?: string) {
    const draggedId = explicitItemId ?? draggingItemId;
    if (!draggedId || !token) {
      setDraggingItemId(null);
      setActiveDropSlot(null);
      return;
    }

    const draggedItem = inventoryItemsById.get(draggedId);
    if (!draggedItem) {
      setDraggingItemId(null);
      setActiveDropSlot(null);
      return;
    }

    const fromSlot = draggedItem.slot;
    if (fromSlot === targetSlot) {
      setDraggingItemId(null);
      setActiveDropSlot(null);
      return;
    }

    if (!canPlaceItemAtSlot(inventoryItems, draggedItem, targetSlot)) {
      setDraggingItemId(null);
      setActiveDropSlot(null);
      return;
    }

    const previousItems = inventoryItems.map((item) => ({ ...item }));
    const nextItems = inventoryItems.map((item) => {
      if (item.id === draggedId) {
        return { ...item, slot: targetSlot };
      }
      return item;
    });

    setInventoryItems(nextItems);
    setDraggingItemId(null);
    setActiveDropSlot(null);
    setInventoryTooltip(null);

    try {
      await moveInventoryItem(
        token,
        draggedItem.id,
        toInventorySlotKey(fromSlot),
        toInventorySlotKey(targetSlot)
      );
    } catch (err: unknown) {
      setInventoryItems(previousItems);
      setError(err instanceof Error ? err.message : "Failed to move inventory item.");
    }
  }

  function handleInventoryCellDrop(
    event: DragEvent<HTMLDivElement>,
    slotNumber: number
  ) {
    event.preventDefault();
    const draggedId =
      event.dataTransfer.getData("application/x-ebonkeep-item-id") ||
      event.dataTransfer.getData("text/plain");
    if (!draggedId) {
      setDraggingItemId(null);
      setActiveDropSlot(null);
      return;
    }
    void moveDraggedItemToSlot(slotNumber, draggedId);
  }

  function formatContractDifficulty(difficulty: ContractDifficulty): string {
    return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  }

  function formatContractRoll(roll: ContractRoll): string {
    return roll.charAt(0).toUpperCase() + roll.slice(1);
  }

  function abandonContractSlot(slotIndex: number) {
    const startedAt = Date.now();
    setContractSlots((previousSlots) =>
      previousSlots.map((slot) => {
        if (slot.slotIndex !== slotIndex || !slot.offer) {
          return slot;
        }
        return {
          ...slot,
          offer: null,
          replenishReadyAt: startedAt + randomInRange(CONTRACT_REPLENISH_MIN_MS, CONTRACT_REPLENISH_MAX_MS)
        };
      })
    );
  }

  function renderProfilePanel() {
    if (isLoadingState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Inventory</h2>
              <p>Loading player state...</p>
            </article>
          </section>
        </section>
      );
    }

    if (!playerState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Inventory</h2>
              <p>Player state unavailable. Login again to refresh your data.</p>
            </article>
          </section>
        </section>
      );
    }

    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>Inventory</h2>
          </article>

          <article className="contentCard">
            <h3>Equipment Slots</h3>
            <div className="equipmentBoard">
              <div className="equipmentColumn equipmentColumnLeft">
                {EQUIPMENT_LEFT_SLOTS.map((slotId) => {
                  const slot = MOCK_EQUIPMENT[slotId];
                  const rarityClass = slot.rarity ? ` rarity-${slot.rarity}` : "";
                  return (
                    <div key={slotId} className="equipmentCell">
                      <span className="equipmentSlot">{slot.label}</span>
                      {slot.itemName ? (
                        <span className={`equipmentItem${rarityClass}`}>{slot.itemName}</span>
                      ) : (
                        <span className="equipmentEmpty">Empty</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="equipmentCenterColumn">
                <div className="characterVisual">
                  <div className="characterVisualFrame">
                    <div className="characterSilhouette" aria-hidden="true" />
                    <p className="characterVisualLabel">{profileName}</p>
                    <div className="equipmentCell equipmentWeaponCell equipmentWeaponOverlay">
                      <span className="equipmentSlot">{MOCK_EQUIPMENT.weapon.label}</span>
                      {MOCK_EQUIPMENT.weapon.itemName ? (
                        <span className={`equipmentItem rarity-${MOCK_EQUIPMENT.weapon.rarity}`}>
                          {MOCK_EQUIPMENT.weapon.itemName}
                        </span>
                      ) : (
                        <span className="equipmentEmpty">Empty</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="equipmentColumn equipmentColumnRight">
                {EQUIPMENT_RIGHT_SLOTS.map((slotId) => {
                  const slot = MOCK_EQUIPMENT[slotId];
                  const rarityClass = slot.rarity ? ` rarity-${slot.rarity}` : "";
                  return (
                    <div key={slotId} className="equipmentCell">
                      <span className="equipmentSlot">{slot.label}</span>
                      {slot.itemName ? (
                        <span className={`equipmentItem${rarityClass}`}>{slot.itemName}</span>
                      ) : (
                        <span className="equipmentEmpty">Empty</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          <article className="contentCard">
            <div className="inventoryHeader">
              <h3>Inventory Slots</h3>
              <p>
                Occupied: {occupiedInventorySlots.size}/{INVENTORY_SLOT_COUNT}
              </p>
            </div>
            <div className={`inventoryGrid${draggingItemId ? " draggingMode" : ""}`}>
              {Array.from({ length: INVENTORY_SLOT_COUNT }, (_, index) => {
                const slotNumber = index + 1;
                const occupiedClass = occupiedInventorySlots.has(slotNumber) ? " occupiedCell" : "";
                const previewClass = dragPreview?.slots.has(slotNumber)
                  ? dragPreview.isValid
                    ? " dropTargetValid"
                    : " dropTargetInvalid"
                  : "";

                return (
                  <div
                    key={slotNumber}
                    className={`inventoryCell${occupiedClass}${previewClass}`}
                    onDragEnter={(event) => handleInventoryCellDragEnter(event, slotNumber)}
                    onDragOver={(event) => handleInventoryCellDragOver(event, slotNumber)}
                    onDrop={(event) => handleInventoryCellDrop(event, slotNumber)}
                  />
                );
              })}
              <div className="inventoryItemsLayer">
                {inventoryItems.map((item) => {
                  const anchor = slotToCoord(item.slot);
                  const rarityClass = ` rarity-${item.rarity}`;
                  const draggingClass = draggingItemId === item.id ? " isDragging" : "";

                  return (
                    <div
                      key={item.id}
                      className={`inventoryItemOverlay${rarityClass}${draggingClass}`}
                      style={{
                        left: `${(anchor.col / INVENTORY_COLUMNS) * 100}%`,
                        top: `${(anchor.row / INVENTORY_ROWS) * 100}%`,
                        width: `${(item.width / INVENTORY_COLUMNS) * 100}%`,
                        height: `${(item.height / INVENTORY_ROWS) * 100}%`
                      }}
                      draggable
                      role="img"
                      aria-label={`${item.itemName} (${formatRarityLabel(item.rarity)} ${item.width}x${item.height})`}
                      onDragStart={(event) => handleInventoryItemDragStart(event, item.id)}
                      onDragEnd={handleInventoryItemDragEnd}
                      onMouseEnter={(event) => {
                        if (!draggingItemId) {
                          showInventoryTooltip(event, item);
                        }
                      }}
                      onMouseMove={(event) => {
                        if (!draggingItemId) {
                          updateInventoryTooltip(event, item);
                        }
                      }}
                      onMouseLeave={hideInventoryTooltip}
                    >
                      <span className="inventoryItemIcon" aria-hidden="true" />
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

  function renderProfileStatsPanel() {
    if (isLoadingState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Stats</h2>
              <p>Loading player stats...</p>
            </article>
          </section>
        </section>
      );
    }

    if (!playerState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Stats</h2>
              <p>Player state unavailable. Login again to refresh your data.</p>
            </article>
          </section>
        </section>
      );
    }

    const unavailableLabel = "Defined in docs (API pending)";
    const mainOffenseStat =
      playerState.class === "wizard"
        ? playerState.stats.intelligence
        : playerState.class === "archer"
          ? playerState.stats.dexterity
          : playerState.stats.strength;
    const mainOffenseTypeLabel =
      playerState.class === "wizard"
        ? "Spell Damage"
        : playerState.class === "archer"
          ? "Ranged Attack Damage"
          : "Melee Damage";
    const flatBonusDamage = (mainOffenseStat * 0.1).toFixed(1);

    const groupedStats: Array<{
      title: string;
      rows: Array<{ label: string; value: string | number }>;
    }> = [
      {
        title: "Main Stats",
        rows: [
          { label: "Strength", value: playerState.stats.strength },
          { label: "Intelligence", value: playerState.stats.intelligence },
          { label: "Dexterity", value: playerState.stats.dexterity },
          { label: "Vitality", value: playerState.stats.vitality },
          { label: "Initiative", value: playerState.stats.initiative },
          { label: "Luck", value: playerState.stats.luck }
        ]
      },
      {
        title: "Defensive",
        rows: [
          { label: "Armor", value: unavailableLabel },
          { label: "Spell Shield", value: unavailableLabel },
          { label: "Missile Resistance", value: unavailableLabel },
          { label: "Max Hitpoints", value: unavailableLabel }
        ]
      },
      {
        title: "Offensive",
        rows: [
          { label: mainOffenseTypeLabel, value: unavailableLabel },
          { label: "Crit Chance", value: unavailableLabel },
          { label: "Crit Damage", value: unavailableLabel },
          { label: "Combat Speed", value: unavailableLabel },
          { label: "Chance to Extra Attack", value: unavailableLabel },
          { label: "Flat Bonus Damage (Main Stat x 0.10)", value: flatBonusDamage }
        ]
      }
    ];

    return (
      <section className="contentShell statsViewportShell">
        <section className="contentStack statsViewportStack">
          <article className="contentCard statsViewportBody">
            <div className="profileMeta">
              <p>
                Class: <strong>{formatClassLabel(playerState.class)}</strong>
              </p>
              <p>
                Level: <strong>{playerState.level}</strong> | Gear Score:{" "}
                <strong>{playerState.gearScore}</strong>
              </p>
              <p>
                Currencies: <strong>{playerState.currency.ducats}</strong> ducats,{" "}
                <strong>{playerState.currency.imperials}</strong> imperials
              </p>
            </div>
            <div className="statsGroups">
              {groupedStats.map((group) => (
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
          </article>
        </section>
      </section>
    );
  }

  function renderContractsPanel() {
    if (isLoadingState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Contracts</h2>
              <p>Loading contracts board...</p>
            </article>
          </section>
        </section>
      );
    }

    if (!playerState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Contracts</h2>
              <p>Player state unavailable. Login again to refresh your data.</p>
            </article>
          </section>
        </section>
      );
    }

    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <div className="contractsHeader">
              <h2>Contracts</h2>
              <p>
                Available: {availableContractSlots.length}/{CONTRACT_SLOT_COUNT} | Replenishing:{" "}
                {replenishingContractSlots.length}
              </p>
            </div>
            <p>
              Contracts expire when their availability timer ends. Abandoning a contract starts its refill timer
              immediately.
            </p>
          </article>

          <article className="contentCard">
            <div className="contractsTableWrap">
              <table className="contractsTable">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Difficulty</th>
                    <th>Experience Roll</th>
                    <th>Ducats Roll</th>
                    <th>Materials Roll</th>
                    <th>Item Drop Roll</th>
                    <th>Stamina Roll</th>
                    <th>Expires In</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {contractSlots.map((slot) => {
                    if (!slot.offer) {
                      return (
                        <tr key={slot.slotIndex} className="contractsReplenishRow">
                          <td data-label="Contract">
                            <div className="contractsNameCell">
                              <strong>Slot {slot.slotIndex}</strong>
                              <span>Replenishing</span>
                            </div>
                          </td>
                          <td data-label="Status" colSpan={8} className="contractsReplenishMessage">
                            New contract available in{" "}
                            {slot.replenishReadyAt
                              ? formatDurationFromMs(slot.replenishReadyAt - nowMs)
                              : "00m 00s"}
                          </td>
                        </tr>
                      );
                    }

                    const { template, rollCue } = slot.offer;

                    return (
                      <tr key={slot.slotIndex}>
                        <td data-label="Contract">
                          <div className="contractsNameCell">
                            <strong>{template.name}</strong>
                            <span>Slot {slot.slotIndex}</span>
                          </div>
                        </td>
                        <td data-label="Difficulty">
                          <span className={`contractDifficulty contractDifficulty-${template.difficulty}`}>
                            {formatContractDifficulty(template.difficulty)}
                          </span>
                        </td>
                        <td data-label="Experience Roll">{formatContractRoll(rollCue.experience)}</td>
                        <td data-label="Ducats Roll">{formatContractRoll(rollCue.ducats)}</td>
                        <td data-label="Materials Roll">{formatContractRoll(rollCue.materials)}</td>
                        <td data-label="Item Drop Roll">{formatContractRoll(rollCue.itemDrop)}</td>
                        <td data-label="Stamina Roll">{formatContractRoll(rollCue.staminaCost)}</td>
                        <td data-label="Expires In" className="contractsTimeCell">
                          {formatDurationFromMs(slot.offer.expiresAt - nowMs)}
                        </td>
                        <td data-label="Action">
                          <button className="contractAbandonButton" onClick={() => abandonContractSlot(slot.slotIndex)}>
                            Abandon
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

  function renderPlaceholderPanel(title: string, description: string) {
    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        </section>
      </section>
    );
  }

  function renderActivePanel() {
    switch (activeTab) {
      case "inventory":
        return renderProfilePanel();
      case "contracts":
        return renderContractsPanel();
      case "missions":
        return renderPlaceholderPanel("Missions", "Mission selection and launch board will appear here.");
      case "arena":
        return renderPlaceholderPanel("Arena", "Arena matchmaking and battle history will appear here.");
      case "guild":
        return renderPlaceholderPanel("Guild", "Guild management and clan tools will appear here.");
      case "castles":
        return renderPlaceholderPanel("Castles", "Castle conquest systems and holdings will appear here.");
      case "auctionHouse":
        return renderPlaceholderPanel(
          "Auction House",
          "Marketplace listings will appear here. This is a placeholder panel for the first iteration."
        );
      case "merchant":
        return renderPlaceholderPanel("Merchant", "Merchant offers, rerolls, and purchases will appear here.");
      case "leaderboards":
        return renderPlaceholderPanel("Leaderboards", "Season rankings and score ladders will appear here.");
      case "settings":
        return renderPlaceholderPanel(
          "Settings",
          "Account and gameplay options will appear here. This is a placeholder panel for now."
        );
      default:
        return renderPlaceholderPanel("Panel", "Panel unavailable.");
    }
  }

  if (!token) {
    return (
      <main className="authPage">
        <section className="authCard">
          <h1>Ebonkeep</h1>
          <p>Login to open your post-login landing page.</p>
          <button onClick={handleGuestLogin}>Login as Guest</button>
          {error ? <div className="error">Error: {error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="landingPage">
      <aside className="leftPanel">
        <div className="leftPanelShell">
          <section className="playerCard">
            <div className="identityRow">
              <div className="avatar" aria-hidden="true">
                {avatarInitial}
              </div>
              <div className="identityText">
                <h1>{profileName}</h1>
                <p>{playerState ? formatClassLabel(playerState.class) : "Class unknown"}</p>
                <p>Level {playerState?.level ?? "-"}</p>
              </div>
            </div>

            <div className="barBlock">
              <p className="barLabel">Health</p>
              <div className="barShell">
                <div className="barFill healthFill" style={{ width: `${healthPercent}%` }} />
              </div>
            </div>

            <div className="barBlock">
              <p className="barLabel">Experience</p>
              <div className="barShell">
                <div className="barFill xpFill" style={{ width: `${xpPercent}%` }} />
              </div>
            </div>
          </section>

          <section className="menuCard">
            <h2>Menu</h2>
            <nav className="menuList">
              {MENU_ITEMS.map((menuItem) => (
                <button
                  key={menuItem.id}
                  className={`menuButton${activeTab === menuItem.id ? " active" : ""}`}
                  onClick={() => setActiveTab(menuItem.id)}
                >
                  {menuItem.label}
                </button>
              ))}
            </nav>
            <button className="logoutButton" onClick={handleLogout}>
              Logout
            </button>
          </section>
        </div>
      </aside>

      <section className="rightPanel">
        {activeTab === "inventory" ? (
          <div className="panelViewportGroup">
            <div className="panelViewportProfileMain">{renderProfilePanel()}</div>
            <div className="panelViewportStats">{renderProfileStatsPanel()}</div>
          </div>
        ) : (
          <div className="panelViewport">{renderActivePanel()}</div>
        )}
      </section>

      {error ? <div className="error floatingError">Error: {error}</div> : null}
      {inventoryTooltip ? (
        <div className="inventoryTooltip" style={{ left: inventoryTooltip.x, top: inventoryTooltip.y }}>
          <p className="tooltipName">{inventoryTooltip.item.itemName}</p>
          <p>Rarity: {formatRarityLabel(inventoryTooltip.item.rarity)}</p>
          <p>
            Size: {inventoryTooltip.item.width}x{inventoryTooltip.item.height}
          </p>
          <p>Slot: {inventoryTooltip.item.slot}</p>
        </div>
      ) : null}
    </main>
  );
}
