# Auction System Integration Checklist

This checklist covers the integration points between the auction system and your existing game systems. The auction services have `TODO` comments where you need to integrate with your inventory and player systems.

## 🔗 Integration Points

### 1. Inventory System Integration

#### Location: `settlement.service.ts` - Line ~110
**Function:** `returnItemToSeller()`

**Current State:**
```typescript
// TODO: Integrate with inventory system
// For now, create a pending reward so seller can claim it back
await this.prisma.auctionPendingReward.create({ ... });
```

**What to Do:**
Replace the pending reward creation with a direct inventory insertion:

```typescript
// Example integration:
await this.prisma.inventoryItem.create({
  data: {
    playerId: sellerId,
    itemCode: JSON.stringify(itemData),
    slotKey: `slot_${Date.now()}`, // Or use your slot assignment logic
    quantity: 1
  }
});
```

**Alternative:** Keep the pending reward system so players must manually claim items back (prevents inventory overflow).

---

#### Location: `settlement.service.ts` - Line ~132
**Function:** `claimReward()`

**Current State:**
```typescript
// TODO: Add item to player's inventory (integrate with inventory system)
// For now, just mark as claimed
```

**What to Do:**
Add the item to player's inventory before marking as claimed:

```typescript
// Check inventory space
const inventoryCount = await this.prisma.inventoryItem.count({
  where: { playerId }
});

if (inventoryCount >= 48) { // 8x6 grid
  throw new Error("Inventory full");
}

// Add item to inventory
await this.prisma.inventoryItem.create({
  data: {
    playerId,
    itemCode: JSON.stringify(reward.itemData),
    slotKey: await this.findEmptySlot(playerId), // Implement slot finder
    quantity: 1
  }
});
```

---

#### Location: `player-submission.service.ts` - Line ~38
**Function:** `submitItem()`

**Current State:**
```typescript
// 3. TODO: Remove item from player's inventory
// This should integrate with your inventory system
// For now, we assume the item is valid and available
```

**What to Do:**
Before creating the listing, remove the item from player's inventory:

```typescript
// Validate item exists in inventory
const inventoryItem = await this.prisma.inventoryItem.findUnique({
  where: { id: itemId } // Player should pass itemId in request
});

if (!inventoryItem || inventoryItem.playerId !== playerId) {
  throw new Error("Item not found in inventory");
}

// Remove from inventory
await this.prisma.inventoryItem.delete({
  where: { id: itemId }
});
```

---

#### Location: `player-submission.service.ts` - Line ~105
**Function:** `rejectSubmission()`

**Current State:**
```typescript
// TODO: Return item to player's inventory
```

**What to Do:**
Return the item when submission is rejected:

```typescript
// Return item to inventory
await this.prisma.inventoryItem.create({
  data: {
    playerId: listing.playerId,
    itemCode: JSON.stringify(listing.itemData),
    slotKey: await this.findEmptySlot(listing.playerId),
    quantity: 1
  }
});
```

---

#### Location: `player-submission.service.ts` - Line ~183
**Function:** `cancelSubmission()`

**Current State:**
```typescript
// TODO: Return item to player's inventory
```

**What to Do:**
Same as rejection - return the item to inventory.

---

### 2. Item Generation Integration

#### Location: `item-generator.service.ts`
**Function:** `generateItemsForAuction()`

**Current State:**
Generates mock items with placeholder stats.

**What to Do:**
Replace with your actual item generation system:

```typescript
import { generateRandomItem } from "@ebonkeep/shared/item-generator";

async generateItemsForAuction(levelBracket, count) {
  const items = [];
  
  for (let i = 0; i < count; i++) {
    const rarity = this.selectRarity();
    const itemLevel = this.randomInRange(levelBracket.min, levelBracket.max);
    
    // Use your item generator
    const item = await generateRandomItem({
      level: itemLevel,
      rarity,
      slot: this.selectRandomSlot() // weapon, armor, jewelry
    });
    
    items.push({
      itemData: item,
      startingBid: this.calculateStartingBid(itemLevel, rarity)
    });
  }
  
  return items;
}
```

---

### 3. Player Item Submission - Frontend Integration

**API Endpoint:** `POST /v1/auction/submit`

**Frontend Flow:**
1. Player opens inventory UI
2. Player clicks "Sell at Auction" button on an item
3. Modal appears: "Set starting bid" input
4. Player confirms submission

**Request:**
```typescript
const response = await fetch('/v1/auction/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    itemId: selectedItem.id, // Add this parameter to submission service
    itemData: selectedItem, // Full item object
    desiredStartingBid: 1000 // User-specified starting bid
  })
});
```

**Update Submission Service:**
Add `itemId` parameter to track which inventory item is being submitted:

```typescript
async submitItem(
  playerId: string,
  itemId: string, // NEW: inventory item ID
  itemData: any,
  desiredStartingBid: number
) {
  // Validate item exists in inventory
  const inventoryItem = await this.prisma.inventoryItem.findUnique({
    where: { id: itemId, playerId }
  });
  
  if (!inventoryItem) {
    throw new Error("Item not found in inventory");
  }
  
  // ... rest of submission logic
}
```

---

### 4. Admin Approval UI

