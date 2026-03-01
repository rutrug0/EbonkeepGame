import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent
} from "react";

import type { PlayerState } from "@ebonkeep/shared";

import { devGuestLogin, fetchPlayerState, moveInventoryItem } from "./api";

type LandingTab = "profile" | "contract" | "guilds" | "auctionHouse" | "settings";
type Rarity = "common" | "uncommon" | "rare" | "epic";

type EquipmentSlot = {
  slot: string;
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

const INVENTORY_COLUMNS = 12;
const INVENTORY_ROWS = 8;
const INVENTORY_SLOT_COUNT = INVENTORY_COLUMNS * INVENTORY_ROWS;

const MENU_ITEMS: Array<{ id: LandingTab; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "contract", label: "Contract" },
  { id: "guilds", label: "Guilds" },
  { id: "auctionHouse", label: "Auction House" },
  { id: "settings", label: "Settings" }
];

const MOCK_EQUIPMENT: EquipmentSlot[] = [
  { slot: "Weapon", itemName: "Initiate Iron Blade", rarity: "common" },
  { slot: "Offhand", itemName: null },
  { slot: "Helm", itemName: "Scout Hood", rarity: "uncommon" },
  { slot: "Chest", itemName: "Riveted Vest", rarity: "common" },
  { slot: "Gloves", itemName: null },
  { slot: "Boots", itemName: "Dustwalker Boots", rarity: "rare" },
  { slot: "Amulet", itemName: null },
  { slot: "Ring 1", itemName: "Band of Aim", rarity: "uncommon" },
  { slot: "Ring 2", itemName: null }
];

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

export function App() {
  const [token, setToken] = useState<string | null>(
    () => window.localStorage.getItem("ebonkeep.dev.token")
  );
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [activeTab, setActiveTab] = useState<LandingTab>("profile");
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryTooltip, setInventoryTooltip] = useState<InventoryTooltip | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => MOCK_INVENTORY_ITEMS);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [activeDropSlot, setActiveDropSlot] = useState<number | null>(null);

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

  const healthPercent = playerState
    ? Math.max(10, Math.min(100, Math.round((playerState.stats.vitality / 20) * 100)))
    : 0;
  const xpPercent = playerState ? Math.max(6, (playerState.level * 13) % 100) : 0;

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

  async function handleGuestLogin() {
    try {
      setError(null);
      const login = await devGuestLogin();
      window.localStorage.setItem("ebonkeep.dev.token", login.accessToken);
      setActiveTab("profile");
      setToken(login.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("ebonkeep.dev.token");
    setToken(null);
    setPlayerState(null);
    setActiveTab("profile");
    setError(null);
    setInventoryTooltip(null);
    setInventoryItems(MOCK_INVENTORY_ITEMS);
    setDraggingItemId(null);
    setActiveDropSlot(null);
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

  function renderProfilePanel() {
    if (isLoadingState) {
      return (
        <section className="contentCard">
          <h2>Profile</h2>
          <p>Loading player state...</p>
        </section>
      );
    }

    if (!playerState) {
      return (
        <section className="contentCard">
          <h2>Profile</h2>
          <p>Player state unavailable. Login again to refresh your data.</p>
        </section>
      );
    }

    const statRows: Array<{ label: string; value: number }> = [
      { label: "Strength", value: playerState.stats.strength },
      { label: "Intelligence", value: playerState.stats.intelligence },
      { label: "Dexterity", value: playerState.stats.dexterity },
      { label: "Vitality", value: playerState.stats.vitality },
      { label: "Initiative", value: playerState.stats.initiative },
      { label: "Luck", value: playerState.stats.luck }
    ];

    return (
      <section className="contentStack">
        <article className="contentCard">
          <h2>Profile</h2>
          <p>
            Class: <strong>{formatClassLabel(playerState.class)}</strong>
          </p>
          <p>
            Level: <strong>{playerState.level}</strong> | Gear Score: <strong>{playerState.gearScore}</strong>
          </p>
          <p>
            Currencies: <strong>{playerState.currency.ducats}</strong> ducats,{" "}
            <strong>{playerState.currency.imperials}</strong> imperials
          </p>
        </article>

        <article className="contentCard">
          <h3>Player Stats</h3>
          <div className="statsGrid">
            {statRows.map((stat) => (
              <div key={stat.label} className="statCell">
                <span className="statLabel">{stat.label}</span>
                <span className="statValue">{stat.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="contentCard">
          <h3>Equipment Slots</h3>
          <div className="equipmentGrid">
            {MOCK_EQUIPMENT.map((slot) => (
              <div key={slot.slot} className="equipmentCell">
                <span className="equipmentSlot">{slot.slot}</span>
                {slot.itemName ? (
                  <span className={`equipmentItem rarity-${slot.rarity}`}>{slot.itemName}</span>
                ) : (
                  <span className="equipmentEmpty">Empty</span>
                )}
              </div>
            ))}
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
                      left: `calc(${anchor.col} * var(--inventory-cell-size))`,
                      top: `calc(${anchor.row} * var(--inventory-cell-size))`,
                      width: `calc(${item.width} * var(--inventory-cell-size))`,
                      height: `calc(${item.height} * var(--inventory-cell-size))`
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
    );
  }

  function renderPlaceholderPanel(title: string, description: string) {
    return (
      <section className="contentCard">
        <h2>{title}</h2>
        <p>{description}</p>
      </section>
    );
  }

  function renderActivePanel() {
    switch (activeTab) {
      case "profile":
        return renderProfilePanel();
      case "contract":
        return renderPlaceholderPanel(
          "Contract",
          "Contract missions will appear here. This is a placeholder panel for the first layout."
        );
      case "guilds":
        return renderPlaceholderPanel(
          "Guilds",
          "Guild management and clan tools will appear here. This is a placeholder panel for now."
        );
      case "auctionHouse":
        return renderPlaceholderPanel(
          "Auction House",
          "Marketplace listings will appear here. This is a placeholder panel for the first iteration."
        );
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
        <div className="panelViewport">{renderActivePanel()}</div>
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
