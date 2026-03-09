import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export interface AuctionHouseProps {
  token: string | null;
  currentDucats: number;
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
  bidCount: number;
  extensionsUsed: number;
  isPlayerSubmitted: boolean;
}

interface ParsedItemData {
  name: string;
  level: number;
  rarity: string;
  category: string;
  stats?: Record<string, number>;
  iconAssetPath?: string;
  weaponType?: string;
  armorType?: string;
  jewelryType?: string;
}

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

interface InventoryItem {
  id: string;
  itemCode: string;
  slotKey: string;
  quantity: number;
  createdAt: string;
}

type AuctionView = "browse" | "myBids" | "submit" | "mySubmissions" | "rewards";

export function AuctionHouse({ token, currentDucats }: AuctionHouseProps) {
  const { t } = useTranslation("common");
  const [activeView, setActiveView] = useState<AuctionView>("browse");
  const [auctions, setAuctions] = useState<AuctionInstance[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionInstance | null>(null);
  const [myBids, setMyBids] = useState<PlayerBid[]>([]);
  const [pendingRewards, setPendingRewards] = useState<PendingReward[]>([]);
  const [mySubmissions, setMySubmissions] = useState<PlayerSubmission[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<Record<string, string>>({});
  const [submittingBid, setSubmittingBid] = useState<string | null>(null);
  const [submissionData, setSubmissionData] = useState({ itemId: "", minimumBid: "" });
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const API_BASE = "http://localhost:4000";

  useEffect(() => {
    if (token) {
      void loadActiveAuctions();
      void loadMyBids();
      void loadPendingRewards();
      void loadMySubmissions();
      void loadInventory();
    }
  }, [token]);

  const loadActiveAuctions = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/v1/auction/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(t("auction.errors.failedToLoad"));
      }

      const data = await response.json();
      setAuctions(data.auctions || []);
      
      if (data.auctions?.length > 0 && !selectedAuction) {
        setSelectedAuction(data.auctions[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToLoad"));
    } finally {
      setLoading(false);
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

  const handlePlaceBid = async (itemId: string) => {
    if (!token || !bidAmount[itemId]) return;

    const amount = parseInt(bidAmount[itemId], 10);
    if (isNaN(amount) || amount <= 0) {
      setError(t("auction.errors.invalidBid"));
      return;
    }

    if (amount > currentDucats) {
      setError(t("auction.errors.insufficientDucats"));
      return;
    }

    setSubmittingBid(itemId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auction/bid`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ itemId, bidAmount: amount })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("auction.errors.failedToBid"));
      }

      setBidAmount((prev) => ({ ...prev, [itemId]: "" }));
      await loadActiveAuctions();
      await loadMyBids();
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
        throw new Error(data.error || t("auction.errors.failedToClaim"));
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

    // Parse the full item data
    const itemData = parseItemData(selectedItem.itemCode);

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
        throw new Error(data.error || t("auction.errors.failedToSubmit"));
      }

      // Clear form and reload data
      setSubmissionData({ itemId: "", minimumBid: "" });
      await Promise.all([
        loadMySubmissions(),
        loadInventory()
      ]);
      
      // Show success message and switch to My Submissions view
      setSuccessMessage(t("auction.submitSuccess") || "Item submitted successfully! It will be listed in the next auction.");
      setActiveView("mySubmissions");
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auction.errors.failedToSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const parseItemData = (itemCode: string): ParsedItemData => {
    try {
      return JSON.parse(itemCode);
    } catch {
      return {
        name: "Unknown Item",
        level: 1,
        rarity: "common",
        category: "misc"
      };
    }
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
        throw new Error(data.error || t("auction.errors.failedToCancel"));
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
    category?: string;
    itemName?: string | null;
  }): { variant: ItemIconVariant; label: string } => {
    const category = (args.category ?? "").toLowerCase();
    
    if (category.includes("weapon")) {
      return { variant: "weapon", label: "WP" };
    }
    if (category.includes("armor")) {
      return { variant: "armor", label: "AR" };
    }
    if (category.includes("jewelry") || category.includes("ring") || category.includes("necklace")) {
      return { variant: "jewelry", label: "JW" };
    }
    if (category.includes("consumable")) {
      return { variant: "consumable", label: "CO" };
    }
    if (category.includes("material")) {
      return { variant: "material", label: "MT" };
    }

    const letters = (args.itemName ?? "IT").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    return {
      variant: "generic",
      label: letters.length === 2 ? letters : "IT"
    };
  };

  const renderItemIcon = (args: {
    category?: string;
    itemName?: string | null;
    iconAssetPath?: string;
    className?: string;
  }) => {
    const iconVisual = resolveItemIconVisual(args);
    
    if (args.iconAssetPath) {
      return (
        <img 
          src={args.iconAssetPath} 
          alt="" 
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated"
          }}
        />
      );
    }
    
    const extraClass = args.className ? ` ${args.className}` : "";
    return (
      <span 
        className={`itemVisualIcon itemVisual-${iconVisual.variant}${extraClass}`}
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "48px",
          height: "48px",
          fontSize: "1.2rem",
          fontWeight: "bold",
          background: "var(--panel-soft)",
          border: "2px solid var(--border)",
          borderRadius: "var(--soft-radius)"
        }}
      >
        {iconVisual.label}
      </span>
    );
  };

  const renderAuctionItem = (item: AuctionItem) => {
    const itemData = parseItemData(item.itemCode);
    const minBid = item.currentBid > 0 ? item.currentBid + 10 : item.startingBid;
    const isSubmitting = submittingBid === item.id;

    return (
      <div key={item.id} className="contentCard" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
          {/* Item Icon */}
          <div style={{
            minWidth: "80px",
            width: "80px",
            height: "80px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-slate)",
            borderRadius: "var(--soft-radius)",
            border: `2px solid ${getRarityColor(item.itemRarity)}40`,
            flexShrink: 0
          }}>
            {renderItemIcon({
              category: itemData.category,
              itemName: itemData.name,
              iconAssetPath: itemData.iconAssetPath
            })}
          </div>
          
          <div style={{ flex: 1 }}>
            <h3 style={{ color: getRarityColor(item.itemRarity), margin: "0 0 0.5rem 0" }}>
              {itemData.name}
            </h3>
            <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", opacity: 0.8 }}>
              {t("player.level", { value: item.itemLevel })} • {item.itemCategory} • {item.itemRarity}
            </p>
            {item.isPlayerSubmitted && (
              <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", fontStyle: "italic", opacity: 0.6 }}>
                {t("auction.playerSubmitted")}
              </p>
            )}
            
            <div style={{ marginTop: "0.75rem" }}>
              <p style={{ margin: "0.25rem 0" }}>
                <strong>{t("auction.currentBid")}:</strong> {item.currentBid > 0 ? `${item.currentBid} ◎` : t("auction.noBidsYet")}
              </p>
              <p style={{ margin: "0.25rem 0" }}>
                <strong>{t("auction.startingBid")}:</strong> {item.startingBid} ◎
              </p>
              <p style={{ margin: "0.25rem 0" }}>
                <strong>{t("auction.bids")}:</strong> {item.bidCount}
              </p>
            </div>
          </div>

          <div style={{ marginLeft: "1rem", minWidth: "200px" }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <input
                type="number"
                placeholder={t("auction.minBid", { amount: minBid })}
                value={bidAmount[item.id] || ""}
                onChange={(e) => setBidAmount((prev) => ({ ...prev, [item.id]: e.target.value }))}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--soft-radius)",
                  background: "var(--bg-slate)",
                  color: "var(--text-main)",
                  fontSize: "0.9rem"
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => handlePlaceBid(item.id)}
              disabled={isSubmitting || !bidAmount[item.id]}
              style={{
                background: isSubmitting ? "var(--bg-slate)" : "var(--accent-success)"
              }}
            >
              {isSubmitting ? t("auction.placing") : t("auction.placeBid")}
            </button>
          </div>
        </div>
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
        <article className="contentCard">
          <h3>{t("auction.tabs.browse")}</h3>
          <p>{t("auction.selectAuction")}</p>
          
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
            {auctions.map((auction) => (
              <button
                key={auction.id}
                type="button"
                onClick={() => setSelectedAuction(auction)}
                style={{
                  padding: "0.75rem 1rem",
                  background: selectedAuction?.id === auction.id ? "var(--accent-focus)" : "var(--panel-soft)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--soft-radius)",
                  color: selectedAuction?.id === auction.id ? "var(--bg-stone)" : "var(--text-main)",
                  cursor: "pointer"
                }}
              >
                <div>{t("auction.levelBracket", { min: auction.levelBracketMin, max: auction.levelBracketMax })}</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                  {t("auction.itemCount", { count: auction.items?.length || 0 })}
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.25rem" }}>
                  {formatTimeRemaining(auction.endTime)}
                </div>
              </button>
            ))}
          </div>
        </article>

        {selectedAuction && selectedAuction.items && selectedAuction.items.length > 0 && (
          <article className="contentCard">
            <h3>
              {t("auction.auctionItems", { min: selectedAuction.levelBracketMin, max: selectedAuction.levelBracketMax })}
            </h3>
            <p style={{ marginBottom: "1rem" }}>
              {t("auction.timeRemaining")}: <strong>{formatTimeRemaining(selectedAuction.endTime)}</strong>
            </p>
            
            <div>
              {selectedAuction.items.map((item) => renderAuctionItem(item))}
            </div>
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
        
        {myBids.map((bid) => (
          <div key={bid.id} className="contentCard" style={{ marginBottom: "1rem" }}>
            <p>
              <strong>{t("auction.submittedItem")}:</strong> {bid.item ? parseItemData(bid.item.itemCode).name : "Unknown"}
            </p>
            <p>
              <strong>{t("auction.yourBid")}:</strong> {bid.bidAmount} ◎
            </p>
            <p>
              <strong>{t("auction.status")}:</strong> {bid.status}
            </p>
            <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              {t("auction.placedAt")}: {new Date(bid.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </article>
    );
  };

  const renderSubmitView = () => {
    const selectedItem = inventoryItems.find((item) => item.id === submissionData.itemId);
    const selectedItemData = selectedItem ? parseItemData(selectedItem.itemCode) : null;

    // Calculate active submissions count
    const activeSubmissions = mySubmissions.filter(
      sub => sub.status === "approved" || sub.status === "listed"
    ).length;
    const maxSubmissions = 5; // From config: max_player_active_submissions

    // Filter and search logic
    const filteredItems = inventoryItems.filter((item) => {
      const itemData = parseItemData(item.itemCode);
      
      // Category filter
      if (itemFilter !== "all" && itemData.category?.toLowerCase() !== itemFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery && !itemData.name.toLowerCase().includes(searchQuery.toLowerCase())) {
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
                    placeholder="Search items..."
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
                      {filter}
                    </button>
                  ))}
                </div>

                {filteredItems.length === 0 ? (
                  <p style={{ opacity: 0.7, textAlign: "center", padding: "3rem" }}>
                    No items match your filters
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
                      const itemData = parseItemData(item.itemCode);
                      const isSelected = submissionData.itemId === item.id;
                      const rarity = itemData.rarity.toLowerCase();
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSubmissionData((prev) => ({ ...prev, itemId: item.id }))}
                          className={`auctionItemCard${isSelected ? " selected" : ""} rarity-${rarity}`}
                        >
                          <div className="auctionItemCardIcon">
                            {renderItemIcon({
                              category: itemData.category,
                              itemName: itemData.name,
                              iconAssetPath: itemData.iconAssetPath
                            })}
                          </div>
                          
                          <div style={{ marginBottom: "0.35rem" }}>
                            <h4 className={`auctionItemCardTitle rarity-${rarity}`}>
                              {itemData.name}
                            </h4>
                            <p className="auctionItemCardCategory">
                              {itemData.category}
                            </p>
                          </div>
                          
                          <div className="auctionItemCardFooter">
                            <span className="auctionItemCardLevel">
                              Lv. {itemData.level}
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
                  ⚠️ Maximum submissions reached. Cancel an active submission to add more.
                </p>
              )}
            </div>

            {/* Selected Item Display */}
            {selectedItemData ? (
              <div className="auctionSelectedItemPanel">
                <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", fontWeight: "bold", opacity: 0.9 }}>
                  Selected Item
                </h4>
                
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  <div style={{
                    width: "64px",
                    height: "64px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-slate)",
                    borderRadius: "var(--soft-radius)",
                    border: `2px solid ${getRarityColor(selectedItemData.rarity)}40`,
                    flexShrink: 0
                  }}>
                    {renderItemIcon({
                      category: selectedItemData.category,
                      itemName: selectedItemData.name,
                      iconAssetPath: selectedItemData.iconAssetPath
                    })}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      color: getRarityColor(selectedItemData.rarity), 
                      margin: "0 0 0.25rem 0",
                      fontSize: "1rem"
                    }}>
                      {selectedItemData.name}
                    </h3>
                    <p style={{ margin: "0", fontSize: "0.85rem", opacity: 0.8 }}>
                      Level {selectedItemData.level} • {selectedItemData.rarity}
                    </p>
                  </div>
                </div>
                
                {selectedItemData.stats && Object.keys(selectedItemData.stats).length > 0 && (
                  <div style={{ 
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border-soft)"
                  }}
                >
                    {Object.entries(selectedItemData.stats).slice(0, 4).map(([stat, value]) => (
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
                  ← Select an item from the left
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
                placeholder="Enter starting bid amount..."
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
                  {renderItemIcon({
                    category: itemData.category,
                    itemName: itemData.name,
                    iconAssetPath: itemData.iconAssetPath
                  })}
                  <h4 style={{ 
                    color: rarityColor, 
                    margin: "0.5rem 0",
                    fontSize: "0.95rem",
                    minHeight: "2.4em",
                    lineHeight: "1.2em"
                  }}>
                    {itemData.name}
                  </h4>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
                    <strong>{t("auction.startingBid")}:</strong> {submission.minimumBid} ◎
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
                    {itemData.name}
                  </h4>
                  <p style={{ margin: "0.25rem 0" }}>
                    <strong>{t("auction.winningBid")}:</strong> {reward.winningBid} ◎
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
      <section className="contentShell">
        <section className="contentStack">
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

      <section className="contentShell">
      <section className="contentStack">
        <article className="contentCard">
          <h2>🔨 {t("auction.title")}</h2>
          <p>{t("auction.description")}</p>
          
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
                onClick={() => setActiveView("myBids")}
                className={`profileSwitchButton${activeView === "myBids" ? " active" : ""}`}
              >
                {t("auction.tabs.myBids")} ({myBids.length})
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
              <button
                type="button"
                onClick={() => setActiveView("rewards")}
                className={`profileSwitchButton${activeView === "rewards" ? " active" : ""}`}
              >
                {t("auction.tabs.rewards")} ({pendingRewards.length})
              </button>
            </div>
          </div>

          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--bg-slate)", borderRadius: "var(--soft-radius)" }}>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              <strong>{t("auction.yourDucats")}:</strong> {currentDucats.toLocaleString()} ◎
            </p>
          </div>
        </article>

        {successMessage && (
          <article className="contentCard" style={{ background: "rgba(111, 141, 95, 0.15)", borderColor: "var(--accent-success)" }}>
            <p style={{ margin: 0, color: "var(--accent-success)" }}>✓ {successMessage}</p>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              style={{
                marginTop: "0.5rem",
                padding: "0.25rem 0.5rem",
                background: "var(--panel-soft)",
                border: "1px solid var(--border)",
                borderRadius: "var(--soft-radius)",
                color: "var(--text-main)",
                cursor: "pointer",
                fontSize: "0.85rem"
              }}
            >
              Dismiss
            </button>
          </article>
        )}

        {error && (
          <article className="contentCard" style={{ background: "rgba(151, 80, 74, 0.15)", borderColor: "var(--accent-danger)" }}>
            <p style={{ margin: 0, color: "var(--accent-danger)" }}>⚠️ {error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{
                marginTop: "0.5rem",
                padding: "0.25rem 0.5rem",
                background: "var(--panel-soft)",
                border: "1px solid var(--border)",
                borderRadius: "var(--soft-radius)",
                color: "var(--text-main)",
                cursor: "pointer",
                fontSize: "0.85rem"
              }}
            >
              Dismiss
            </button>
          </article>
        )}

        {activeView === "browse" && renderBrowseView()}
        {activeView === "myBids" && renderMyBidsView()}
        {activeView === "submit" && renderSubmitView()}
        {activeView === "mySubmissions" && renderMySubmissionsView()}
        {activeView === "rewards" && renderRewardsView()}
      </section>
    </section>
    </>
  );
}