**Endpoints:**
- `GET /v1/auction/admin/submissions/pending` - List pending submissions
- `POST /v1/auction/admin/submissions/approve` - Approve item
- `POST /v1/auction/admin/submissions/reject` - Reject item

**Admin Panel Features:**
- Display item stats, player name, desired starting bid
- Approve/Reject buttons
- Rejection reason text input
- "Refund listing fee" checkbox

**Example Admin UI:**
```typescript
const PendingSubmissions = () => {
  const { data } = useQuery('/v1/auction/admin/submissions/pending');
  
  const handleApprove = async (listingId) => {
    await fetch('/v1/auction/admin/submissions/approve', {
      method: 'POST',
      body: JSON.stringify({ listingId })
    });
  };
  
  const handleReject = async (listingId, reason) => {
    await fetch('/v1/auction/admin/submissions/reject', {
      method: 'POST',
      body: JSON.stringify({
        listingId,
        reason,
        refundListingFee: true
      })
    });
  };
  
  return (
    <div>
      {data.submissions.map(submission => (
        <SubmissionCard
          key={submission.id}
          item={submission.itemData}
          onApprove={() => handleApprove(submission.id)}
          onReject={(reason) => handleReject(submission.id, reason)}
        />
      ))}
    </div>
  );
};
```

---

### 5. Cron Jobs / Background Tasks

**Settlement Job (Required):**
```typescript
// In your API startup (apps/api/src/app.ts or similar)
import { AuctionSettlementService } from "./modules/auction/services/settlement.service.js";

const settlementService = new AuctionSettlementService(prisma);

// Run every minute
setInterval(async () => {
  await settlementService.runSettlementJob();
}, 60 * 1000);
```

**Auction Creation Job (Required):**
```typescript
import { AuctionInstanceService } from "./modules/auction/services/instance.service.js";

const instanceService = new AuctionInstanceService(prisma);

// Run at configured start times (e.g., 00:00, 12:00 UTC)
// Use node-cron or similar
import cron from "node-cron";

// Every day at midnight and noon UTC
cron.schedule("0 0,12 * * *", async () => {
  await instanceService.createAuctionInstances();
});
```

---

### 6. Authentication Guards

**Required:**
- `fastify.authenticate` - Verify JWT token, populate `request.user`
- `fastify.requireAdmin` - Check if user has admin/moderator role

**Example Implementation:**
```typescript
// In apps/api/src/plugins/auth.ts
fastify.decorate("authenticate", async (request, reply) => {
  const token = request.headers.authorization?.replace("Bearer ", "");
  const decoded = verifyJWT(token);
  
  const player = await prisma.player.findUnique({
    where: { id: decoded.playerId }
  });
  
  if (!player) {
    throw new Error("Player not found");
  }
  
  request.user = { playerId: player.id, level: player.level };
});

fastify.decorate("requireAdmin", async (request, reply) => {
  const player = await prisma.player.findUnique({
    where: { id: request.user.playerId }
  });
  
  if (player.role !== "admin" && player.role !== "moderator") {
    throw new Error("Admin access required");
  }
});
```

---

## ✅ Integration Checklist

- [ ] **Inventory - Item Removal**: Remove item from inventory when submitting to auction
- [ ] **Inventory - Item Return**: Return item to inventory when submission rejected/cancelled
- [ ] **Inventory - Item Claim**: Add won items to inventory when claiming rewards
- [ ] **Inventory - Slot Management**: Implement `findEmptySlot()` helper for inventory placement
- [ ] **Item Generator**: Replace mock item generation with real item generator
- [ ] **Player Submission Frontend**: Add "Sell at Auction" button in inventory UI
- [ ] **Admin Approval UI**: Create admin panel for approving/rejecting submissions
- [ ] **Settlement Cron Job**: Setup background job to run `runSettlementJob()` every minute
- [ ] **Auction Creation Cron Job**: Setup scheduled auction creation at configured times
- [ ] **Authentication Guards**: Implement `fastify.authenticate` and `fastify.requireAdmin`
- [ ] **Database Migration**: Run Prisma migration to add auction tables
- [ ] **Config File**: Copy `auction_config.ini` to API project root
- [ ] **Test Endpoints**: Test all endpoints with real player data

---

## 🎯 Priority Order

1. **Database Migration** - Must be done first
2. **Authentication Guards** - Required for all endpoints
3. **Inventory Integration** - Core functionality
4. **Settlement Cron Job** - Auctions won't complete without it
5. **Auction Creation Cron Job** - No auctions will spawn without it
6. **Item Generator Integration** - System-generated items
7. **Player Submission Frontend** - Player-submitted items
8. **Admin Approval UI** - For moderating player submissions

---

## 🧪 Testing Strategy

1. **Unit Tests**: Test each service method independently
2. **Integration Tests**: Test full flow (submit → approve → list → bid → win → claim)
3. **Load Tests**: Test with 50 concurrent players bidding
4. **Economy Tests**: Verify 5% fee is correctly deducted
5. **Snipe Protection Tests**: Verify extensions trigger correctly

---

**Note:** All `TODO` comments in the code are marked at the exact lines where integration is needed. Search for `TODO:` in the service files to find them quickly.
