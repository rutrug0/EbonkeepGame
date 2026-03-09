# Auction House System - Complete Implementation Design

## 1. SYSTEM ANALYSIS

### Intended Design Summary
- **Instance-based auction system** with 50 players per instance
- **3 concurrent auctions** per instance, staggered by 4 hours (one ends every 4 hours)
- **6 items per auction**
- **12-hour auction duration**
- **Level-bracketed instances** (5-level ranges) to prevent high-level dominance
- **Auto-bid system** for passive bidding up to a max threshold
- **Automatic settlement** with refunds and item delivery

### Strengths
✅ **Instance segmentation** prevents whale domination and keeps competition fair  
✅ **Staggered auctions** create regular engagement touchpoints (every 4 hours)  
✅ **Auto-bid** reduces FOMO and allows casual participation  
✅ **Level brackets** maintain competitive balance  
✅ **6 items** provides choice without overwhelming UI  

### Weaknesses
⚠️ **50-player instances** may be too small for low-population servers (empty auctions)  
⚠️ **No item source defined** - where do auction items come from?  
⚠️ **12-hour duration** may be too short for global player distribution (timezone issues)  
⚠️ **No auction fee/tax** - missing economic sink  
⚠️ **No snipe protection** - last-second bids can frustrate players  

### Missing Decisions
❓ **Item sourcing:** Player-submitted? System-generated? Curated?  
❓ **Starting bid logic:** Fixed? Level-scaled? Rarity-based?  
❓ **Bid increment rules:** Fixed step? Percentage-based? Minimum increase?  
❓ **Currency type:** Ducats only? Or allow Imperials?  
❓ **Participation limits:** Can player bid on all 6 items? Multiple auctions?  
❓ **Anonymous bidding:** Show player names or keep bids anonymous?  
❓ **Notification system:** How do players know they won/lost?  

### Exploitable Edge Cases
🔴 **Bot sniping:** Scripts can auto-bid in final seconds  
🔴 **Collusion:** Friends in same instance can avoid bidding against each other  
🔴 **Inventory full on win:** No items can be delivered, blocks auction  
🔴 **Race conditions:** Two players bid simultaneously at auction end  
🔴 **Offline winners:** Player offline when auction ends, item sits in limbo  
🔴 **Currency reservation:** Player bids max ducats, then tries to spend elsewhere  

### Implementation Risks
🔥 **Concurrency bugs:** Auto-bid + manual bid conflicts  
🔥 **Settlement failure:** Partial refunds/rewards leave inconsistent state  
🔥 **Timer drift:** Server restarts may lose auction timers  
🔥 **Database locks:** High contention on bid insert at auction end  
🔥 **Redis dependency:** If Redis fails, auction timers lost  

### V1 Simplifications
**MUST SIMPLIFY:**
- ❌ **Remove player-submitted items** (V1: system-generated only)
- ❌ **Remove multi-instance complexity** (V1: single global auction per level bracket)
- ❌ **Remove real-time bid notifications** (V1: poll-based, no WebSocket spam)
- ✅ **Keep 3 staggered auctions** (core engagement loop)
- ✅ **Keep auto-bid** (critical for casual players)
- ✅ **Keep level brackets** (prevents whales)

---

## 2. FINAL PROPOSED V1 DESIGN

### Auction Instance Configuration
- **Instance size:** 100 players per level bracket (increase from 50 for better liquidity)
- **Level brackets:** [1-10], [11-20], [21-30], [31-40], [41-50], [51-60], [61-70], [71-80], [81-90], [91-100]
- **Concurrent auctions:** 3 active auctions per bracket
- **Items per auction:** 6 items
- **Auction duration:** 16 hours (better for global timezones)
- **Rotation schedule:** Auctions start at 00:00, 08:00, 16:00 UTC → one ends every 8 hours (changed from 4-hour offset for longer participation windows)

### Item Sourcing (V1)
- **System-generated only** (no player submissions in V1)
- Items generated at auction creation based on level bracket
- Rarity distribution per auction:
  - 2 Common items
  - 2 Uncommon items
  - 1 Rare item
  - 1 Epic item
- Item level = random within bracket (e.g., level 15-20 items for [11-20] bracket)
- Items favor class diversity (2 warrior, 2 mage, 2 ranger relevant items per auction)

### Bidding Rules
- **Starting bid:** `base_value * 0.6` where base_value is NPC vendor price (to be defined)
- **Minimum bid increment:** Greater of (10 ducats OR 5% of current bid)
- **Currency:** Ducats only (no Imperials in V1)
- **Bid reservation:** Ducats are reserved (deducted) when bid is placed
- **Outbid refund:** Immediate refund to currency balance when outbid
- **Max bids per player per auction:** Unlimited (can bid on all 6 items)
- **Max concurrent auctions:** Player can participate in all 3 auctions simultaneously
- **Bid history:** Last 5 bids visible per item (no full history in V1)

### Auto-Bid Rules
- Player sets **max auto-bid** when placing initial bid
- If outbid AND current bid < max auto-bid:
  - System automatically places new bid = min(competitor_bid + min_increment, max_auto_bid)
- Auto-bid triggers immediately on competitor bid (synchronous)
- Auto-bid conflicts (two players with high max bids):
  - Process in bid timestamp order
  - First auto-bid executes, then second auto-bid responds
  - Repeat until one player's max is exhausted or increments stop
- **Max auto-bid visibility:** Hidden (only current bid shown)
- **Auto-bid cap:** Cannot exceed player's available ducats

### Competitor Information Display
- **Anonymous bidding:** Player names NOT shown
- **Current bid visible:** Yes
- **Number of bids visible:** Yes (e.g., "5 bids")
- **Your status visible:** "Winning" / "Outbid" / "Not Bidding"
- **Bid history:** Show last 5 bid amounts + timestamps (no names)

### Player Restrictions
✅ **Can bid on multiple items in same auction:** Yes  
✅ **Can participate in all 3 concurrent auctions:** Yes  
✅ **Can win multiple items:** Yes (as long as ducats reserved)  
❌ **Cannot bid if insufficient ducats:** Bid rejected  
❌ **Cannot cancel bid:** Once placed, bid is final (refund only if outbid)  

### Refund & Reward Logic
- **Refund trigger:** Outbid by another player
- **Refund amount:** Full bid amount (no fees in V1)
- **Refund timing:** Immediate on outbid
- **Reward trigger:** Auction ends + player is highest bidder
- **Reward timing:** Settlement job runs at auction end time (±1 minute)
- **Reward delivery:** Item added to inventory automatically

### Inventory Full Scenario
- **Check on settlement:** If inventory has space → deliver item
- **If inventory full:**
  - Item goes to overflow storage (new table `auction_pending_rewards`)
  - Player must claim manually via "Claim Auction Items" button
  - Cannot bid on new items while unclaimed rewards pending (prevents abuse)
  - Pending rewards expire after 7 days → converted to ducats (80% of winning bid)

