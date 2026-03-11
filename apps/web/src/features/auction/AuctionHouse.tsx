import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { EquipmentSlotId, PlayerClass } from "@ebonkeep/shared/core";
import { isItemUsableByClass, type InventoryItem } from "@ebonkeep/shared/inventory";
import { DUCATS_ICON_PATH } from "../../constants/uiAssets";
import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";

type ItemMajorCategory = "weapon" | "armor" | "jewelry" | "vestige" | "consumable" | "material";
type WeaponArchetype = "melee" | "ranged" | "arcane";
type ArmorArchetype = "heavy" | "light" | "robe";

const AUCTION_HOUSE_BACKGROUND_KEY = "indoors:auction_house";

export interface AuctionHouseProps {
  token: string | null;
  currentDucats: number;
  playerClass?: PlayerClass | null;
  playerLevel?: number | null;
  equipmentBySlot?: Record<EquipmentSlotId, ComparableInventoryItem | null>;
  onDucatsChange?: (nextDucats: number) => void;
}

type AuctionStatus = "pending" | "active" | "settling" | "settled";

interface AuctionInstance {
  id: string;
  levelBracketMin: number;
  levelBracketMax: number;
  startTime: string;
  endTime: string;
  status: AuctionStatus;
  items: AuctionItem[];
}

interface AuctionItem {
  id: string;
  itemCode: string;
  itemLevel: number;
  itemRarity: string;
  itemCategory: string;
  startingBid: number;
  currentBid: number;
  currentWinnerId: string | null;
  currentWinnerName?: string | null;
  bidCount: number;
  extensionsUsed: number;
  isPlayerSubmitted: boolean;
  minimumNextBid?: number;
  amIWinning?: boolean;
  itemData?: ParsedItemData;
}

interface ParsedItemData {
  itemCode?: string;
  itemName: string;
  levelRequirement: number;
  baseLevel?: number;
  rarity: string;
  category: string;
  power?: number;
  equipable?: boolean;
  allowedSlotIds?: string[];
  statBonuses?: Partial<Record<string, number>>;
  damageRoll?: {
    minRollRange: [number, number];
    rolledMin: number;
    rolledMax: number;
    maxRollRange: [number, number];
    averageDamage: number;
  };
  description?: string;
  iconAssetPath?: string;
  prefix?: {
    name: string;
    tier: string;
    statKey: string;
    value: number;
    unit: string;
  };
  affix?: {
    name: string;
    tier: string;
    statKey: string;
    value: number;
    unit: string;
  };
  archetype?: {
    majorCategory?: string;
    weaponArchetype?: string;
    armorArchetype?: string;
    weaponFamily?: string;
    vestigeId?: string;
  };
  weaponType?: string;
  armorType?: string;
  jewelryType?: string;
}

type ComparableInventoryItem = {
  itemCode?: string;
  itemName: string;
  rarity: string;
  category: string;
  power?: number;
  equipable?: boolean;
  allowedSlotIds?: string[];
  levelRequirement: number;
  baseLevel?: number;
  iconAssetPath?: string;
  statBonuses?: Partial<Record<string, number>>;
  damageRoll?: ParsedItemData["damageRoll"];
  description?: string;
  archetype?: ParsedItemData["archetype"];
};

type ItemIconVariant =
  | "armor"
  | "weapon"
  | "jewelry"
  | "vestige"
  | "consumable"
  | "material"
  | "container"
  | "utility"
  | "generic";

interface PlayerBid {
  id: string;
  itemId: string;
  bidAmount: number;
  status: string;
  createdAt: string;
  item?: AuctionItem;
  isAutoBid?: boolean;
  maxAutoBid?: number;
}

interface PendingReward {
  id: string;
  itemCode: string;
  winningBid: number;
  expiresAt: string;
  claimed: boolean;
  createdAt: string;
}

interface PlayerSubmission {
  id: string;
  itemCode: string;
  minimumBid: number;
  status: string;
  createdAt: string;
  rejectionReason?: string;
}

