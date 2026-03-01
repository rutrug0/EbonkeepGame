import { useEffect, useMemo, useState, type MouseEvent } from "react";

import type { PlayerState } from "@ebonkeep/shared";

import { devGuestLogin, fetchPlayerState } from "./api.js";

type LandingTab = "profile" | "contract" | "guilds" | "auctionHouse" | "settings";
type Rarity = "common" | "uncommon" | "rare" | "epic";

type EquipmentSlot = {
  slot: string;
  itemName: string | null;
  rarity?: Rarity;
};

type InventoryItem = {
  slot: number;
  itemName: string;
  rarity: Rarity;
};

type InventoryTooltip = {
  item: InventoryItem;
  x: number;
  y: number;
};

const INVENTORY_SLOT_COUNT = 48;

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
  { slot: 1, itemName: "Cracked Potion", rarity: "common" },
  { slot: 2, itemName: "Minor Stamina Draught", rarity: "common" },
  { slot: 3, itemName: "Ashen Wand Core", rarity: "uncommon" },
  { slot: 5, itemName: "Tarnished Coin Purse", rarity: "common" },
  { slot: 9, itemName: "Bandit Emblem", rarity: "uncommon" },
  { slot: 10, itemName: "Rune Fragment", rarity: "rare" },
  { slot: 11, itemName: "Traveler Rations", rarity: "common" },
  { slot: 18, itemName: "Warden Signet", rarity: "rare" },
  { slot: 24, itemName: "Phoenix Feather", rarity: "epic" }
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

export function App() {
  const [token, setToken] = useState<string | null>(
    () => window.localStorage.getItem("ebonkeep.dev.token")
  );
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [activeTab, setActiveTab] = useState<LandingTab>("profile");
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryTooltip, setInventoryTooltip] = useState<InventoryTooltip | null>(null);

  const inventoryBySlot = useMemo(() => {
    return new Map(MOCK_INVENTORY_ITEMS.map((item) => [item.slot, item]));
  }, []);

  const profileName = playerState ? getDisplayName(playerState) : "Warden";
  const avatarInitial = profileName.charAt(0);

  const healthPercent = playerState
    ? Math.max(10, Math.min(100, Math.round((playerState.stats.vitality / 20) * 100)))
    : 0;
  const xpPercent = playerState ? Math.max(6, (playerState.level * 13) % 100) : 0;
  const occupiedInventorySlots = MOCK_INVENTORY_ITEMS.length;

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
              Occupied: {occupiedInventorySlots}/{INVENTORY_SLOT_COUNT}
            </p>
          </div>
          <div className="inventoryGrid">
            {Array.from({ length: INVENTORY_SLOT_COUNT }, (_, index) => {
              const slotNumber = index + 1;
              const item = inventoryBySlot.get(slotNumber);
              const rarityClass = item ? ` rarity-${item.rarity}` : "";

              return (
                <div key={slotNumber} className={`inventoryCell${item ? " hasItem" : ""}`}>
                  {item ? (
                    <div
                      className={`inventoryItemOverlay${rarityClass}`}
                      role="img"
                      aria-label={`${item.itemName} (${formatRarityLabel(item.rarity)})`}
                      onMouseEnter={(event) => showInventoryTooltip(event, item)}
                      onMouseMove={(event) => updateInventoryTooltip(event, item)}
                      onMouseLeave={hideInventoryTooltip}
                    >
                      <span className="inventoryItemIcon" aria-hidden="true" />
                    </div>
                  ) : null}
                </div>
              );
            })}
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
          <p>Slot: {inventoryTooltip.item.slot}</p>
        </div>
      ) : null}
    </main>
  );
}