### Offline Winner Scenario
- **Settlement proceeds normally** (no online requirement)
- Item delivered to inventory or overflow storage
- **No push notification in V1** (notification system doesn't exist yet)
- Player sees results on next login via "Auction Results" icon badge

### Tie-Breaking Rules
- **No ties possible:** Bids have microsecond timestamps
- If exact same timestamp (impossible but defensive): earliest database insert wins

### Anti-Snipe Protection
- **Extended time mechanic:** If bid placed in final 2 minutes → extend auction by 2 minutes
- **Max extensions:** 5 (max 10 minutes total extension)
- **Per-item extension:** Each item tracks extensions independently

### Anti-Abuse Measures
- **Bid rate limit:** Max 10 bids per minute per player (prevent spam)
- **Shill bid detection:** V2 feature (track bid patterns, flag suspicious accounts)
- **Collusion prevention:** V2 feature (randomize instance assignments if player-submitted items added)
- **Ducat verification:** Always check currency balance before accepting bid (prevent race conditions)

---

## 3. BACKEND ARCHITECTURE

### Domain Entities

```typescript
// Core domain models (for reference, not DB schema)
type AuctionInstance = {
  id: string;
  levelBracketMin: number;
  levelBracketMax: number;
  startTime: Date;
  endTime: Date;
  status: "pending" | "active" | "settling" | "settled";
  items: AuctionItem[];
};

type AuctionItem = {
  id: string;
  auctionInstanceId: string;
  itemCode: string; // e.g., "sword_l15_rare_abc123"
  startingBid: number;
  currentBid: number;
  currentWinnerId: string | null;
  bidCount: number;
  extensionsUsed: number;
  maxExtensions: number;
};

type AuctionBid = {
  id: string;
  itemId: string;
  playerId: string;
  bidAmount: number;
  maxAutoBid: number;
  isAutoBid: boolean;
  timestamp: Date;
  status: "active" | "outbid" | "won" | "refunded";
};

type AuctionSettlement = {
  itemId: string;
  winnerId: string;
  finalBid: number;
  itemDelivered: boolean;
  refundsProcessed: number;
};
```

### Database Schema (Prisma)

```prisma
model AuctionInstance {
  id              String         @id @default(cuid())
  levelBracketMin Int
  levelBracketMax Int
  startTime       DateTime
  endTime         DateTime
  status          String         @default("pending") // pending | active | settling | settled
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  items           AuctionItem[]

  @@index([status, endTime])
  @@index([levelBracketMin, levelBracketMax, status])
  @@map("auction_instances")
}

model AuctionItem {
  id                String          @id @default(cuid())
  auctionInstanceId String
  itemCode          String          // JSON-encoded item data (temp until item system finalized)
  itemLevel         Int
  itemRarity        String
  itemCategory      String
  startingBid       Int
  currentBid        Int             @default(0)
  currentWinnerId   String?
  bidCount          Int             @default(0)
  extensionsUsed    Int             @default(0)
  maxExtensions     Int             @default(5)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  auctionInstance   AuctionInstance @relation(fields: [auctionInstanceId], references: [id], onDelete: Cascade)
  bids              AuctionBid[]

  @@index([auctionInstanceId])
  @@index([currentWinnerId])
  @@map("auction_items")
}

model AuctionBid {
  id          String      @id @default(cuid())
  itemId      String
  playerId    String
  bidAmount   Int
  maxAutoBid  Int
  isAutoBid   Boolean     @default(false)
  status      String      @default("active") // active | outbid | won | refunded
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  item        AuctionItem @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([itemId, status])
  @@index([playerId, status])
  @@index([createdAt])
  @@map("auction_bids")
}

model AuctionPendingReward {
  id          String   @id @default(cuid())
  playerId    String
  itemId      String
  itemCode    String   // JSON-encoded item data
  auctionId   String
  winningBid  Int
  expiresAt   DateTime
  claimed     Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([playerId, claimed])
  @@index([expiresAt])
  @@map("auction_pending_rewards")
}

model AuctionParticipation {
  id         String   @id @default(cuid())
  playerId   String
  auctionId  String
  itemId     String?  // null = viewing only, non-null = has active bid
  joinedAt   DateTime @default(now())

  @@unique([playerId, auctionId])
  @@index([auctionId])
  @@map("auction_participation")
}
```

### Key Relationships
- `AuctionInstance` 1:N `AuctionItem` → One auction contains 6 items
- `AuctionItem` 1:N `AuctionBid` → Each item has multiple bids
- `AuctionBid` N:1 `PlayerProfile` (via playerId) → Track who bid
- `AuctionPendingReward` N:1 `PlayerProfile` → Track unclaimed items

### Backend Services

#### 1. `AuctionInstanceService`
```typescript
class AuctionInstanceService {
  // Create new auction instances at scheduled times
  async createAuctionInstances(): Promise<void>;
  
  // Get active auctions for a player's level bracket
  async getActiveAuctionsForPlayer(playerId: string): Promise<AuctionInstance[]>;
  
  // Get specific auction details with items
  async getAuctionDetails(auctionId: string): Promise<AuctionInstance>;
  
  // Check if auction can accept new bids
  async isAuctionActive(auctionId: string): Promise<boolean>;
}
```

#### 2. `AuctionBidService`
```typescript
class AuctionBidService {
  // Place a manual bid with optional auto-bid max
  async placeBid(playerId: string, itemId: string, bidAmount: number, maxAutoBid: number): Promise<BidResult>;
  
  // Process auto-bid when player is outbid
  async processAutoBid(outbidPlayerId: string, itemId: string, newBidAmount: number): Promise<void>;
  
  // Check if player has sufficient funds
  async canPlayerBid(playerId: string, amount: number): Promise<boolean>;
  
  // Reserve ducats for bid (deduct from balance)
  async reserveDucatsForBid(playerId: string, amount: number): Promise<void>;
  
  // Refund ducats when outbid
  async refundOutbidPlayer(bidId: string): Promise<void>;
  
  // Get bid history for item
  async getBidHistory(itemId: string, limit: number): Promise<AuctionBid[]>;
}
```

#### 3. `AuctionItemGeneratorService`
```typescript
class AuctionItemGeneratorService {
  // Generate 6 items for an auction based on level bracket
  async generateItemsForAuction(levelBracketMin: number, levelBracketMax: number): Promise<ItemCode[]>;
  
  // Calculate starting bid for item
  calculateStartingBid(itemLevel: number, rarity: string): number;
}
```

#### 4. `AuctionSettlementService`
```typescript
class AuctionSettlementService {
  // Settle all items in an auction (called by cron at endTime)
  async settleAuction(auctionId: string): Promise<SettlementResult>;
  
  // Deliver item to winner
  async deliverItemToWinner(itemId: string, winnerId: string, itemCode: string): Promise<boolean>;
  
  // Move item to pending rewards if inventory full
  async createPendingReward(winnerId: string, itemId: string, itemCode: string, winningBid: number): Promise<void>;
  
  // Refund all losing bidders
  async refundLosingBidders(itemId: string): Promise<void>;
  
  // Process expired pending rewards
  async processExpiredRewards(): Promise<void>;
}
```

#### 5. `AuctionTimerService`
```typescript
class AuctionTimerService {
  // Check for auctions ending soon
  async checkEndingAuctions(): Promise<void>;
  
  // Extend auction if bid placed in final 2 minutes
  async extendAuctionIfNeeded(itemId: string): Promise<boolean>;
  
  // Get time remaining for auction
  async getTimeRemaining(auctionId: string): Promise<number>;
}
```

### Scheduled Jobs (Cron)

```typescript
// Run every minute
{
  schedule: "* * * * *",
  job: "checkEndingAuctions",
  action: async () => {
    // Find auctions with endTime <= now + 1 minute
    // Mark as "settling" status
    // Trigger settlement process
  }
}

// Run at 00:00, 08:00, 16:00 UTC daily
{
  schedule: "0 0,8,16 * * *",
  job: "createNewAuctions",
  action: async () => {
    // For each level bracket [1-10], [11-20], etc.
    // Create new AuctionInstance
    // Generate 6 items
    // Set status = "active"
  }
}

// Run hourly
{
  schedule: "0 * * * *",
  job: "processExpiredRewards",
  action: async () => {
    // Find AuctionPendingReward where expiresAt < now
    // Convert to ducats (80% of winning bid)
    // Delete pending reward
  }
}
```

### Auction Lifecycle

```
1. CREATION (00:00, 08:00, 16:00 UTC)
   - Cron job triggers
   - For each level bracket, create AuctionInstance
   - Generate 6 items (2 common, 2 uncommon, 1 rare, 1 epic)
   - Calculate starting bids
   - Set status = "active"
   - Set endTime = startTime + 16 hours

2. ACTIVE PHASE (0-16 hours)
   - Players browse active auctions
   - Players place bids
   - Auto-bid system responds to outbids
   - Extension mechanic activates if needed

3. SETTLING PHASE (endTime reached)
   - Cron detects endTime <= now
   - Set status = "settling"
   - For each item:
     - Identify winner (highest bid)
     - Attempt item delivery
     - If inventory full → create pending reward
     - Refund all losing bidders
   - Set status = "settled"

4. POST-SETTLEMENT
   - Winners see items in inventory
   - Losers see refunded ducats
   - Pending rewards visible in "Claim Items" panel
```

### Money Reservation (Safe Handling)

```typescript
// Transaction wrapper for bid placement
async function placeBidSafe(playerId: string, itemId: string, bidAmount: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Check player currency balance
    const currency = await tx.currencyBalance.findUnique({
      where: { playerId },
      select: { ducats: true }
    });
    
    if (!currency || currency.ducats < bidAmount) {
      throw new Error("Insufficient ducats");
    }
    
    // 2. Check item is still active
    const item = await tx.auctionItem.findUnique({
      where: { id: itemId },
      include: { auctionInstance: true }
    });
    
    if (!item || item.auctionInstance.status !== "active") {
      throw new Error("Auction not active");
    }
    
    // 3. Verify bid is higher than current
    if (bidAmount <= item.currentBid) {
      throw new Error("Bid must be higher than current bid");
    }
    
    // 4. Deduct ducats (reserve)
    await tx.currencyBalance.update({
      where: { playerId },
      data: { ducats: { decrement: bidAmount } }
    });
    
    // 5. Create bid record
    const bid = await tx.auctionBid.create({
      data: {
        itemId,
        playerId,
        bidAmount,
        maxAutoBid,
        status: "active"
      }
    });
    
    // 6. Update item currentBid and currentWinnerId
    await tx.auctionItem.update({
      where: { id: itemId },
      data: {
        currentBid: bidAmount,
        currentWinnerId: playerId,
        bidCount: { increment: 1 }
      }
    });
    
    // 7. Refund previous winner (if exists)
    if (item.currentWinnerId && item.currentWinnerId !== playerId) {
      await refundPreviousBidder(tx, item.currentWinnerId, itemId);
    }
    
    // 8. Check for extension
    await checkExtension(tx, itemId, item.auctionInstance.endTime);
    
    return bid;
  }, {
    isolationLevel: "Serializable" // Prevent race conditions
  });
}
```

### Auto-Bid Processing (Race Condition Prevention)

```typescript
async function processAutoBid(outbidPlayerId: string, itemId: string, newBidAmount: number) {
  // Use Redis lock to prevent concurrent auto-bid conflicts
  const lockKey = `auction:item:${itemId}:auto-bid-lock`;
  const lock = await redis.set(lockKey, "locked", "NX", "EX", 10); // 10-second lock
  
  if (!lock) {
    // Another auto-bid in progress, skip
    return;
  }
  
  try {
    // Get outbid player's max auto-bid
    const previousBid = await prisma.auctionBid.findFirst({
      where: {
        playerId: outbidPlayerId,
        itemId,
        status: "active"
      },
      orderBy: { createdAt: "desc" }
    });
    
    if (!previousBid || previousBid.maxAutoBid <= newBidAmount) {
      // No auto-bid or max already exceeded
      return;
    }
    
    // Calculate new auto-bid amount
    const minIncrement = Math.max(10, Math.ceil(newBidAmount * 0.05));
    const autoBidAmount = Math.min(newBidAmount + minIncrement, previousBid.maxAutoBid);
    
    // Check player still has ducats
    const currency = await prisma.currencyBalance.findUnique({
      where: { playerId: outbidPlayerId }
    });
    
    if (!currency || currency.ducats < autoBidAmount) {
      // Insufficient funds, auto-bid cannot proceed
      return;
    }
    
    // Place auto-bid
    await placeBidSafe(outbidPlayerId, itemId, autoBidAmount, previousBid.maxAutoBid);
    
  } finally {
    await redis.del(lockKey);
  }
}
```

### Idempotent Settlement

```typescript
async function settleAuctionIdempotent(auctionId: string) {
  // Check if already settled
  const auction = await prisma.auctionInstance.findUnique({
    where: { id: auctionId }
  });
  
  if (auction.status === "settled") {
    // Already processed, skip
    return;
  }
  
  // Set status to "settling" atomically
  const updated = await prisma.auctionInstance.updateMany({
    where: {
      id: auctionId,
      status: "active" // Only update if still active
    },
    data: { status: "settling" }
  });
  
  if (updated.count === 0) {
    // Another process already settling, skip
    return;
  }
  
  // Process each item
  const items = await prisma.auctionItem.findMany({
    where: { auctionInstanceId: auctionId },
    include: { bids: true }
  });
  
  for (const item of items) {
    await settleItemIdempotent(item);
  }
  
  // Mark settled
  await prisma.auctionInstance.update({
    where: { id: auctionId },
    data: { status: "settled" }
  });
}
```

### API Endpoints

```typescript
// Get active auctions for player's level bracket
GET /v1/auction/active
Response: { auctions: AuctionInstance[] }

// Get detailed view of specific auction
GET /v1/auction/:auctionId
Response: { auction: AuctionInstance, items: AuctionItem[], myBids: AuctionBid[] }

// Get bid history for item
GET /v1/auction/item/:itemId/bids
Response: { bids: AuctionBid[], currentWinner: boolean }

// Place a bid
POST /v1/auction/bid
Body: { itemId: string, bidAmount: number, maxAutoBid: number }
Response: { success: boolean, newBid: AuctionBid, timeRemaining: number }

// Get pending rewards
GET /v1/auction/rewards/pending
Response: { rewards: AuctionPendingReward[] }

// Claim pending reward
POST /v1/auction/rewards/claim
Body: { rewardId: string }
Response: { success: boolean, item: InventoryItem }

// Get auction participation summary
GET /v1/auction/my-activity
Response: { activeBids: number, wonItems: number, pendingRewards: number }
```

### Example Request/Response

```json
// POST /v1/auction/bid
{
  "itemId": "aitem_abc123",
  "bidAmount": 1500,
  "maxAutoBid": 2000
}

// Response
{
  "success": true,
  "newBid": {
    "id": "bid_xyz789",
    "itemId": "aitem_abc123",
    "bidAmount": 1500,
    "maxAutoBid": 2000,
    "status": "active",
    "createdAt": "2026-03-09T10:30:00Z"
  },
  "timeRemaining": 14400000,
  "extensionTriggered": false
}
```

---

## 4. FRONTEND ARCHITECTURE

### Main Auction House Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│  AUCTION HOUSE                          [X Close]       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Auction 1] [Auction 2*] [Auction 3]   My Bids: 4     │
│   Ends in:    Ends in:     Ends in:     Won: 1         │
│   12h 30m     4h 15m       8h 45m       Pending: 1     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│   │ [ICON]  │  │ [ICON]  │  │ [ICON]  │               │
│   │ Epic    │  │ Rare    │  │ Uncommon│               │
│   │ Sword   │  │ Helmet  │  │ Ring    │               │
│   │         │  │         │  │         │               │
│   │ 🥇 1,250│  │ 🏆 YOU  │  │ 💰 500  │               │
│   │ 5 bids  │  │ 3 bids  │  │ 1 bid   │               │
│   └─────────┘  └─────────┘  └─────────┘               │
│                                                          │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│   │ [ICON]  │  │ [ICON]  │  │ [ICON]  │               │
│   │ Common  │  │ Uncommon│  │ Common  │               │
│   │ Bow     │  │ Staff   │  │ Armor   │               │
│   │         │  │         │  │         │               │
│   │ ⚔️ OUTBID│  │ 💰 200  │  │ 💰 150  │               │
│   │ 12 bids │  │ 0 bids  │  │ 2 bids  │               │
│   └─────────┘  └─────────┘  └─────────┘               │
│                                                          │
└─────────────────────────────────────────────────────────┘

Legend:
🥇 = Current high bid (not you)
🏆 = You are winning
⚔️ = You were outbid
💰 = No bid from you yet
```

### Auction Tabs/Switching

```typescript
// Auction tab component state
type AuctionTab = {
  id: string;
  label: string; // "Auction 1", "Auction 2", "Auction 3"
  endTime: Date;
  active: boolean;
  itemsWithMyBid: number;
};

// Tab switching updates URL param: /auction?tab=auction_2
```

### Item Card States

```typescript
type ItemCardState = 
  | { type: "idle"; currentBid: number; bidCount: number; }
  | { type: "winning"; myBid: number; bidCount: number; }
  | { type: "outbid"; myBid: number; currentBid: number; bidCount: number; }
  | { type: "won"; finalBid: number; }
  | { type: "lost"; myBid: number; finalBid: number; }
  | { type: "ended"; finalBid: number; winnerAnonymous: true; };

// Visual indicators per state:
// IDLE: Gray border, show current bid
// WINNING: Green border, gold crown icon
// OUTBID: Red border, warning icon, pulsing animation
// WON: Gold border, trophy icon
// LOST: Gray border, crossed-out icon
// ENDED: Disabled state, no interaction
```

### Item Hover Tooltip

```tsx
// Reuse existing item tooltip component from inventory
<ItemTooltip
  itemCode={item.itemCode}
  position="top"
  showPowerScore={true}
  showAffixes={true}
  additionalInfo={
    <div className="auction-info">
      <div>Current Bid: {item.currentBid} ducats</div>
      <div>Bids Placed: {item.bidCount}</div>
      {myBid && <div>Your Bid: {myBid} ducats</div>}
    </div>
  }
/>
```

### Bidding Modal/Panel

```
┌──────────────────────────────────────┐
│  Place Bid - Epic Sword              │
├──────────────────────────────────────┤
│  [Item Icon]  Level 45 Epic Sword    │
│               Power: 850             │
│               +120 Strength          │
│               +15% Crit Damage       │
│                                      │
│  Current Bid: 1,250 ducats          │
│  Minimum Bid: 1,313 ducats (5%)     │
│                                      │
│  Your Bid: [________] ducats        │
│            (Available: 5,000)        │
│                                      │
│  Auto-Bid Max (Optional):           │
│  [________] ducats                  │
│  ℹ️ System will bid up to this max   │
│     if you're outbid                 │
│                                      │
│  [ Place Bid ]  [ Cancel ]          │
└──────────────────────────────────────┘
```

### Auto-Bid UX

```typescript
// Auto-bid input with validation
<AutoBidInput
  minBid={minBid}
  maxBid={playerDucats}
  currentBid={currentBid}
  onMaxSet={(maxAutoBid) => {
    // Validate max > current bid
    // Show warning if max is very high
  }}
/>

// Info tooltip explaining auto-bid:
"Auto-Bid will automatically place bids for you up to your max amount if someone outbids you. Your max is hidden from other players."
```

### Timers/Countdowns

```typescript
// Real-time countdown component
<AuctionTimer
  endTime={auction.endTime}
  onTick={(remaining) => {
    // Update every second
    // Show red warning when < 2 minutes
  }}
  onExpire={() => {
    // Refresh auction list
    // Show settlement message
  }}
/>

// Format: "12h 30m" or "4m 15s" or "58s"
```

### Empty/Loading/Error States

```tsx
// Empty state (no active auctions)
<EmptyState
  icon="🏛️"
  title="No Auctions Available"
  message="New auctions start every 8 hours at 00:00, 08:00, and 16:00 UTC."
/>

// Loading state
<LoadingSpinner message="Loading auctions..." />

// Error state
<ErrorState
  message="Failed to load auctions"
  retry={() => refetchAuctions()}
/>

// No bids state (player hasn't bid)
<EmptyState
  icon="💎"
  title="Place Your First Bid"
  message="Click on any item to start bidding!"
/>
```

### Mobile/Responsive Considerations

```css
/* Desktop: 3 columns (2 items per row) */
@media (min-width: 1024px) {
  .auction-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Tablet: 2 columns */
@media (min-width: 768px) and (max-width: 1023px) {
  .auction-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile: 1 column (stack vertically) */
@media (max-width: 767px) {
  .auction-grid {
    grid-template-columns: 1fr;
  }
  
  .auction-tabs {
    overflow-x: scroll; /* Horizontal scroll for tabs */
  }
}
```

### Component Hierarchy

```
<AuctionHouseScreen>
  ├─ <AuctionTabBar>
  │   ├─ <AuctionTab> (x3)
  │   └─ <MyActivitySummary>
  ├─ <AuctionItemGrid>
  │   ├─ <AuctionItemCard> (x6)
  │   │   ├─ <ItemIcon>
  │   │   ├─ <ItemStatusBadge>
  │   │   ├─ <BidInfo>
  │   │   └─ <ItemTooltip> (on hover)
  │   └─ <EmptyState> (if no items)
  ├─ <BiddingModal>
  │   ├─ <ItemPreview>
  │   ├─ <BidInput>
  │   ├─ <AutoBidInput>
  │   └─ <BidButton>
  └─ <PendingRewardsPanel>
      └─ <PendingRewardCard> (multiple)
```

---

## 5. GAME DESIGN RECOMMENDATIONS

### Economy Safety

**Ducat Sinks (Prevent Inflation):**
- ❌ **No auction house tax in V1** (simplicity) → but consider 5% tax in V2
- ✅ **Encourage overbidding** via min increment rules
- ✅ **Time-limited participation** (16-hour windows create urgency)

**Price Discovery:**
- Starting bid = 60% of NPC vendor value (prevents floor collapse)
- Min increment = 5% ensures meaningful bid jumps
- Anonymous bidding prevents price signaling collusion

**Ducat Sources Balance:**
- Monitor average ducats spent per player per day in auctions
- Compare against ducat generation from combat/jobs
- Target ratio: 20-30% of daily ducats should go to auctions

### Preventing Auction Manipulation

**Shill Bidding Prevention (V2):**
- Track bid cancel patterns (future if cancel added)
- Flag accounts that consistently bid without intention to win
- Detect coordinated bidding (same accounts always outbid each other)

**Bot Prevention:**
- Rate limit: 10 bids per minute per player
- CAPTCHA on high-frequency bidding (future)
- Detect automated bid timing patterns (exact intervals)

**Price Manipulation:**
- Anonymous bidding prevents cartel formation
- Level bracket isolation prevents cross-tier manipulation
- System-generated items (V1) eliminates supply manipulation

### Player Understandability

**Clear Feedback:**
- Always show remaining time prominently
- Show bid status immediately ("You are winning!" vs "You were outbid")
- Use color coding (green = winning, red = outbid, gray = idle)

**Minimize Confusion:**
- Hide max auto-bid from competitors (reduces complexity)
- Show only last 5 bids (not overwhelming history)
- Use simple language ("Place Bid" not "Submit Offer")

**Tutorial/Onboarding:**
- First-time user sees tooltip: "Welcome to the Auction House! Click any item to bid."
- Highlight auto-bid feature: "Set a max bid and we'll bid automatically for you"
- Show example: "If you set max 2000 and current bid is 1500, we'll bid up to 2000 for you"

### Preventing High-Level Player Dominance

**Level Bracket Isolation:**
- Strict brackets ([1-10], [11-20], etc.) prevent level 100 players from buying level 50 items
- Items generated within bracket range only
- Cannot bid on auctions outside your bracket

**Ducat Scaling:**
- Higher level items have higher starting bids
- Level 90-100 rare weapons might start at 5000 ducats
- Level 1-10 rare weapons start at 200 ducats
- Prevents low-level whales from dominating via ducats alone (items won't fit their level)

**Class Item Balance:**
- Each auction has 2 warrior, 2 mage, 2 ranger relevant items
- Prevents class stacking (e.g., auction full of melee weapons)
- Encourages diverse participation

### Player Name Visibility

**Recommendation: Anonymous (V1)**
- ✅ Reduces social pressure and toxicity
- ✅ Prevents friend collusion (can't see who you're bidding against)
- ✅ Focuses on item value, not player identity
- ❌ Reduces prestige/bragging rights (acceptable trade-off)

**V2 Option: Reveal Winner After Settlement**
- Show winner's name only after auction ends
- During auction: anonymous
- Post-auction: "Won by PlayerName" (opt-in via privacy setting)

### Bid Increment Recommendation

**Dynamic Percentage Step (Recommended):**
- Min increment = **MAX(10 ducats, 5% of current bid)**
- Rationale:
  - Low-price items: 10 ducat floor prevents micro-bidding spam
  - High-price items: 5% ensures meaningful jumps without pricing out players
- Examples:
  - 100 ducats → min bid 110 (10 ducat floor)
  - 1000 ducats → min bid 1050 (5%)
  - 10000 ducats → min bid 10500 (5%)

**Alternative: Fixed Step (Not Recommended):**
- Min increment = 25 ducats (all items)
- Problem: Too small for expensive items, too large for cheap items

**Alternative: Tiered Steps (Complex):**
- 0-500 ducats: +10 min
- 501-2000 ducats: +50 min
- 2001+ ducats: +100 min
- Problem: Confusing for players, requires more UI explanation

---

## 6. STEP-BY-STEP IMPLEMENTATION PLAN

### Phase 1: Minimal Backend Foundation (2-3 days)

**Scope:**
- ✅ Add Prisma schema (AuctionInstance, AuctionItem, AuctionBid, AuctionPendingReward)
- ✅ Create base service skeletons (AuctionInstanceService, AuctionBidService)
- ✅ Implement item generator (mock items with random stats)
- ✅ Create auction creation cron job (scheduled at 00:00, 08:00, 16:00 UTC)
- ✅ Add API endpoint: `GET /v1/auction/active` (return empty array initially)

**Dependencies:**
- None (standalone)

**Testing:**
- Run migration: `npx prisma migrate dev --name add_auction_tables`
- Manually trigger cron: Create auction instances for all level brackets
- Verify DB: Check `auction_instances` and `auction_items` tables populated
- Test API: `GET /v1/auction/active` returns data

**Postpone:**
- ❌ Auto-bid logic
- ❌ Settlement
- ❌ Frontend UI

---

### Phase 2: Core Bidding (3-4 days)

**Scope:**
- ✅ Implement `placeBid` with transaction safety
- ✅ Add ducat reservation/deduction
- ✅ Add refund logic for outbid players
- ✅ Update AuctionItem currentBid and currentWinnerId
- ✅ Add API endpoints:
  - `GET /v1/auction/:auctionId` (get auction details)
  - `POST /v1/auction/bid` (place bid)
  - `GET /v1/auction/item/:itemId/bids` (bid history)

**Dependencies:**
- Phase 1 complete

**Testing:**
- Create test player with 10,000 ducats
- Place bid on item
- Verify ducats deducted
- Verify bid recorded in DB
- Place higher bid from second player
- Verify first player refunded
- Check bid history API returns correct data

**Postpone:**
- ❌ Auto-bid
- ❌ Extension mechanic
- ❌ Frontend UI (use Postman/curl)

---

### Phase 3: Auto-Bid (2-3 days)

**Scope:**
- ✅ Add maxAutoBid field to bid placement API
- ✅ Implement `processAutoBid` with Redis locking
- ✅ Trigger auto-bid on outbid event
- ✅ Add auto-bid conflict resolution (two players with high max bids)
- ✅ Add isAutoBid flag to bid records

**Dependencies:**
- Phase 2 complete

**Testing:**
- Player A bids 1000 with max 2000
- Player B bids 1100 (no max)
- Verify Player A auto-bids 1155 (1100 + 5%)
- Player B bids 1200
- Verify Player A auto-bids 1260
- Player B bids 2500
- Verify Player A does NOT auto-bid (max exceeded)
- Test concurrent auto-bids: Player A max 3000, Player B max 2500
- Verify bids escalate until B's max reached

**Postpone:**
- ❌ Extension mechanic
- ❌ Frontend UI

---

### Phase 4: Settlement and Delivery (3-4 days)

**Scope:**
- ✅ Implement auction end detection cron (runs every minute)
- ✅ Implement `settleAuction` with idempotency
- ✅ Add item delivery to inventory
- ✅ Add pending reward creation if inventory full
- ✅ Add refund logic for all losing bidders
- ✅ Add API endpoints:
  - `GET /v1/auction/rewards/pending`
  - `POST /v1/auction/rewards/claim`
- ✅ Implement expired reward cron (convert to ducats after 7 days)

**Dependencies:**
- Phase 3 complete
- Inventory system functional

**Testing:**
- Create auction ending in 1 minute
- Wait for settlement cron
- Verify winner receives item
- Verify losers refunded
- Test inventory full scenario:
  - Fill winner's inventory
  - Verify pending reward created
  - Verify cannot bid while pending reward exists
  - Claim reward
  - Verify item delivered
- Test expired reward:
  - Create pending reward with expiresAt = now - 1 day
  - Run cron
  - Verify reward deleted, ducats refunded (80%)

**Postpone:**
- ❌ Frontend UI
- ❌ Extension mechanic

---

### Phase 5: Frontend UI (5-6 days)

**Scope:**
- ✅ Create AuctionHouseScreen component
- ✅ Implement auction tab bar with 3 tabs
- ✅ Implement item grid (6 items)
- ✅ Implement item card states (idle, winning, outbid, won, lost)
- ✅ Add item hover tooltip (reuse existing component)
- ✅ Create bidding modal
- ✅ Add auto-bid input
- ✅ Add countdown timers (update every second)
- ✅ Add pending rewards panel
- ✅ Implement polling (refresh every 10 seconds)

**Dependencies:**
- Phase 4 complete

**Testing:**
- Navigate to auction house
- Verify 3 tabs visible
- Click each tab, verify items load
- Hover over item, verify tooltip appears
- Click item, verify bidding modal opens
- Enter bid amount, verify validation
- Place bid, verify UI updates to "Winning"
- Have second player outbid
- Verify first player sees "Outbid" state
- Wait for auction end
- Verify winner sees item in inventory
- Verify loser sees refunded ducats

**Postpone:**
- ❌ Extension mechanic
- ❌ Real-time WebSocket updates (V2)

---

### Phase 6: Polish / Balancing / Telemetry (2-3 days)

**Scope:**
- ✅ Add extension mechanic (bid in final 2 minutes extends by 2 minutes)
- ✅ Add rate limiting (10 bids per minute per player)
- ✅ Add telemetry events:
  - `auction.bid.placed`
  - `auction.bid.auto`
  - `auction.item.won`
  - `auction.item.lost`
  - `auction.settlement.completed`
- ✅ Add error handling and user-facing error messages
- ✅ Add loading states and optimistic UI updates
- ✅ Performance testing (100 concurrent bidders)
- ✅ Balance starting bids per rarity tier

**Dependencies:**
- Phase 5 complete

**Testing:**
- Place bid in final 2 minutes
- Verify auction extended by 2 minutes
- Verify max 5 extensions (10 minutes total)
- Spam bids rapidly
- Verify rate limit kicks in
- Check telemetry dashboard
- Verify events logged correctly
- Load test: 100 players bidding on 6 items simultaneously
- Verify no race conditions or deadlocks

**Postpone to V2:**
- ❌ Player-submitted items
- ❌ Multi-instance complexity (stay single instance per bracket)
- ❌ WebSocket real-time updates
- ❌ Shill bid detection
- ❌ Advanced analytics dashboard

---

## 7. TESTING STRATEGY

### Unit Tests

```typescript
// AuctionBidService.test.ts
describe("AuctionBidService", () => {
  describe("placeBid", () => {
    it("should deduct ducats and create bid", async () => {
      // Arrange: Player with 1000 ducats, item with 500 current bid
      // Act: Place bid of 600
      // Assert: Player has 400 ducats, bid created, item currentBid = 600
    });
    
    it("should reject bid if insufficient ducats", async () => {
      // Arrange: Player with 100 ducats, item with 500 current bid
      // Act: Attempt to place bid of 600
      // Assert: Throw "Insufficient ducats" error
    });
    
    it("should reject bid lower than current bid", async () => {
      // Arrange: Item with 500 current bid
      // Act: Attempt to place bid of 450
      // Assert: Throw "Bid must be higher" error
    });
    
    it("should refund previous winner when outbid", async () => {
      // Arrange: Player A bids 500, Player B bids 600
      // Act: Check Player A's ducats
      // Assert: Player A refunded 500
    });
  });
  
  describe("processAutoBid", () => {
    it("should auto-bid up to max when outbid", async () => {
      // Arrange: Player A bids 500 with max 1000, Player B bids 600
      // Act: Trigger auto-bid
      // Assert: Player A bids 630 (600 + 5%)
    });
    
    it("should not auto-bid if max exceeded", async () => {
      // Arrange: Player A bids 500 with max 700, Player B bids 800
      // Act: Trigger auto-bid
      // Assert: No auto-bid placed (max exceeded)
    });
    
    it("should handle auto-bid conflict correctly", async () => {
      // Arrange: Player A max 2000, Player B max 1500
      // Act: Trigger auto-bid conflict
      // Assert: Bids escalate until B's max reached, A wins at 1575
    });
  });
});

// AuctionSettlementService.test.ts
describe("AuctionSettlementService", () => {
  describe("settleAuction", () => {
    it("should deliver item to winner", async () => {
      // Arrange: Auction with Player A as winner
      // Act: Settle auction
      // Assert: Player A has item in inventory
    });
    
    it("should create pending reward if inventory full", async () => {
      // Arrange: Winner with full inventory
      // Act: Settle auction
      // Assert: Pending reward created, item not in inventory
    });
    
    it("should refund all losing bidders", async () => {
      // Arrange: 5 players bid, Player A wins
      // Act: Settle auction
      // Assert: Players B, C, D, E all refunded
    });
    
    it("should be idempotent (no double settlement)", async () => {
      // Arrange: Settled auction
      // Act: Call settleAuction again
      // Assert: No duplicate refunds or deliveries
    });
  });
});
```

### Integration Tests

```typescript
// auction.integration.test.ts
describe("Auction Flow Integration", () => {
  it("should complete full auction lifecycle", async () => {
    // 1. Create auction
    const auction = await createAuctionForTesting();
    
    // 2. Player A bids 1000 with max 2000
    await placeBid(playerA.id, auction.items[0].id, 1000, 2000);
    
    // 3. Player B bids 1500
    await placeBid(playerB.id, auction.items[0].id, 1500);
    
    // 4. Verify Player A auto-bid to 1575
    const item = await getAuctionItem(auction.items[0].id);
    expect(item.currentBid).toBe(1575);
    expect(item.currentWinnerId).toBe(playerA.id);
    
    // 5. Player B bids 3000
    await placeBid(playerB.id, auction.items[0].id, 3000);
    
    // 6. Verify Player A does not auto-bid (max exceeded)
    const item2 = await getAuctionItem(auction.items[0].id);
    expect(item2.currentBid).toBe(3000);
    expect(item2.currentWinnerId).toBe(playerB.id);
    
    // 7. Fast-forward time to auction end
    await setSystemTime(auction.endTime);
    
    // 8. Trigger settlement
    await settleAuction(auction.id);
    
    // 9. Verify Player B receives item
    const playerBInventory = await getInventory(playerB.id);
    expect(playerBInventory).toContainItem(auction.items[0].itemCode);
    
    // 10. Verify Player A refunded
    const playerACurrency = await getCurrency(playerA.id);
    expect(playerACurrency.ducats).toBe(playerA.initialDucats); // Full refund
  });
});
```

### Concurrency/Race Condition Tests

```typescript
// auction.race.test.ts
describe("Auction Concurrency", () => {
  it("should handle simultaneous bids without race conditions", async () => {
    // Arrange: 10 players ready to bid
    const players = await createTestPlayers(10);
    const item = auction.items[0];
    
    // Act: All 10 players bid simultaneously
    const bids = await Promise.all(
      players.map((p, i) => placeBid(p.id, item.id, 1000 + i * 100))
    );
    
    // Assert: Only one bid succeeds per increment
    const finalItem = await getAuctionItem(item.id);
    expect(finalItem.bidCount).toBeLessThanOrEqual(10);
    expect(finalItem.currentBid).toBeGreaterThanOrEqual(1000);
    
    // Verify all other players refunded
    for (const player of players) {
      if (player.id !== finalItem.currentWinnerId) {
        const currency = await getCurrency(player.id);
        expect(currency.ducats).toBe(10000); // Initial amount
      }
    }
  });
  
  it("should prevent double settlement", async () => {
    // Arrange: Auction ready to settle
    const auction = await createAuctionForTesting();
    await setSystemTime(auction.endTime);
    
    // Act: Trigger settlement twice simultaneously
    await Promise.all([
      settleAuction(auction.id),
      settleAuction(auction.id)
    ]);
    
    // Assert: Check logs for duplicate settlement prevention
    const settlements = await getSettlementLogs(auction.id);
    expect(settlements.length).toBe(1); // Only one settlement processed
  });
  
  it("should handle auto-bid conflicts without deadlock", async () => {
    // Arrange: Player A max 3000, Player B max 2500
    await placeBid(playerA.id, item.id, 1000, 3000);
    
    // Act: Player B bids 1500 with max 2500
    await placeBid(playerB.id, item.id, 1500, 2500);
    
    // Wait for auto-bid resolution
    await waitForAutoBidResolution(item.id);
    
    // Assert: Player A wins at 2625 (PlayerB max + increment)
    const finalItem = await getAuctionItem(item.id);
    expect(finalItem.currentBid).toBe(2625);
    expect(finalItem.currentWinnerId).toBe(playerA.id);
  });
});
```

### Settlement Tests

```typescript
// auction.settlement.test.ts
describe("Auction Settlement", () => {
  it("should handle empty auctions (no bids)", async () => {
    // Arrange: Auction with no bids
    const auction = await createAuctionForTesting();
    await setSystemTime(auction.endTime);
    
    // Act: Settle auction
    await settleAuction(auction.id);
    
    // Assert: No items delivered, no refunds
    const items = await getAuctionItems(auction.id);
    items.forEach(item => {
      expect(item.currentWinnerId).toBeNull();
    });
  });
  
  it("should handle partial auctions (some items have bids)", async () => {
    // Arrange: 3 items with bids, 3 items without
    const auction = await createAuctionForTesting();
    await placeBid(playerA.id, auction.items[0].id, 1000);
    await placeBid(playerB.id, auction.items[1].id, 1500);
    await placeBid(playerC.id, auction.items[2].id, 2000);
    
    await setSystemTime(auction.endTime);
    
    // Act: Settle auction
    await settleAuction(auction.id);
    
    // Assert: 3 items delivered, 3 items remain unsold
    const itemsWithWinners = await getAuctionItems(auction.id);
    expect(itemsWithWinners.filter(i => i.currentWinnerId).length).toBe(3);
  });
  
  it("should expire pending rewards after 7 days", async () => {
    // Arrange: Pending reward with expiresAt = 8 days ago
    const reward = await createPendingReward({
      playerId: playerA.id,
      expiresAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    });
    
    // Act: Run expired reward cron
    await processExpiredRewards();
    
    // Assert: Reward deleted, ducats refunded (80%)
    const rewardCheck = await getPendingReward(reward.id);
    expect(rewardCheck).toBeNull();
    
    const currency = await getCurrency(playerA.id);
    expect(currency.ducats).toBe(playerA.initialDucats + reward.winningBid * 0.8);
  });
});
```

### UI Tests

```typescript
// AuctionHouseScreen.test.tsx
describe("AuctionHouseScreen", () => {
  it("should display 3 auction tabs", () => {
    render(<AuctionHouseScreen />);
    expect(screen.getByText("Auction 1")).toBeInTheDocument();
    expect(screen.getByText("Auction 2")).toBeInTheDocument();
    expect(screen.getByText("Auction 3")).toBeInTheDocument();
  });
  
  it("should display 6 items in active tab", async () => {
    render(<AuctionHouseScreen />);
    await waitForLoadingToFinish();
    
    const items = screen.getAllByTestId("auction-item-card");
    expect(items.length).toBe(6);
  });
  
  it("should open bidding modal on item click", async () => {
    render(<AuctionHouseScreen />);
    await waitForLoadingToFinish();
    
    const firstItem = screen.getAllByTestId("auction-item-card")[0];
    fireEvent.click(firstItem);
    
    expect(screen.getByText("Place Bid")).toBeInTheDocument();
  });
  
  it("should show 'Winning' state after successful bid", async () => {
    render(<AuctionHouseScreen />);
    await waitForLoadingToFinish();
    
    const firstItem = screen.getAllByTestId("auction-item-card")[0];
    fireEvent.click(firstItem);
    
    const bidInput = screen.getByLabelText("Your Bid");
    fireEvent.change(bidInput, { target: { value: "1500" } });
    
    const placeBidButton = screen.getByText("Place Bid");
    fireEvent.click(placeBidButton);
    
    await waitFor(() => {
      expect(screen.getByText("🏆 YOU")).toBeInTheDocument();
    });
  });
  
  it("should update to 'Outbid' state when outbid", async () => {
    // Mock polling that returns outbid status
    mockAuctionAPI.getAuctionDetails.mockResolvedValue({
      items: [{ ...mockItem, currentWinnerId: "other-player" }]
    });
    
    render(<AuctionHouseScreen />);
    await waitForLoadingToFinish();
    
    // Wait for polling update (10 seconds)
    await advanceTimersByTime(10000);
    
    expect(screen.getByText("⚔️ OUTBID")).toBeInTheDocument();
  });
});
```

### Edge Cases to Verify

1. **Player goes offline mid-auction**
   - Verify auto-bid still works
   - Verify settlement proceeds
   - Verify item delivered on next login

2. **Server restarts during auction**
   - Verify Redis persistence or recovery
   - Verify no duplicate settlements
   - Verify timers resume correctly

3. **Database deadlock on high contention**
   - Simulate 100 players bidding on same item
   - Verify transaction isolation prevents corruption
   - Verify retry logic handles timeouts

4. **Inventory exactly full (no space)**
   - Verify pending reward created
   - Verify player cannot bid until claimed

5. **Player deletes account while winning**
   - Verify item not lost
   - Verify refund to next highest bidder (future feature)

6. **Negative ducats bug**
   - Verify all currency operations use absolute checks
   - Verify no underflow exploits

7. **Timezone edge cases**
   - Auction ends at daylight saving transition
   - Verify settlement cron handles time jumps

---

## 8. PSEUDOCODE

### Placing a Manual Bid

```python
function placeBid(playerId, itemId, bidAmount, maxAutoBid):
    # Start transaction
    BEGIN TRANSACTION
    
    # 1. Load player currency
    currency = db.getCurrency(playerId)
    if currency.ducats < bidAmount:
        ROLLBACK
        throw "Insufficient ducats"
    
    # 2. Load item and verify auction status
    item = db.getItemWithAuction(itemId)
    if item.auction.status != "active":
        ROLLBACK
        throw "Auction not active"
    
    # 3. Verify bid is higher than current
    minBid = calculateMinBid(item.currentBid)
    if bidAmount < minBid:
        ROLLBACK
        throw "Bid must be at least " + minBid
    
    # 4. Check rate limit (Redis)
    bidCount = redis.get("bid:rate:" + playerId)
    if bidCount >= 10:
        ROLLBACK
        throw "Rate limit exceeded (10 bids per minute)"
    redis.incr("bid:rate:" + playerId)
    redis.expire("bid:rate:" + playerId, 60)
    
    # 5. Deduct ducats (reserve)
    db.updateCurrency(playerId, {
        ducats: currency.ducats - bidAmount
    })
    
    # 6. Create bid record
    bid = db.createBid({
        itemId: itemId,
        playerId: playerId,
        bidAmount: bidAmount,
        maxAutoBid: maxAutoBid,
        status: "active",
        isAutoBid: false
    })
    
    # 7. Update item current bid
    previousWinnerId = item.currentWinnerId
    db.updateItem(itemId, {
        currentBid: bidAmount,
        currentWinnerId: playerId,
        bidCount: item.bidCount + 1
    })
    
    # 8. Refund previous winner
    if previousWinnerId != null and previousWinnerId != playerId:
        refundPreviousBidder(previousWinnerId, itemId)
    
    # 9. Check for auction extension
    timeRemaining = item.auction.endTime - now()
    if timeRemaining < 2 minutes and item.extensionsUsed < item.maxExtensions:
        db.updateItem(itemId, {
            extensionsUsed: item.extensionsUsed + 1
        })
        db.updateAuction(item.auctionId, {
            endTime: item.auction.endTime + 2 minutes
        })
    
    # 10. Trigger auto-bid for previous winner (async)
    if previousWinnerId != null and previousWinnerId != playerId:
        queueAutoBid(previousWinnerId, itemId, bidAmount)
    
    COMMIT TRANSACTION
    
    return bid
```

### Processing an Outbid (Refund Flow)

```python
function refundPreviousBidder(playerId, itemId):
    # Find previous active bid
    previousBid = db.findBid({
        playerId: playerId,
        itemId: itemId,
        status: "active"
    })
    
    if previousBid == null:
        return  # No active bid found
    
    # Mark bid as outbid
    db.updateBid(previousBid.id, {
        status: "outbid"
    })
    
    # Refund ducats
    db.updateCurrency(playerId, {
        ducats: increment(previousBid.bidAmount)
    })
    
    # Log telemetry
    telemetry.log("auction.bid.outbid", {
        playerId: playerId,
        itemId: itemId,
        refundAmount: previousBid.bidAmount
    })
```

### Processing Auto-Bid Conflict

```python
function processAutoBid(playerId, itemId, newBidAmount):
    # Acquire Redis lock (prevent concurrent auto-bids)
    lockKey = "auction:item:" + itemId + ":auto-bid-lock"
    lock = redis.setnx(lockKey, "locked", ex=10)
    
    if not lock:
        # Another auto-bid in progress, exit
        return
    
    try:
        # Load outbid player's previous bid
        previousBid = db.findBid({
            playerId: playerId,
            itemId: itemId,
            status: "outbid"
        })
        
        if previousBid == null or previousBid.maxAutoBid <= newBidAmount:
            # No auto-bid or max already exceeded
            return
        
        # Calculate auto-bid amount
        minIncrement = max(10, newBidAmount * 0.05)
        autoBidAmount = min(newBidAmount + minIncrement, previousBid.maxAutoBid)
        
        # Check player still has sufficient ducats
        currency = db.getCurrency(playerId)
        if currency.ducats < autoBidAmount:
            # Insufficient funds, cannot auto-bid
            return
        
        # Place auto-bid (recursive, may trigger opponent's auto-bid)
        placeBid(playerId, itemId, autoBidAmount, previousBid.maxAutoBid)
        
        # Mark as auto-bid
        db.updateBid(lastInsertedBidId, {
            isAutoBid: true
        })
        
    finally:
        redis.del(lockKey)
```

### Auto-Bid Conflict Between Two Players

```python
function handleAutoBidConflict(playerA, playerB, itemId):
    # Scenario: Player A max 3000, Player B max 2500, starting bid 1000
    
    # Player A bids 1000 with max 3000
    placeBid(playerA, itemId, 1000, 3000)
    # Item currentBid = 1000, currentWinnerId = playerA
    
    # Player B bids 1500 with max 2500
    placeBid(playerB, itemId, 1500, 2500)
    # Item currentBid = 1500, currentWinnerId = playerB
    # Triggers processAutoBid(playerA, itemId, 1500)
    
    # Auto-bid round 1: Player A
    minIncrement = max(10, 1500 * 0.05) = 75
    autoBidA = min(1500 + 75, 3000) = 1575
    placeBid(playerA, itemId, 1575, 3000)
    # Item currentBid = 1575, currentWinnerId = playerA
    # Triggers processAutoBid(playerB, itemId, 1575)
    
    # Auto-bid round 2: Player B
    minIncrement = max(10, 1575 * 0.05) = 79
    autoBidB = min(1575 + 79, 2500) = 1654
    placeBid(playerB, itemId, 1654, 2500)
    # Item currentBid = 1654, currentWinnerId = playerB
    # Triggers processAutoBid(playerA, itemId, 1654)
    
    # ... rounds continue ...
    
    # Auto-bid round N: Player B reaches max
    # Player B bids 2500 (max)
    # Triggers processAutoBid(playerA, itemId, 2500)
    
    # Auto-bid round N+1: Player A wins
    minIncrement = max(10, 2500 * 0.05) = 125
    autoBidA = min(2500 + 125, 3000) = 2625
    placeBid(playerA, itemId, 2625, 3000)
    # Item currentBid = 2625, currentWinnerId = playerA
    # Triggers processAutoBid(playerB, itemId, 2625)
    # Player B max (2500) < new bid (2625) → no auto-bid
    
    # Final state: Player A wins at 2625
```

### Auction Settlement

```python
function settleAuction(auctionId):
    # 1. Check if already settled (idempotency)
    auction = db.getAuction(auctionId)
    if auction.status == "settled":
        return  # Already processed
    
    # 2. Atomically mark as settling
    updated = db.updateAuctionIfStatus(auctionId, "active", "settling")
    if not updated:
        return  # Another process is settling
    
    # 3. Load all items in auction
    items = db.getItemsByAuction(auctionId)
    
    # 4. Process each item
    for item in items:
        settleItem(item)
    
    # 5. Mark auction as settled
    db.updateAuction(auctionId, {
        status: "settled"
    })
    
    # 6. Log telemetry
    telemetry.log("auction.settlement.completed", {
        auctionId: auctionId,
        itemsSettled: items.length
    })
```

### Item Settlement (Individual)

```python
function settleItem(item):
    if item.currentWinnerId == null:
        # No bids, item remains unsold
        return
    
    # 1. Mark winning bid as won
    winningBid = db.findBid({
        playerId: item.currentWinnerId,
        itemId: item.id,
        status: "active"
    })
    db.updateBid(winningBid.id, {
        status: "won"
    })
    
    # 2. Attempt to deliver item to winner
    inventorySpace = db.getInventorySpace(item.currentWinnerId)
    
    if inventorySpace.hasSpace:
        # Deliver item directly
        db.createInventoryItem({
            playerId: item.currentWinnerId,
            itemCode: item.itemCode,
            slotKey: inventorySpace.nextAvailableSlot
        })
        
        telemetry.log("auction.item.won", {
            playerId: item.currentWinnerId,
            itemId: item.id,
            finalBid: item.currentBid
        })
    else:
        # Inventory full, create pending reward
        db.createPendingReward({
            playerId: item.currentWinnerId,
            itemId: item.id,
            itemCode: item.itemCode,
            auctionId: item.auctionId,
            winningBid: item.currentBid,
            expiresAt: now() + 7 days
        })
        
        telemetry.log("auction.item.pending", {
            playerId: item.currentWinnerId,
            itemId: item.id
        })
    
    # 3. Refund all losing bidders
    losingBids = db.findBids({
        itemId: item.id,
        status: "outbid"
    })
    
    for bid in losingBids:
        # Already refunded during outbid process,
        # just mark as lost for history
        db.updateBid(bid.id, {
            status: "lost"
        })
```

### Reward Delivery (Manual Claim)

```python
function claimPendingReward(playerId, rewardId):
    BEGIN TRANSACTION
    
    # 1. Load pending reward
    reward = db.getPendingReward(rewardId)
    if reward == null or reward.playerId != playerId:
        ROLLBACK
        throw "Reward not found"
    
    if reward.claimed:
        ROLLBACK
        throw "Reward already claimed"
    
    # 2. Check inventory space
    inventorySpace = db.getInventorySpace(playerId)
    if not inventorySpace.hasSpace:
        ROLLBACK
        throw "Inventory full"
    
    # 3. Deliver item
    db.createInventoryItem({
        playerId: playerId,
        itemCode: reward.itemCode,
        slotKey: inventorySpace.nextAvailableSlot
    })
    
    # 4. Mark reward as claimed
    db.updatePendingReward(rewardId, {
        claimed: true
    })
    
    # 5. Log telemetry
    telemetry.log("auction.reward.claimed", {
        playerId: playerId,
        rewardId: rewardId
    })
    
    COMMIT TRANSACTION
```

### Expired Reward Processing

```python
function processExpiredRewards():
    # Find all expired unclaimed rewards
    expiredRewards = db.findPendingRewards({
        expiresAt: lessThan(now()),
        claimed: false
    })
    
    for reward in expiredRewards:
        BEGIN TRANSACTION
        
        # Convert winning bid to ducats (80% refund)
        refundAmount = floor(reward.winningBid * 0.8)
        db.updateCurrency(reward.playerId, {
            ducats: increment(refundAmount)
        })
        
        # Delete pending reward
        db.deletePendingReward(reward.id)
        
        # Log telemetry
        telemetry.log("auction.reward.expired", {
            playerId: reward.playerId,
            rewardId: reward.id,
            refundAmount: refundAmount
        })
        
        COMMIT TRANSACTION
```

---

## 9. RECOMMENDATION: V1 BUILD-FIRST PLAN

### What to Build First (Priority Order)

**Week 1: Backend Foundation**
1. ✅ Prisma schema migration (all tables)
2. ✅ Item generator service (mock 6 items per auction)
3. ✅ Auction creation cron (00:00, 08:00, 16:00 UTC)
4. ✅ API endpoints:
   - `GET /v1/auction/active` (return active auctions)
   - `GET /v1/auction/:id` (auction details)
5. ✅ Test with Postman: Verify auctions created and queryable

**Week 2: Core Bidding**
1. ✅ `placeBid` service with transaction safety
2. ✅ Ducat reservation/refund logic
3. ✅ API endpoints:
   - `POST /v1/auction/bid`
   - `GET /v1/auction/item/:id/bids` (bid history)
4. ✅ Test with 2 test accounts: verify outbid refund works

**Week 3: Auto-Bid + Settlement**
1. ✅ Auto-bid processing with Redis lock
2. ✅ Settlement cron (detect ended auctions)
3. ✅ Item delivery and pending reward logic
4. ✅ API endpoints:
   - `GET /v1/auction/rewards/pending`
   - `POST /v1/auction/rewards/claim`
5. ✅ Test full lifecycle: bid → auto-bid → settlement → claim

**Week 4: Frontend UI**
1. ✅ AuctionHouseScreen component
2. ✅ Auction tabs (3 tabs)
3. ✅ Item grid (6 items per auction)
4. ✅ Bidding modal
5. ✅ Item tooltips (reuse existing)
6. ✅ Countdown timers
7. ✅ Test end-to-end in browser

**Week 5: Polish + Launch**
1. ✅ Extension mechanic (2-minute snipe protection)
2. ✅ Rate limiting (10 bids/min)
3. ✅ Error handling + loading states
4. ✅ Telemetry events
5. ✅ Performance testing (100 concurrent users)
6. ✅ Balance tuning (starting bids, min increments)
7. 🚀 **LAUNCH V1**

### What to Cut (Postpone to V2)

❌ **Player-submitted items:** Too complex for V1, requires:
- Item submission UI
- Approval/moderation system
- Pricing algorithm for player-set starting bids
- Fraud prevention (fake item scams)

❌ **Multi-instance complexity:** V1 uses single global auction per bracket:
- Simpler to build and test
- Adequate for <5000 concurrent players
- Add multi-instance in V2 when player base grows

❌ **Real-time WebSocket updates:** V1 uses 10-second polling:
- Simpler architecture
- Reduces server load
- Good enough for 16-hour auctions (not millisecond-critical)

❌ **Shill bid detection:** Complex analytics, requires:
- Historical pattern analysis
- Machine learning models
- Manual review tools

❌ **Advanced auction types:** Postpone for V2:
- Blind auctions (sealed bids)
- Dutch auctions (descending price)
- Buy-it-now option

❌ **Auction house tax:** Start with 0% tax, add 5% in V2 after observing economy

### What to Postpone for V2

**V2.0 (3 months after V1 launch):**
- Player-submitted items (with moderation queue)
- Real-time WebSocket bid updates
- Auction notifications (push/email)
- Auction house tax (5% seller fee)
- Buy-it-now option (skip bidding)

**V2.1 (6 months after V1):**
- Advanced search/filters (rarity, class, level)
- Auction history/analytics dashboard
- Shill bid detection (flagging system)
- Cross-server auctions (premium feature)

**V2.2 (9 months after V1):**
- Specialized auction types (rare item events)
- Guild/clan auctions (private)
- Auction reputation system (buyer/seller ratings)

---

## Summary

This is a **complete, implementation-ready blueprint** for your Auction House system. You can:

1. **Start immediately** with Phase 1 (Prisma migration + item generator)
2. **Test incrementally** after each phase (no waiting for full system)
3. **Launch V1 in 5 weeks** with core features only
4. **Iterate post-launch** based on player feedback

**Key V1 Features:**
- ✅ 3 concurrent auctions per level bracket
- ✅ 6 items per auction (system-generated)
- ✅ 16-hour auction duration
- ✅ Auto-bid up to max threshold
- ✅ Anonymous bidding
- ✅ Automatic settlement + refunds
- ✅ Pending rewards for full inventory
- ✅ Anti-snipe extension (2 minutes)

**Deferred to V2:**
- ❌ Player-submitted items
- ❌ Multi-instance complexity
- ❌ Real-time WebSocket updates
- ❌ Auction house tax

**Next Steps:**
1. Review this document with your team
2. Create GitHub issues for each phase
3. Start Phase 1: Run `npx prisma migrate dev --name add_auction_tables`
4. Implement item generator service
5. Set up cron job for auction creation

Good luck! 🚀