interface AuctionHoverState {
  itemId: string;
  itemData: ParsedItemData;
  comparisonSlotId: EquipmentSlotId | null;
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

type AuctionView = "browse" | "submit" | "mySubmissions";

function preserveAuctionItemOrder(nextAuctions: AuctionInstance[], previousAuctions: AuctionInstance[]): AuctionInstance[] {
  const previousOrderByAuctionId = new Map(
    previousAuctions.map((auction) => [
      auction.id,
      new Map(auction.items.map((item, index) => [item.id, index]))
    ])
  );

  return nextAuctions.map((auction) => {
    const previousOrder = previousOrderByAuctionId.get(auction.id);
    if (!previousOrder) {
      return auction;
    }

    const items = [...auction.items].sort((left, right) => {
      const leftIndex = previousOrder.get(left.id);
      const rightIndex = previousOrder.get(right.id);

      if (leftIndex === undefined && rightIndex === undefined) {
        return 0;
      }
      if (leftIndex === undefined) {
        return 1;
      }
      if (rightIndex === undefined) {
        return -1;
      }
      return leftIndex - rightIndex;
    });

    return {
      ...auction,
      items
    };
  });
}

export function AuctionHouse({ token, currentDucats, playerClass, playerLevel, equipmentBySlot, onDucatsChange }: AuctionHouseProps) {
  const { t } = useTranslation("common");
  const auctionHouseBackgroundPath = GENERATED_ITEM_ICON_PATHS[AUCTION_HOUSE_BACKGROUND_KEY];
  const auctionHouseShellStyle = auctionHouseBackgroundPath
    ? ({
        "--indoor-scene-image": `url("${auctionHouseBackgroundPath}")`
      } as CSSProperties)
    : undefined;
  const [activeView, setActiveView] = useState<AuctionView>("browse");
  const [auctions, setAuctions] = useState<AuctionInstance[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionInstance | null>(null);
  const [myBids, setMyBids] = useState<PlayerBid[]>([]);
  const [pendingRewards, setPendingRewards] = useState<PendingReward[]>([]);
  const [mySubmissions, setMySubmissions] = useState<PlayerSubmission[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rerollingAuctions, setRerollingAuctions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<Record<string, string>>({});
  const [submittingBid, setSubmittingBid] = useState<string | null>(null);
  const [recentlyUpdatedBidItemId, setRecentlyUpdatedBidItemId] = useState<string | null>(null);
  const [submissionData, setSubmissionData] = useState({ itemId: "", minimumBid: "" });
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [displayDucats, setDisplayDucats] = useState(currentDucats);
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [autoBidEnabled, setAutoBidEnabled] = useState<Record<string, boolean>>({});
  const [autoBidMax, setAutoBidMax] = useState<Record<string, string>>({});
  const [enablingAutoBid, setEnablingAutoBid] = useState<string | null>(null);
  const [showAutoBidDisableModal, setShowAutoBidDisableModal] = useState(false);
  const [autoBidDisableTargetId, setAutoBidDisableTargetId] = useState<string | null>(null);
  const [auctionHover, setAuctionHover] = useState<AuctionHoverState | null>(null);

  const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

  const renderDucatIcon = (extraClassName?: string) => (
    <span className={`currencyIcon ducatIcon${extraClassName ? ` ${extraClassName}` : ""}`} aria-hidden="true">
      <img className="currencyIconImage" src={DUCATS_ICON_PATH} alt="" />
    </span>
  );

  const renderDucatAmount = (amount: number, extraClassName?: string) => (
    <span className={`ducatInlineAmount ducatsAmount${extraClassName ? ` ${extraClassName}` : ""}`}>
      <span>{amount.toLocaleString()}</span>
      {renderDucatIcon("ducatInlineIcon")}
    </span>
  );

  /**
   * Map backend error messages to localized translations
   */
  const translateBackendError = (errorMessage: string): string => {
    // Match "Bid must be at least X ducats"
    const bidMinMatch = errorMessage.match(/^Bid must be at least (\d+) ducats$/);
    if (bidMinMatch) {
      return t("auction.errors.bidBelowMinimum", { amount: bidMinMatch[1] });
    }

    // Match "Rate limit exceeded: max X bids per minute"
    if (errorMessage.includes("Rate limit exceeded")) {
      return t("auction.errors.rateLimitExceeded");
    }

    // Direct mapping for common backend errors
    const errorMap: Record<string, string> = {
      "Insufficient ducats": "auction.errors.insufficientDucats",
      "Item not found": "auction.errors.itemNotFound",
      "Auction is not active": "auction.errors.auctionNotActive",
      "Reward not found": "auction.errors.rewardNotFound",
      "This reward belongs to another player": "auction.errors.rewardBelongsToAnotherPlayer",
      "This reward has expired": "auction.errors.rewardExpired",
      "Listing not found": "auction.errors.listingNotFound",
      "Cannot cancel item with active bids": "auction.errors.cannotCancelWithBids",
      "Listing is not pending approval": "auction.errors.failedToCancel",
      "This listing belongs to another player": "auction.errors.failedToCancel"
    };

    const translationKey = errorMap[errorMessage];
    return translationKey ? t(translationKey) : errorMessage;
  };

  useEffect(() => {
    if (token) {
      void loadActiveAuctions();
      void loadMyBids();
      void loadPendingRewards();
      void loadMySubmissions();
      void loadInventory();
    }
  }, [token]);

  useEffect(() => {
    setDisplayDucats(currentDucats);
  }, [currentDucats]);

  const loadActiveAuctions = async (options?: { silent?: boolean }) => {
    if (!token) return;

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/v1/auction/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(t("auction.errors.failedToLoad"));
      }

      const data = await response.json();
      const nextAuctions = preserveAuctionItemOrder(data.auctions || [], auctions);
      setAuctions(nextAuctions);
      setSelectedAuction((previous) => {
        if (nextAuctions.length === 0) {
          return null;
        }

        if (!previous) {
          return nextAuctions[0];
        }

        return nextAuctions.find((auction: AuctionInstance) => auction.id === previous.id) || nextAuctions[0];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToLoad"));
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const loadMyBids = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/v1/auction/my-bids`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMyBids(data.bids || []);
      }
    } catch (err) {
      console.error("Failed to load bids:", err);
    }
  };

  const loadPendingRewards = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/v1/auction/rewards/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRewards(data.rewards || []);
      }
    } catch (err) {
      console.error("Failed to load rewards:", err);
    }
  };

  const loadMySubmissions = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/v1/auction/my-submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMySubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    }
  };

  const loadInventory = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/v1/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setInventoryItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  };

  const handleRerollAuctions = async () => {
    if (!token || rerollingAuctions) return;

    const refundedToCurrentPlayer = myBids.reduce(
      (sum, bid) => sum + (bid.maxAutoBid ?? bid.bidAmount ?? 0),
      0
    );

    setRerollingAuctions(true);
    setAuctionHover(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auction/test/reroll-auctions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("auction.errors.failedToReroll"));
      }

      if (refundedToCurrentPlayer > 0) {
        const nextDucats = displayDucats + refundedToCurrentPlayer;
        setDisplayDucats(nextDucats);
        onDucatsChange?.(nextDucats);
      }

      await Promise.all([loadActiveAuctions(), loadMyBids()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToReroll"));
    } finally {
      setRerollingAuctions(false);
    }
  };

  const getMinimumNextBid = (item: AuctionItem): number => {
    if (typeof item.minimumNextBid === "number") {
      return item.minimumNextBid;
    }

    const visibleBase = item.currentBid > 0 ? item.currentBid : item.startingBid;
    return visibleBase + 10;
  };

  const getPlayerReservedBidAmount = (itemId: string): number => {
    const bid = myBids.find((entry) => entry.itemId === itemId);
    return bid ? (bid.maxAutoBid ?? bid.bidAmount) : 0;
  };

  const handlePlaceBid = async (item: AuctionItem) => {
    if (!token || !bidAmount[item.id]) return;

    const amount = parseInt(bidAmount[item.id], 10);
    const minimumAcceptedBid = getMinimumNextBid(item);
    const reserveDelta = amount - getPlayerReservedBidAmount(item.id);
    if (isNaN(amount) || amount <= 0) {
      setError(t("auction.errors.invalidBid"));
      return;
    }

    if (amount < minimumAcceptedBid) {
      setError(t("auction.errors.bidBelowMinimum", { amount: minimumAcceptedBid }));
      return;
    }

    if (reserveDelta > displayDucats) {
      setError(t("auction.errors.insufficientDucats"));
      return;
    }

    setSubmittingBid(item.id);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auction/bid`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ itemId: item.id, bidAmount: amount })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error ? translateBackendError(data.error) : t("auction.errors.failedToBid");
        throw new Error(errorMsg);
      }

      setBidAmount((prev) => ({ ...prev, [item.id]: "" }));
      if (typeof data.remainingDucats === "number") {
        setDisplayDucats(data.remainingDucats);
        onDucatsChange?.(data.remainingDucats);
      }
      setRecentlyUpdatedBidItemId(item.id);
      await Promise.all([loadActiveAuctions({ silent: true }), loadMyBids()]);
      setTimeout(() => {
        setRecentlyUpdatedBidItemId((current) => (current === item.id ? null : current));
      }, 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToBid"));
    } finally {
      setSubmittingBid(null);
    }
  };

  const handleClaimReward = async (rewardId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/v1/auction/rewards/claim`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rewardId })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error ? translateBackendError(data.error) : t("auction.errors.failedToClaim");
        throw new Error(errorMsg);
      }

      await loadPendingRewards();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToClaim"));
    }
  };

  const handleSubmitItem = async () => {
    if (!token) return;

    if (!submissionData.itemId) {
      setError(t("auction.errors.selectItem"));
      return;
    }

    if (!submissionData.minimumBid || parseInt(submissionData.minimumBid) <= 0) {
      setError(t("auction.errors.enterBid"));
      return;
    }

    // Find the selected item in inventory
    const selectedItem = inventoryItems.find(item => item.id === submissionData.itemId);
    if (!selectedItem) {
      setError(t("auction.errors.selectItem"));
      return;
    }

    // Get the full item data
    const itemData = getInventoryItemData(selectedItem);

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auction/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          itemData: {
            ...itemData,
            inventoryItemId: selectedItem.id
          },
          desiredStartingBid: parseInt(submissionData.minimumBid)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error ? translateBackendError(data.error) : t("auction.errors.failedToSubmit");
        throw new Error(errorMsg);
      }

      // Clear form and reload data
      setSubmissionData({ itemId: "", minimumBid: "" });
      await Promise.all([
        loadMySubmissions(),
        loadInventory()
      ]);
      
      setActiveView("mySubmissions");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnableAutoBid = async (item: AuctionItem) => {
    if (!token) return;

    const maxBidInput = autoBidMax[item.id];
    if (!maxBidInput || maxBidInput.trim() === "") {
      setError(t("auction.errors.autoBidMaxRequired"));
      return;
    }

    const maxBid = parseInt(maxBidInput, 10);
    const minimumBid = getMinimumNextBid(item);

    if (isNaN(maxBid) || maxBid <= 0) {
      setError(t("auction.errors.invalidBid"));
      return;
    }

    if (maxBid < minimumBid) {
      setError(t("auction.errors.autoBidMaxTooLow", { amount: minimumBid }));
      return;
    }

    const currentReserved = getPlayerReservedBidAmount(item.id);
    const additionalReserve = Math.max(0, maxBid - currentReserved);

    if (additionalReserve > displayDucats) {
      setError(t("auction.errors.autoBidInsufficientDucats"));
      return;
    }

    setEnablingAutoBid(item.id);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auction/autobid/enable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ itemId: item.id, maxBid })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error ? translateBackendError(data.error) : t("auction.errors.autoBidEnableFailed");
        throw new Error(errorMsg);
      }

      setAutoBidEnabled((prev) => ({ ...prev, [item.id]: true }));
      if (typeof data.remainingDucats === "number") {
        setDisplayDucats(data.remainingDucats);
        onDucatsChange?.(data.remainingDucats);
      }
      await Promise.all([loadActiveAuctions({ silent: true }), loadMyBids()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.autoBidEnableFailed"));
    } finally {
      setEnablingAutoBid(null);
    }
  };

  const handleDisableAutoBid = async (itemId: string) => {
    if (!token) return;

    setEnablingAutoBid(itemId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auction/autobid/disable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ itemId })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error ? translateBackendError(data.error) : t("auction.errors.autoBidDisableFailed");
        throw new Error(errorMsg);
      }

      setAutoBidEnabled((prev) => ({ ...prev, [itemId]: false }));
      setAutoBidMax((prev) => ({ ...prev, [itemId]: "" }));
      if (typeof data.remainingDucats === "number") {
        setDisplayDucats(data.remainingDucats);
        onDucatsChange?.(data.remainingDucats);
      }
      await Promise.all([loadActiveAuctions({ silent: true }), loadMyBids()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.autoBidDisableFailed"));
    } finally {
      setEnablingAutoBid(null);
    }
  };

  // Helper functions for icon path generation
  const normalizeItemNameForArtLookup = (itemName: string): string => {
    return itemName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  };

  const getJewelryTypeForSlot = (slotId: EquipmentSlotId | undefined): "ring" | "necklace" | undefined => {
    if (!slotId) {
      return undefined;
    }
    if (slotId === "ringLeft" || slotId === "ringRight") {
      return "ring";
    }
    if (slotId === "necklace") {
      return "necklace";
    }
    return undefined;
  };

  const getGeneratedItemIconPath = (args: {
    majorCategory?: ItemMajorCategory;
    itemName: string;
    weaponArchetype?: WeaponArchetype;
    armorArchetype?: ArmorArchetype;
    equipSlotId?: EquipmentSlotId;
  }): string | undefined => {
    const itemName = normalizeItemNameForArtLookup(args.itemName);
    if (!itemName || !args.majorCategory) {
      return undefined;
    }

    if (args.majorCategory === "weapon" && args.weaponArchetype) {
      const key = `weapon:${args.weaponArchetype}:${itemName}`;
      return GENERATED_ITEM_ICON_PATHS[key];
    }

    if (args.majorCategory === "armor" && args.armorArchetype) {
      const key = `armor:${args.armorArchetype}:${itemName}`;
      return GENERATED_ITEM_ICON_PATHS[key];
    }

    if (args.majorCategory === "jewelry") {
      const jewelryType = getJewelryTypeForSlot(args.equipSlotId);
      if (!jewelryType) {
        return undefined;
      }
      const key = `jewelry:${jewelryType}:${itemName}`;
      return GENERATED_ITEM_ICON_PATHS[key];
    }

    return undefined;
  };

  const parseItemData = (itemCode: string): ParsedItemData => {
    try {
      const parsed = JSON.parse(itemCode) as Record<string, unknown>;
      if (!parsed || Array.isArray(parsed)) {
        throw new Error("Invalid item payload");
      }

      if (typeof parsed.itemName === "string") {
        return {
          itemCode: typeof parsed.itemCode === "string" ? parsed.itemCode : itemCode,
          itemName: parsed.itemName,
          levelRequirement:
            typeof parsed.levelRequirement === "number"
              ? parsed.levelRequirement
              : typeof parsed.baseLevel === "number"
                ? parsed.baseLevel
                : 1,
          baseLevel: typeof parsed.baseLevel === "number" ? parsed.baseLevel : undefined,
          rarity: typeof parsed.rarity === "string" ? parsed.rarity : "common",
          category: typeof parsed.category === "string" ? parsed.category : "misc",
          power: typeof parsed.power === "number" ? parsed.power : 0,
          equipable: typeof parsed.equipable === "boolean" ? parsed.equipable : true,
          allowedSlotIds: Array.isArray(parsed.allowedSlotIds)
            ? parsed.allowedSlotIds.filter((slotId): slotId is string => typeof slotId === "string")
            : undefined,
          statBonuses:
            parsed.statBonuses && typeof parsed.statBonuses === "object" && !Array.isArray(parsed.statBonuses)
              ? (parsed.statBonuses as Record<string, number>)
              : undefined,
          damageRoll:
            parsed.damageRoll && typeof parsed.damageRoll === "object" && !Array.isArray(parsed.damageRoll)
              ? (parsed.damageRoll as ParsedItemData["damageRoll"])
              : undefined,
          description: typeof parsed.description === "string" ? parsed.description : "",
          iconAssetPath: typeof parsed.iconAssetPath === "string" ? parsed.iconAssetPath : undefined,
          prefix:
            parsed.prefix && typeof parsed.prefix === "object" && !Array.isArray(parsed.prefix)
              ? (parsed.prefix as ParsedItemData["prefix"])
              : undefined,
          affix:
            parsed.affix && typeof parsed.affix === "object" && !Array.isArray(parsed.affix)
              ? (parsed.affix as ParsedItemData["affix"])
              : undefined,
          archetype:
            parsed.archetype && typeof parsed.archetype === "object" && !Array.isArray(parsed.archetype)
              ? (parsed.archetype as ParsedItemData["archetype"])
              : undefined,
          weaponType: typeof parsed.weaponType === "string" ? parsed.weaponType : undefined,
          armorType: typeof parsed.armorType === "string" ? parsed.armorType : undefined,
          jewelryType: typeof parsed.jewelryType === "string" ? parsed.jewelryType : undefined
        };
      }

      return {
        itemCode: typeof parsed.itemCode === "string" ? parsed.itemCode : itemCode,
        itemName: typeof parsed.name === "string" ? parsed.name : t("profile.unknown"),
        levelRequirement: typeof parsed.level === "number" ? parsed.level : 1,
        rarity: typeof parsed.rarity === "string" ? parsed.rarity : "common",
        category: typeof parsed.category === "string" ? parsed.category : "misc",
        power: typeof parsed.power === "number" ? parsed.power : 0,
        statBonuses:
          parsed.stats && typeof parsed.stats === "object" && !Array.isArray(parsed.stats)
            ? (parsed.stats as Record<string, number>)
            : undefined,
        iconAssetPath: typeof parsed.iconAssetPath === "string" ? parsed.iconAssetPath : undefined,
        weaponType: typeof parsed.weaponType === "string" ? parsed.weaponType : undefined,
        armorType: typeof parsed.armorType === "string" ? parsed.armorType : undefined,
        jewelryType: typeof parsed.jewelryType === "string" ? parsed.jewelryType : undefined,
        description: typeof parsed.description === "string" ? parsed.description : ""
      };
    } catch {
      return {
        itemCode,
        itemName: t("profile.unknown"),
        levelRequirement: 1,
        rarity: "common",
        category: "misc",
        power: 0,
        statBonuses: {},
        description: ""
      };
    }
  };

  const getAuctionItemData = (item: Pick<AuctionItem, "itemCode"> & { itemData?: ParsedItemData }): ParsedItemData => {
    return item.itemData ?? parseItemData(item.itemCode);
  };

  const buildWeaponLookupKey = (itemData: ParsedItemData): WeaponArchetype | undefined => {
    const weaponArchetype = itemData.archetype?.weaponArchetype;
    if (!weaponArchetype) {
      return undefined;
    }

    return weaponArchetype as WeaponArchetype;
  };

  const getItemMajorCategory = (itemData: ParsedItemData): ItemMajorCategory | undefined => {
    const majorCategory = itemData.archetype?.majorCategory;
    if (majorCategory === "weapon" || majorCategory === "armor" || majorCategory === "jewelry" || majorCategory === "vestige") {
      return majorCategory;
    }

    const category = itemData.category.toLowerCase();
    if (category.includes("weapon")) return "weapon";
    if (category.includes("armor")) return "armor";
    if (category.includes("jewelry") || category.includes("ring") || category.includes("necklace")) return "jewelry";
    return undefined;
  };

  const formatLabel = (value: string): string => {
    return value
      .replace(/[/_,-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (match) => match.toUpperCase())
      .trim();
  };

  const getItemSubtypeLabel = (itemData: ParsedItemData): string => {
    if (itemData.archetype?.majorCategory === "armor" && itemData.archetype.armorArchetype) {
      return `${formatLabel(itemData.archetype.armorArchetype)} Armor`;
    }
    if (itemData.archetype?.majorCategory === "weapon" && itemData.archetype.weaponFamily) {
      return formatLabel(itemData.archetype.weaponFamily);
    }
    if (itemData.archetype?.majorCategory === "jewelry") {
      return itemData.jewelryType ? formatLabel(itemData.jewelryType) : formatLabel(itemData.category);
    }
    if (itemData.weaponType) {
      return formatLabel(itemData.weaponType);
    }
    if (itemData.armorType) {
      return `${formatLabel(itemData.armorType)} Armor`;
    }
    return formatLabel(itemData.category);
  };

  const getDisplayStatBonuses = (itemData: ParsedItemData): Array<{ key: string; value: number }> => {
    return Object.entries(itemData.statBonuses ?? {})
      .map(([key, value]) => ({ key, value: typeof value === "number" ? value : 0 }))
      .filter((entry) => entry.value !== 0);
  };

  const formatStatValue = (statKey: string, value: number): string => {
    if (/chance|multiplier/i.test(statKey)) {
      return `${value > 0 ? "+" : ""}${(value / 100).toFixed(1).replace(/\.0$/, "")}%`;
    }
    return `${value > 0 ? "+" : ""}${value}`;
  };

  const getDamageSummary = (itemData: ParsedItemData) => {
    if (!itemData.damageRoll) {
      return null;
    }

    return {
      damageLine: `${itemData.damageRoll.rolledMin}-${itemData.damageRoll.rolledMax} damage`,
      rollLine: `Roll range ${itemData.damageRoll.minRollRange[0]}-${itemData.damageRoll.maxRollRange[1]}`
    };
  };

  const resolveAuctionItemIconPath = (itemData: ParsedItemData): string | undefined => {
    if (itemData.iconAssetPath) {
      return itemData.iconAssetPath;
    }

    return getGeneratedItemIconPath({
      majorCategory: getItemMajorCategory(itemData),
      weaponArchetype: buildWeaponLookupKey(itemData),
      armorArchetype: itemData.archetype?.armorArchetype as ArmorArchetype | undefined,
      itemName: itemData.itemName,
      equipSlotId: (itemData.allowedSlotIds?.[0] as EquipmentSlotId | undefined) ?? undefined
    });
  };

  const getInventoryItemData = (item: ComparableInventoryItem): ParsedItemData => {
    const preferredSlotId = item.allowedSlotIds?.[0] as EquipmentSlotId | undefined;
    const iconPath = getGeneratedItemIconPath({
      majorCategory: item.archetype?.majorCategory as ItemMajorCategory,
      weaponArchetype: item.archetype?.weaponArchetype as WeaponArchetype | undefined,
      armorArchetype: item.archetype?.armorArchetype as ArmorArchetype,
      itemName: item.itemName,
      equipSlotId: preferredSlotId
    });

    return {
      itemCode: item.itemCode ?? item.itemName,
      itemName: item.itemName,
      levelRequirement: item.levelRequirement ?? item.baseLevel ?? 1,
      baseLevel: item.baseLevel,
      rarity: item.rarity,
      category: item.category,
      power: item.power,
      equipable: item.equipable,
      allowedSlotIds: item.allowedSlotIds,
      iconAssetPath: iconPath,
      statBonuses: item.statBonuses,
      damageRoll: item.damageRoll,
      description: item.description,
      archetype: item.archetype,
      weaponType: item.archetype?.weaponFamily,
      armorType: item.archetype?.armorArchetype,
      jewelryType: item.archetype?.majorCategory === "jewelry" ? "jewelry" : undefined
    };
  };

  const canPlayerUseAuctionItem = (itemData: ParsedItemData): boolean => {
    if (!itemData.equipable || !itemData.archetype || !playerClass || playerLevel == null) {
      return itemData.equipable !== false;
    }

    const archetypeClassKey = (itemData.archetype.weaponArchetype ?? itemData.archetype.armorArchetype) as
      | WeaponArchetype
      | ArmorArchetype
      | undefined;
    const isClassEligible = isItemUsableByClass(
      playerClass,
      itemData.archetype.majorCategory as "weapon" | "armor" | "jewelry" | "vestige",
      archetypeClassKey
    );
    const isLevelEligible = playerLevel >= itemData.levelRequirement;

    return isClassEligible && isLevelEligible;
  };

  const renderAuctionItemDetailCardBody = (
    itemData: ParsedItemData,
    options?: {
      asideNote?: string;
      powerDelta?: number;
    }
  ) => {
    const canUseItem = canPlayerUseAuctionItem(itemData);
    const damageSummary = getDamageSummary(itemData);
    const iconAssetPath = resolveAuctionItemIconPath(itemData);
    const statBonuses = getDisplayStatBonuses(itemData);

    return (
      <>
        <div className="inventoryCardTop">
          <div className="inventoryCardMeta">
            <h4>{itemData.itemName}</h4>
            <p className="inventoryCardCategory">{getItemSubtypeLabel(itemData)}</p>
          </div>
          <div className="inventoryCardTopAside">
            <span className="inventoryCardRarity">{formatLabel(itemData.rarity)}</span>
            {options?.asideNote ? <span className="inventoryCardTopAsideNote">{options.asideNote}</span> : null}
          </div>
        </div>
        <div className={`inventoryCardVisual${canUseItem ? "" : " isRestricted"}`}>
          {renderItemIcon({
            majorCategory: getItemMajorCategory(itemData),
            category: itemData.category,
            itemName: itemData.itemName,
            iconAssetPath,
            renderMode: iconAssetPath ? "imageOnly" : "default",
            className: iconAssetPath ? undefined : `inventoryCardIcon${canUseItem ? "" : " isRestricted"}`
          })}
        </div>
        <div className="inventoryCardContent">
          {damageSummary ? (
            <div className="inventoryCardDamageBlock">
              <p className="inventoryCardDamagePrimary">{damageSummary.damageLine}</p>
              <p className="inventoryCardDamageRollMeta">{damageSummary.rollLine}</p>
            </div>
          ) : null}
          {statBonuses.length > 0 ? (
            <div className="inventoryCardModifierList">
              {statBonuses.map((entry) => (
                <p key={entry.key} className="inventoryCardModifierLine">
                  <span>{formatLabel(entry.key)}</span>
                  <span> {formatStatValue(entry.key, entry.value)}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="inventoryCardDetails">
          <p className="inventoryCardDescription inventoryCardFlavor">{itemData.description || " "}</p>
          <div className="inventoryCardFooter">
            <span className="inventoryCardPower">
              {t("inventory.power", { value: itemData.power ?? 0 })}
              {typeof options?.powerDelta === "number" && options.powerDelta !== 0 ? (
                <span className={`inventoryCardPowerDelta ${options.powerDelta > 0 ? "positive" : "negative"}`}>
                  {` (${options.powerDelta > 0 ? `+${options.powerDelta}` : options.powerDelta})`}
                </span>
              ) : null}
            </span>
            <span className={`inventoryCardLevel${canUseItem ? "" : " isRestricted"}`}>{t("inventory.requiredLevel", { value: itemData.levelRequirement })}</span>
          </div>
        </div>
      </>
    );
  };

  const handleAuctionItemMouseEnter = (item: AuctionItem, cardElement: HTMLElement) => {
    const itemData = getAuctionItemData(item);
    const rect = cardElement.getBoundingClientRect();
    const viewportPadding = 8;
    const gapPx = 12;
    const panelWidth = Math.min(360, Math.max(260, window.innerWidth - viewportPadding * 2));
    const maxHeight = Math.max(220, window.innerHeight - viewportPadding * 2);
    const preferredSlotId = (itemData.equipable ? itemData.allowedSlotIds?.[0] : null) as EquipmentSlotId | null;
    const comparisonItem = preferredSlotId ? equipmentBySlot?.[preferredSlotId] ?? null : null;
    const comparisonSlotId = comparisonItem ? preferredSlotId : null;
    const estimatedPanelHeight = Math.min(maxHeight, comparisonSlotId ? 640 : 420);
    const rightSpace = window.innerWidth - rect.right - viewportPadding;
    const leftSpace = rect.left - viewportPadding;
    const placeOnRight = rightSpace >= panelWidth || rightSpace >= leftSpace;
    const unclampedLeft = placeOnRight ? rect.right + gapPx : rect.left - panelWidth - gapPx;

    setAuctionHover({
      itemId: item.id,
      itemData: {
        ...itemData,
        iconAssetPath: resolveAuctionItemIconPath(itemData)
      },
      comparisonSlotId,
      top: Math.round(
        Math.max(viewportPadding, Math.min(rect.top, window.innerHeight - viewportPadding - estimatedPanelHeight))
      ),
      left: Math.round(
        Math.max(viewportPadding, Math.min(unclampedLeft, window.innerWidth - viewportPadding - panelWidth))
      ),
      width: panelWidth,
      maxHeight
    });
  };

  const handleAuctionItemMouseLeave = (itemId: string) => {
    setAuctionHover((previousHover: AuctionHoverState | null) => (previousHover?.itemId === itemId ? null : previousHover));
  };

  const renderAuctionHoverOverlay = () => {
    if (!auctionHover || activeView !== "browse") {
      return null;
    }

    const comparisonItem = auctionHover.comparisonSlotId ? equipmentBySlot?.[auctionHover.comparisonSlotId] ?? null : null;
    const comparisonItemData = comparisonItem ? getInventoryItemData(comparisonItem) : null;
    const resolvedComparisonItem = comparisonItemData && comparisonItemData.itemCode !== auctionHover.itemData.itemCode
      ? comparisonItemData
      : null;
    const sourcePowerDelta = resolvedComparisonItem ? (auctionHover.itemData.power ?? 0) - (resolvedComparisonItem.power ?? 0) : 0;

    return (
      <div
        className="inventoryComparisonOverlay"
        style={{
          top: auctionHover.top,
          left: auctionHover.left,
          width: auctionHover.width,
          maxHeight: auctionHover.maxHeight
        }}
      >
        <div className="inventoryComparisonOverlayStack">
          <article className={`inventoryDetailCard inventoryHoverDetailCard auctionHoverDetailCard rarity-${auctionHover.itemData.rarity}`}>
            {renderAuctionItemDetailCardBody(auctionHover.itemData, {
              powerDelta: sourcePowerDelta
            })}
          </article>
          {resolvedComparisonItem ? (
            <article className={`inventoryDetailCard inventoryComparisonCard rarity-${resolvedComparisonItem.rarity}`}>
              {renderAuctionItemDetailCardBody(resolvedComparisonItem, {
                asideNote: "Equipped"
              })}
            </article>
          ) : null}
        </div>
      </div>
    );
  };

  const handleCancelSubmission = async (listingId: string) => {
    if (!token) return;

    // Show confirmation modal
    setCancelTargetId(listingId);
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!token || !cancelTargetId) return;

    setShowCancelModal(false);
    setCancelling(cancelTargetId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auction/submit/${cancelTargetId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error ? translateBackendError(data.error) : t("auction.errors.failedToCancel");
        throw new Error(errorMsg);
      }

      await Promise.all([
        loadMySubmissions(),
        loadInventory()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToCancel"));
    } finally {
      setCancelling(null);
      setCancelTargetId(null);
    }
  };

  const cancelCancelModal = () => {
    setShowCancelModal(false);
    setCancelTargetId(null);
  };

  const formatTimeRemaining = (endTime: string): string => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return t("auction.ended");

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const getRarityColor = (rarity: string): string => {
    switch (rarity.toLowerCase()) {
      case "epic":
        return "#9d7bb8"; // var(--epic) - muted purple
      case "rare":
        return "#c9a559"; // var(--rare) - golden brass
      case "uncommon":
        return "#799866"; // var(--uncommon) - muted green
      case "common":
      default:
        return "#a39d8f"; // var(--common) - warm gray
    }
  };

  const resolveItemIconVisual = (args: {
    majorCategory?: ItemMajorCategory;
    category?: string;
    itemName?: string | null;
  }): { variant: ItemIconVariant; label: string } => {
    if (args.majorCategory) {
      if (args.majorCategory === "armor") {
        return { variant: "armor", label: "AR" };
      }
      if (args.majorCategory === "weapon") {
        return { variant: "weapon", label: "WP" };
      }
      if (args.majorCategory === "jewelry") {
        return { variant: "jewelry", label: "JW" };
      }
      if (args.majorCategory === "vestige") {
        return { variant: "vestige", label: "VS" };
      }
    }

    const category = (args.category ?? "").toLowerCase();
    if (category.includes("consumable")) {
      return { variant: "consumable", label: "CO" };
    }
    if (category.includes("material")) {
      return { variant: "material", label: "MT" };
    }
    if (category.includes("container")) {
      return { variant: "container", label: "CT" };
    }
    if (category.includes("utility")) {
      return { variant: "utility", label: "UT" };
    }
    if (category.includes("weapon")) {
      return { variant: "weapon", label: "WP" };
    }
    if (category.includes("armor")) {
      return { variant: "armor", label: "AR" };
    }
    if (category.includes("jewelry") || category.includes("ring") || category.includes("necklace")) {
      return { variant: "jewelry", label: "JW" };
    }

    const letters = (args.itemName ?? "IT").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    return {
      variant: "generic",
      label: letters.length === 2 ? letters : "IT"
    };
  };

  const renderItemIcon = (args: {
    majorCategory?: ItemMajorCategory;
    category?: string;
    itemName?: string | null;
    iconAssetPath?: string;
    className?: string;
    renderMode?: "default" | "imageOnly";
  }) => {
    const iconVisual = resolveItemIconVisual(args);
    if (args.iconAssetPath && args.renderMode === "imageOnly") {
      return <img className="itemVisualImage itemVisualImageCard" src={args.iconAssetPath} alt="" loading="lazy" />;
    }

    const extraClass = args.className ? ` ${args.className}` : "";
    return (
      <span className={`itemVisualIcon itemVisual-${iconVisual.variant}${extraClass}`} aria-hidden="true">
        {args.iconAssetPath ? (
          <img className="itemVisualImage" src={args.iconAssetPath} alt="" loading="lazy" />
        ) : (
          iconVisual.label
        )}
      </span>
    );
  };

  const renderAuctionItem = (item: AuctionItem) => {
    const itemData = getAuctionItemData(item);
    const canUseItem = canPlayerUseAuctionItem(itemData);
    const iconAssetPath = resolveAuctionItemIconPath(itemData);
    const minBid = getMinimumNextBid(item);
    const isSubmitting = submittingBid === item.id;
    const currentBidValue = item.currentBid > 0 ? item.currentBid : item.startingBid;
    const minimumAcceptedBid = minBid;
    const reservedAmount = getPlayerReservedBidAmount(item.id);
    const isLeadingBid =
      item.amIWinning === true ||
      myBids.some((bid) => bid.itemId === item.id && bid.status === "active");

    const setAuctionBidInputValue = (nextValue: string) => {
      setBidAmount((previous) => ({ ...previous, [item.id]: nextValue }));
    };

    const ensureSuggestedBidFloor = () => {
      const currentValue = bidAmount[item.id];
      const parsed = currentValue ? Number.parseInt(currentValue, 10) : Number.NaN;
      if (!Number.isFinite(parsed) || parsed < minimumAcceptedBid) {
        setAuctionBidInputValue(String(minimumAcceptedBid));
      }
    };

    return (
      <div key={item.id} className="auctionBrowseCardSlot">
        <article
          className={`auctionBrowseCard rarity-${itemData.rarity}${isLeadingBid ? " isLeadingBid" : ""}${
            recentlyUpdatedBidItemId === item.id ? " isBidRefreshing" : ""
          }`}
        >
          <div className="auctionBrowseItemHeader">
            <button
              type="button"
              className={`auctionBrowseIconButton inventoryItemCard rarity-${itemData.rarity}${isLeadingBid ? " isLeadingBid" : ""}`}
              onMouseEnter={(event) => handleAuctionItemMouseEnter(item, event.currentTarget)}
              onMouseLeave={() => handleAuctionItemMouseLeave(item.id)}
              onFocus={(event) => handleAuctionItemMouseEnter(item, event.currentTarget)}
              onBlur={() => handleAuctionItemMouseLeave(item.id)}
            >
              <div className={`inventoryCompactVisual auctionBrowseItemVisual${canUseItem ? "" : " isRestricted"}${isLeadingBid ? " isLeadingBid" : ""}`}>
                {renderItemIcon({
                  majorCategory: getItemMajorCategory(itemData),
                  category: itemData.category,
                  itemName: itemData.itemName,
                  iconAssetPath,
                  renderMode: iconAssetPath ? "imageOnly" : "default",
                  className: iconAssetPath ? undefined : `inventoryCompactIcon${canUseItem ? "" : " isRestricted"}`
                })}
                <span className="inventoryCompactPowerBadge" aria-hidden="true">
                  {itemData.power ?? 0}
                </span>
                <span className={`inventoryCompactLevelBadge${canUseItem ? "" : " isRestricted"}`} aria-hidden="true">
                  Lv. {itemData.levelRequirement}
                </span>
                {reservedAmount > 0 && isLeadingBid ? (
                  <span className="auctionBrowseReservedBadge auctionBrowseReservedBadgeOverlay" aria-hidden="true">
                    <span className="auctionBrowseReservedBadgeLabel">Reserved</span>
                    <span className="auctionBrowseReservedBadgeValue">
                      {renderDucatAmount(reservedAmount, "auctionDucatAmount")}
                    </span>
                  </span>
                ) : null}
              </div>
            </button>
            {item.isPlayerSubmitted ? <span className="auctionBrowseOriginTag">{t("auction.playerSubmitted")}</span> : null}
          </div>
          <div className="auctionBrowseInfo">
            <p className="auctionBrowseLine">
              <span>Bid:</span>
              <strong>{renderDucatAmount(currentBidValue, "auctionDucatAmount")}</strong>
            </p>
            <p className="auctionBrowseBidder">
              {item.currentBid > 0 && item.currentWinnerName ? item.currentWinnerName : t("auction.startingBid")}
            </p>
            <div className="auctionBrowseBidControls">
              <input
                type="number"
                min={minimumAcceptedBid}
                value={bidAmount[item.id] || ""}
                onFocus={ensureSuggestedBidFloor}
                onClick={ensureSuggestedBidFloor}
                onChange={(event) => {
                  setAuctionBidInputValue(event.target.value);
                }}
                className="auctionBrowseBidInput"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => handlePlaceBid(item)}
                disabled={isSubmitting || !bidAmount[item.id]}
                className="auctionBrowseBidButton"
              >
                {isSubmitting ? t("auction.placing") : t("auction.placeBid")}
              </button>
            </div>
          </div>
        </article>
      </div>
    );
  };

  const renderBrowseToolbarControls = () => {
    if (activeView !== "browse") {
      return null;
    }

    return (
      <div className="profileSwitchActions">
        <button
          type="button"
          className="profileSwitchButton"
          onClick={() => void handleRerollAuctions()}
          disabled={rerollingAuctions}
        >
          {rerollingAuctions ? t("auction.rerolling") : t("auction.reroll")}
        </button>
      </div>
    );
  };

  const renderBrowseAuctionSwitcher = () => {
    if (activeView !== "browse" || auctions.length === 0) {
      return null;
    }

    const auctionWingLabels = ["Left Wing", "Middle Wing", "Right Wing"];

    return (
      <div className="auctionBrowseAuctionSwitcher" aria-label={t("auction.tabs.browse")}>
        {auctions.map((auction, index) => (
          <button
            key={auction.id}
            type="button"
            className={`auctionBrowseAuctionButton${
              selectedAuction?.id === auction.id ? " auctionBrowseAuctionButtonActive" : ""
            }`}
            onClick={() => {
              setAuctionHover(null);
              setSelectedAuction(auction);
            }}
          >
            <span className="auctionBrowseAuctionButtonLabel">
              {auctionWingLabels[index] ?? `Wing ${index + 1}`}
            </span>
            <strong className="auctionBrowseAuctionButtonTime">{formatTimeRemaining(auction.endTime)}</strong>
          </button>
        ))}
      </div>
    );
  };

  const renderBrowseView = () => {
    if (loading) {
      return (
        <article className="contentCard">
          <p>{t("inventory.loading")}</p>
        </article>
      );
    }

    if (auctions.length === 0) {
      return (
        <article className="contentCard">
          <h3>{t("auction.noActiveAuctions")}</h3>
          <p>{t("auction.noActiveAuctionsDesc")}</p>
          <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: "1rem" }}>
            {t("auction.auctionTimes")}
          </p>
        </article>
      );
    }

    return (
      <>
        {selectedAuction && selectedAuction.items && selectedAuction.items.length > 0 && (
          <article
            className="auctionBrowseSection indoorSceneShell auctionBrowseSceneCard"
            style={auctionHouseShellStyle}
          >
            <div className="auctionBrowseGrid">
              {selectedAuction.items.map((item) => renderAuctionItem(item))}
            </div>
            <div className="auctionBrowseBottomControls">
              <div className="auctionBrowseTimeBanner">
                <span className="auctionBrowseTimeLabel">{t("auction.timeRemaining")}</span>
                <strong className="auctionBrowseTimeValue">{formatTimeRemaining(selectedAuction.endTime)}</strong>
              </div>
              {renderBrowseAuctionSwitcher()}
            </div>
            {renderAuctionHoverOverlay()}
          </article>
        )}
      </>
    );
  };

  const renderMyBidsView = () => {
    if (myBids.length === 0) {
      return (
        <article className="contentCard">
          <h3>{t("auction.myBidsTitle")}</h3>
          <p>{t("auction.noBidsPlaced")}</p>
        </article>
      );
    }

    return (
      <article className="contentCard">
        <h3>{t("auction.myBidsTitle")}</h3>
        <p style={{ marginBottom: "1rem" }}>{t("auction.myBidsDesc")}</p>
        
        {myBids.map((bid) => {
          const itemData = bid.item ? parseItemData(bid.item.itemCode) : null;
          const rarityClass = (bid.item?.itemRarity ?? itemData?.rarity ?? "common").toLowerCase();
          const canUseItem = itemData ? canPlayerUseAuctionItem(itemData) : true;
          
          return (
            <div key={bid.id} className="contentCard" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                {/* Item Icon */}
                <div className={`auctionRarityIconFrame rarity-${rarityClass}${canUseItem ? "" : " isRestricted"}`} style={{ minWidth: "64px", width: "64px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--soft-radius)", border: `2px solid ${bid.item ? getRarityColor(bid.item.itemRarity) : "#666"}40`, flexShrink: 0 }}>
                  {itemData && renderItemIcon({
                    category: itemData.category,
                    itemName: itemData.itemName,
                    iconAssetPath: itemData.iconAssetPath,
                    className: itemData.iconAssetPath ? undefined : `inventoryCardIcon${canUseItem ? "" : " isRestricted"}`
                  })}
                </div>

                {/* Bid Details */}
                <div style={{ flex: 1 }}>
                  <h4 style={{ 
                    color: bid.item ? getRarityColor(bid.item.itemRarity) : "inherit",
                    margin: "0 0 0.5rem 0"
                  }}>
                    {itemData ? itemData.itemName : t("profile.unknown")}
                  </h4>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
                    <strong>{t("auction.yourBid")}:</strong> {renderDucatAmount(bid.maxAutoBid ?? bid.bidAmount, "auctionDucatAmount")}
                  </p>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
                    <strong>{t("auction.status")}:</strong> {bid.status}
                  </p>
                  <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: "0.5rem 0 0 0" }}>
                    {t("auction.placedAt")}: {new Date(bid.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </article>
    );
  };

  const renderSubmitView = () => {
    const selectedItem = inventoryItems.find((item) => item.id === submissionData.itemId);
    const selectedItemData = selectedItem ? getInventoryItemData(selectedItem) : null;
    const canUseSelectedItem = selectedItemData ? canPlayerUseAuctionItem(selectedItemData) : true;

    // Calculate active submissions count
    const activeSubmissions = mySubmissions.filter(
      sub => sub.status === "approved" || sub.status === "listed"
    ).length;
    const maxSubmissions = 5; // From config: max_player_active_submissions

    // Filter and search logic
    const filteredItems = inventoryItems.filter((item) => {
      const itemData = getInventoryItemData(item);
      
      // Category filter
      if (itemFilter !== "all" && itemData.category?.toLowerCase() !== itemFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery && !itemData.itemName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    });

    return (
      <article className="contentCard" style={{ padding: "1.5rem" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 400px",
          gap: "2rem",
          alignItems: "start"
        }}>
          
          {/* LEFT SIDE - Item Selection */}
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>{t("auction.selectItem")}</h3>
              <p style={{ margin: "0", fontSize: "0.9rem", opacity: 0.8 }}>
                {t("auction.submitDesc")}
              </p>
            </div>

            {inventoryItems.length === 0 ? (
              <p style={{ opacity: 0.7, textAlign: "center", padding: "3rem" }}>
                {t("inventory.noItems")}
              </p>
            ) : (
              <>
                {/* Filters */}
                <div style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginBottom: "1.5rem",
                  flexWrap: "wrap"
                }}>
                  <input
                    type="text"
                    placeholder={t("auction.searchItemsPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: "1",
                      minWidth: "200px",
                      padding: "0.6rem 0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--soft-radius)",
                      background: "var(--bg-slate)",
                      color: "var(--text-main)",
                      fontSize: "0.9rem"
                    }}
                  />
                  
                  {["all", "weapon", "armor", "jewelry"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setItemFilter(filter)}
                      style={{
                        padding: "0.6rem 1rem",
                        background: itemFilter === filter ? "var(--accent-focus)" : "var(--panel-soft)",
                        color: itemFilter === filter ? "var(--bg-stone)" : "var(--text-main)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--soft-radius)",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        textTransform: "capitalize",
                        fontWeight: itemFilter === filter ? "bold" : "normal",
                        transition: "all 0.2s"
                      }}
                    >
                      {t(`auction.filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`)}
                    </button>
                  ))}
                </div>

                {filteredItems.length === 0 ? (
                  <p style={{ opacity: 0.7, textAlign: "center", padding: "3rem" }}>
                    {t("auction.noItemsMatchFilter")}
                  </p>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: "0.75rem",
                    maxHeight: "600px",
                    overflowY: "auto",
                    padding: "0.5rem"
                  }}>
                    {filteredItems.map((item) => {
                      const itemData = getInventoryItemData(item);
                      const canUseItem = canPlayerUseAuctionItem(itemData);
                      const isSelected = submissionData.itemId === item.id;
                      const rarity = itemData.rarity.toLowerCase();
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSubmissionData((prev) => ({ ...prev, itemId: item.id }))}
                          className={`auctionItemCard${isSelected ? " selected" : ""} rarity-${rarity}`}
                        >
                          <div className="auctionItemCardIcon">
                            <div className={`auctionRarityIconFrame rarity-${itemData.rarity.toLowerCase()}${canUseItem ? "" : " isRestricted"}`} style={{ width: "64px", height: "64px", display: "grid", placeItems: "center", borderRadius: "var(--soft-radius)", margin: "0 auto 0.5rem auto" }}>
  {renderItemIcon({
    category: itemData.category,
    itemName: itemData.itemName,
    iconAssetPath: itemData.iconAssetPath,
    className: itemData.iconAssetPath ? undefined : `inventoryCardIcon${canUseItem ? "" : " isRestricted"}`
  })}
</div>
                          </div>
                          
                          <div style={{ marginBottom: "0.35rem" }}>
                            <h4 className={`auctionItemCardTitle rarity-${rarity}`}>
                              {itemData.itemName}
                            </h4>
                            <p className="auctionItemCardCategory">
                              {itemData.category}
                            </p>
                          </div>
                          
                          <div className="auctionItemCardFooter">
                            <span className="auctionItemCardLevel">
                              Lv. {itemData.levelRequirement}
                            </span>
                            <span className={`auctionItemCardRarity rarity-${rarity}`}>
                              {itemData.rarity}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT SIDE - Auction Configuration */}
          <div className="auctionStickyPanel">
            
            {/* Active Submissions Counter */}
            <div className={`auctionInfoPanel ${activeSubmissions >= maxSubmissions ? "danger" : "success"}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", fontSize: "0.9rem", opacity: 0.9 }}>
                  {t("auction.activeSubmissions")}
                </span>
                <span style={{ 
                  fontSize: "1.5rem", 
                  fontWeight: "bold",
                  color: activeSubmissions >= maxSubmissions ? "var(--accent-danger)" : "var(--accent-success)"
                }}>
                  {activeSubmissions} / {maxSubmissions}
                </span>
              </div>
              {activeSubmissions >= maxSubmissions && (
                <p style={{ 
                  margin: "0", 
                  fontSize: "0.8rem", 
                  color: "var(--accent-danger)",
                  fontWeight: "500"
                }}>
                  Warning: {t("auction.maxSubmissionsReached")}
                </p>
              )}
            </div>

            {/* Selected Item Display */}
            {selectedItemData ? (
              <div className="auctionSelectedItemPanel">
                <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", fontWeight: "bold", opacity: 0.9 }}>
                  {t("auction.selectedItemTitle")}
                </h4>
                
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  <div className={`auctionRarityIconFrame rarity-${selectedItemData.rarity.toLowerCase()}${canUseSelectedItem ? "" : " isRestricted"}`} style={{ width: "64px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--soft-radius)", border: `2px solid ${getRarityColor(selectedItemData.rarity)}40`, flexShrink: 0 }}>
                    {renderItemIcon({
                      category: selectedItemData.category,
                      itemName: selectedItemData.itemName,
                      iconAssetPath: selectedItemData.iconAssetPath,
                      className: selectedItemData.iconAssetPath ? undefined : `inventoryCardIcon${canUseSelectedItem ? "" : " isRestricted"}`
                    })}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      color: getRarityColor(selectedItemData.rarity), 
                      margin: "0 0 0.25rem 0",
                      fontSize: "1rem"
                    }}>
                      {selectedItemData.itemName}
                    </h3>
                    <p style={{ margin: "0", fontSize: "0.85rem", opacity: 0.8 }}>
                      {t("player.level", { value: selectedItemData.levelRequirement })} - {selectedItemData.rarity}
                    </p>
                  </div>
                </div>
                
                {selectedItemData.statBonuses && Object.keys(selectedItemData.statBonuses).length > 0 && (
                  <div style={{ 
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border-soft)"
                  }}
                >
                    {Object.entries(selectedItemData.statBonuses ?? {}).slice(0, 4).map(([stat, value]) => (
                      <div key={stat} style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        marginBottom: "0.35rem",
                        fontSize: "0.85rem"
                      }}>
                        <span style={{ textTransform: "capitalize", opacity: 0.8 }}>{stat}:</span>
                        <span style={{ color: "var(--accent-focus)", fontWeight: "bold" }}>+{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="auctionPlaceholderPanel">
                <p style={{ margin: "0", fontSize: "0.9rem", opacity: 0.6 }}>
                  {t("auction.selectItemPlaceholder")}
                </p>
              </div>
            )}

            {/* Minimum Bid Input */}
            <div>
              <label style={{ 
                display: "block", 
                marginBottom: "0.5rem", 
                fontWeight: "bold",
                fontSize: "0.95rem"
              }}>
                {t("auction.minimumBid")}
              </label>
              <input
                type="number"
                value={submissionData.minimumBid}
                onChange={(e) => setSubmissionData({ ...submissionData, minimumBid: e.target.value })}
                placeholder={t("auction.enterBidPlaceholder")}
                min="1"
                disabled={!selectedItemData}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  border: "2px solid var(--border)",
                  borderRadius: "var(--soft-radius)",
                  background: !selectedItemData ? "var(--bg-stone)" : "var(--bg-slate)",
                  color: "var(--text-main)",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  textAlign: "center",
                  cursor: !selectedItemData ? "not-allowed" : "text"
                }}
              />
            </div>

            {/* Listing Fee Warning */}
            {submissionData.minimumBid && parseInt(submissionData.minimumBid) > 0 && (
              <div className="auctionListingFeePanel">
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: "bold", color: "var(--accent-danger)" }}>
                  {t("auction.listingFeeWarning")}
                </p>
                <p style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: "bold" }}>
                  {t("auction.listingFeeAmount")}: <span style={{ color: "var(--accent-warn)", fontSize: "1.2rem" }}>{Math.ceil(parseInt(submissionData.minimumBid) * 0.05)}</span>
                </p>
                <p style={{ margin: "0", fontSize: "0.75rem", opacity: 0.9 }}>
                  5% {t("auction.ofStartingBid")}
                </p>
                <div style={{
                  marginTop: "0.75rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--border)"
                }}
              >
                  <p style={{ margin: "0", fontSize: "0.8rem", fontWeight: "bold", color: "var(--accent-danger)" }}>
                    {t("auction.listingFeeNonRefundable")}
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmitItem}
              disabled={submitting || !submissionData.itemId || !submissionData.minimumBid || activeSubmissions >= maxSubmissions}
              className="auctionSubmitButton"
              style={{
                background: (submitting || !submissionData.itemId || !submissionData.minimumBid || activeSubmissions >= maxSubmissions) ? "var(--bg-slate)" : "var(--accent-success)"
              }}
            >
              {submitting ? t("auction.submitting") : t("auction.submitForReview")}
            </button>

          </div>

        </div>
      </article>
    );
  };

  const renderMySubmissionsView = () => {
    return (
      <article className="contentCard">
        <h3>{t("auction.mySubmissions")}</h3>
        {mySubmissions.length === 0 ? (
          <p>{t("auction.noSubmissions")}</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1rem"
          }}>
            {mySubmissions.map((submission) => {
              const itemData = parseItemData(submission.itemCode);
              const canUseItem = canPlayerUseAuctionItem(itemData);
              const rarityColor = getRarityColor(itemData.rarity);
              const canCancel = submission.status === "approved" || submission.status === "listed";
              const isCancelling = cancelling === submission.id;
              
              return (
                <div 
                  key={submission.id} 
                  className="contentCard" 
                  style={{ 
                    padding: "1rem",
                    border: `2px solid ${rarityColor}`,
                    background: "var(--bg-slate)"
                  }}
                >
                  <div className={`auctionRarityIconFrame rarity-${itemData.rarity.toLowerCase()}${canUseItem ? "" : " isRestricted"}`} style={{ width: "64px", height: "64px", display: "grid", placeItems: "center", borderRadius: "var(--soft-radius)", margin: "0 auto 0.5rem auto" }}>
  {renderItemIcon({
    category: itemData.category,
    itemName: itemData.itemName,
    iconAssetPath: itemData.iconAssetPath,
    className: itemData.iconAssetPath ? undefined : `inventoryCardIcon${canUseItem ? "" : " isRestricted"}`
  })}
</div>
                  <h4 style={{ 
                    color: rarityColor, 
                    margin: "0.5rem 0",
                    fontSize: "0.95rem",
                    minHeight: "2.4em",
                    lineHeight: "1.2em"
                  }}>
                    {itemData.itemName}
                  </h4>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
                    <strong>{t("auction.startingBid")}:</strong> <span className="ducatsAmount">{submission.minimumBid.toLocaleString()}</span> ducats
                  </p>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
                    <strong>{t("auction.submissionStatus")}:</strong> {t(`auction.${submission.status}` as any)}
                  </p>
                  {submission.rejectionReason && (
                    <p style={{ color: "var(--accent-danger)", margin: "0.25rem 0", fontSize: "0.85rem" }}>
                      <strong>{t("auction.rejectionReason")}:</strong> {submission.rejectionReason}
                    </p>
                  )}
                  <p style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: "0.5rem" }}>
                    {new Date(submission.createdAt).toLocaleString()}
                  </p>
                  
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancelSubmission(submission.id)}
                      disabled={isCancelling}
                      style={{
                        marginTop: "0.75rem",
                        background: isCancelling ? "var(--bg-slate)" : "var(--accent-danger)"
                      }}
                    >
                      {isCancelling ? t("auction.cancelling") : t("auction.cancelSubmission")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </article>
    );
  };

  const renderRewardsView = () => {
    if (pendingRewards.length === 0) {
      return (
        <article className="contentCard">
          <h3>{t("auction.rewardsTitle")}</h3>
          <p>{t("auction.noRewards")}</p>
        </article>
      );
    }

    return (
      <article className="contentCard">
        <h3>{t("auction.rewardsTitle")}</h3>
        <p style={{ marginBottom: "1rem" }}>{t("auction.rewardsDesc")}</p>
        
        {pendingRewards.map((reward) => {
          const itemData = parseItemData(reward.itemCode);
          return (
            <div key={reward.id} className="contentCard" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ color: getRarityColor(itemData.rarity), margin: "0 0 0.5rem 0" }}>
                    {itemData.itemName}
                  </h4>
                  <p style={{ margin: "0.25rem 0" }}>
                    <strong>{t("auction.winningBid")}:</strong> <span className="ducatsAmount">{reward.winningBid.toLocaleString()}</span> ducats
                  </p>
                  <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: "0.25rem 0" }}>
                    {t("auction.expires")}: {new Date(reward.expiresAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleClaimReward(reward.id)}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "var(--accent-success)",
                    color: "var(--text-main)",
                    border: "none",
                    borderRadius: "var(--soft-radius)",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: "bold"
                  }}
                >
                  {t("auction.claim")}
                </button>
              </div>
            </div>
          );
        })}
      </article>
    );
  };

  if (!token) {
    return (
      <section className="contentShell auctionHouseShell">
        <section className="contentStack auctionHouseStack">
          <article className="contentCard">
            <h2>{t("auction.title")}</h2>
            <p>{t("auction.loginRequired")}</p>
          </article>
        </section>
      </section>
    );
  }

  return (
    <>
      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="imperialShopModalOverlay" onClick={cancelCancelModal}>
          <div className="imperialShopStatusModal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
              {t("auction.cancelSubmission")}?
            </h2>
            <p style={{ margin: "0 0 1.5rem 0", color: "var(--text-soft)", fontSize: "0.95rem", lineHeight: "1.5" }}>
              {t("auction.confirmCancel")}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={cancelCancelModal}
                style={{
                  flex: 1,
                  padding: "0.75rem 1.5rem",
                  background: "var(--panel-soft)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--soft-radius)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                {t("auction.keepSubmission")}
              </button>
              <button
                onClick={confirmCancel}
                style={{
                  flex: 1,
                  padding: "0.75rem 1.5rem",
                  background: "var(--accent-danger)",
                  border: "none",
                  borderRadius: "var(--soft-radius)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                {t("auction.confirmCancelButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Bid Disable Confirmation Modal */}
      {showAutoBidDisableModal && autoBidDisableTargetId && (
        <div 
          className="imperialShopModalOverlay" 
          onClick={() => setShowAutoBidDisableModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000
          }}
        >
          <div 
            className="imperialShopStatusModal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-dark)",
              border: "2px solid rgba(226, 182, 111, 0.5)",
              borderRadius: "var(--soft-radius)",
              padding: "2rem",
              minWidth: "400px",
              maxWidth: "90vw",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
            }}
          >
            <h2 style={{ 
              fontSize: "1.4rem", 
              marginBottom: "1rem",
              color: "rgba(226, 182, 111, 1)",
              textAlign: "center"
            }}>
              {t("auction.autoBid.disableConfirmTitle")}
            </h2>
            <p style={{ 
              margin: "0 0 1.5rem 0", 
              color: "var(--text-soft)", 
              fontSize: "0.95rem", 
              lineHeight: "1.6",
              textAlign: "center"
            }}>
              {t("auction.autoBid.disableConfirmText")}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => setShowAutoBidDisableModal(false)}
                style={{
                  flex: 1,
                  padding: "0.75rem 1.5rem",
                  background: "var(--panel-soft)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--soft-radius)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                {t("auction.autoBid.keepAutoBid")}
              </button>
              <button
                onClick={() => {
                  handleDisableAutoBid(autoBidDisableTargetId);
                  setShowAutoBidDisableModal(false);
                  setAutoBidDisableTargetId(null);
                }}
                style={{
                  flex: 1,
                  padding: "0.75rem 1.5rem",
                  background: "rgba(226, 182, 111, 0.9)",
                  border: "none",
                  borderRadius: "var(--soft-radius)",
                  color: "#000",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                {t("auction.autoBid.confirmDisable")}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="contentShell auctionHouseShell">
        <section className="contentStack auctionHouseStack">
          <article className="contentCard">
            <div className="profileSwitchBar">
              <div className="profileSwitchButtons">
                <button
                  type="button"
                  onClick={() => setActiveView("browse")}
                  className={`profileSwitchButton${activeView === "browse" ? " active" : ""}`}
                >
                  {t("auction.tabs.browse")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("submit")}
                  className={`profileSwitchButton${activeView === "submit" ? " active" : ""}`}
                >
                  {t("auction.tabs.submit")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("mySubmissions")}
                  className={`profileSwitchButton${activeView === "mySubmissions" ? " active" : ""}`}
                >
                  {t("auction.tabs.mySubmissions")} ({mySubmissions.length})
                </button>
              </div>
              {renderBrowseToolbarControls()}
            </div>
          </article>

        {error && (
          <div 
            className="imperialShopModalOverlay" 
            onClick={() => setError(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000
            }}
          >
            <div 
              className="imperialShopStatusModal" 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--bg-dark)",
                border: "2px solid var(--accent-danger)",
                borderRadius: "var(--soft-radius)",
                padding: "2rem",
                minWidth: "400px",
                maxWidth: "90vw",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
              }}
            >
              <h2 style={{ 
                fontSize: "1.4rem", 
                marginBottom: "1rem",
                color: "var(--accent-danger)",
                textAlign: "center"
              }}>
                Error
              </h2>
              <p style={{ 
                margin: "0 0 2rem 0", 
                color: "var(--text-main)", 
                fontSize: "1rem", 
                lineHeight: "1.6",
                textAlign: "center"
              }}>
                {error}
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => setError(null)}
                  style={{
                    padding: "0.875rem 2rem",
                    background: "var(--accent-danger)",
                    border: "2px solid var(--accent-danger)",
                    borderRadius: "var(--soft-radius)",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingRewards.length > 0 && renderRewardsView()}
        {activeView === "browse" && renderBrowseView()}
        {activeView === "submit" && renderSubmitView()}
        {activeView === "mySubmissions" && renderMySubmissionsView()}
      </section>
    </section>
    </>
  );
}






















