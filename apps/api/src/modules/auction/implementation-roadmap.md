# Auction House Implementation Roadmap

## Quick Start Checklist

### Phase 0: Setup (30 minutes)
- [ ] Read `AUCTION_HOUSE_DESIGN.md` (full design document)
- [ ] Copy models from `prisma-schema-additions.prisma` to `apps/api/prisma/schema.prisma`
- [ ] Run migration: `npx prisma migrate dev --name add_auction_tables`
- [ ] Verify tables created: `npx prisma studio` → check auction_* tables
- [ ] Create `apps/api/src/modules/auction/` directory
- [ ] Copy starter files from `starter-code/` to `modules/auction/`

### Phase 1: Backend Foundation (2-3 days)

**Goal:** Create auctions that can be queried via API (no bidding yet)

**Tasks:**
- [ ] Create `apps/api/src/modules/auction/services/instance.service.ts`
  - `createAuctionInstances()` - generate auctions for all level brackets
  - `getActiveAuctionsForPlayer(playerId)` - return auctions for player's bracket
  - `getAuctionDetails(auctionId)` - full auction with 6 items

- [ ] Create `apps/api/src/modules/auction/services/item-generator.service.ts`
  - `generateItemsForAuction(levelMin, levelMax)` - mock 6 items
  - `calculateStartingBid(itemLevel, rarity)` - use formula from design doc

- [ ] Create `apps/api/src/modules/auction/routes.ts`
  - `GET /v1/auction/active` - list active auctions
  - `GET /v1/auction/:id` - auction details

- [ ] Create `apps/api/src/modules/auction/jobs/auction-creator.job.ts`
  - Cron: `0 0,8,16 * * *` (00:00, 08:00, 16:00 UTC)
  - For each bracket [1-10], [11-20], ..., [91-100]:
    - Create AuctionInstance
    - Generate 6 items
    - Set status = "active", endTime = now + 16 hours

- [ ] Register routes in `apps/api/src/index.ts`:
  ```typescript
  import { auctionRoutes } from "./modules/auction/routes.js";
  await fastify.register(auctionRoutes);
  ```

**Testing:**
```bash
# Manually trigger auction creation (for testing)
# In Redis CLI or create a test endpoint
curl -X POST http://localhost:4000/v1/auction/test/create-auctions

# Verify auctions exist
curl http://localhost:4000/v1/auction/active

# Expected response: { auctions: [{ id, levelBracketMin, levelBracketMax, items: [...] }] }
```

**Success Criteria:**
- ✅ Can query active auctions via API
- ✅ See 6 items per auction
- ✅ Items have correct level range for bracket
- ✅ Items have starting bids calculated

---

### Phase 2: Core Bidding (3-4 days)

**Goal:** Players can place bids, ducats are reserved, outbid players refunded

**Tasks:**
- [ ] Create `apps/api/src/modules/auction/services/bid.service.ts`
  - `placeBid(playerId, itemId, bidAmount, maxAutoBid)` - fully transactional
  - `canPlayerBid(playerId, amount)` - check ducats
  - `calculateMinBid(currentBid)` - MAX(10, 5% of current)
  - `refundOutbidPlayer(playerId, itemId)` - restore ducats
  - `getBidHistory(itemId, limit)` - last N bids

- [ ] Add routes to `routes.ts`:
  - `POST /v1/auction/bid` - place bid
  - `GET /v1/auction/item/:itemId/bids` - bid history

- [ ] Implement transaction safety:
  ```typescript
  await prisma.$transaction(async (tx) => {
    // 1. Check currency
    // 2. Verify item active
    // 3. Verify bid > currentBid
    // 4. Deduct ducats
    // 5. Create bid record
    // 6. Update item currentBid/winner
    // 7. Refund previous winner
  }, { isolationLevel: "Serializable" });
  ```

**Testing:**
```bash
# Create test players (you may already have this)
# Player A: 10,000 ducats
# Player B: 10,000 ducats

# Player A bids 1000 on item
curl -X POST http://localhost:4000/v1/auction/bid \
  -H "Authorization: Bearer $PLAYER_A_TOKEN" \
  -d '{"itemId": "item_abc", "bidAmount": 1000, "maxAutoBid": 1000}'

# Check Player A ducats: should be 9,000

# Player B bids 1500
curl -X POST http://localhost:4000/v1/auction/bid \
  -H "Authorization: Bearer $PLAYER_B_TOKEN" \
  -d '{"itemId": "item_abc", "bidAmount": 1500, "maxAutoBid": 1500}'

# Check Player A ducats: should be 10,000 (refunded)
# Check Player B ducats: should be 8,500

# Get bid history
curl http://localhost:4000/v1/auction/item/item_abc/bids
# Expected: [{ playerId: null, bidAmount: 1500 }, { playerId: null, bidAmount: 1000 }]
# (playerIds hidden in response for anonymity)
```

**Success Criteria:**
- ✅ Bids recorded in database
- ✅ Ducats deducted from bidder
- ✅ Previous bidder refunded immediately
- ✅ Item currentBid and currentWinnerId updated
- ✅ Bid history API returns last 5 bids

---

### Phase 3: Auto-Bid (2-3 days)

**Goal:** When player is outbid, system auto-bids up to their max

**Tasks:**
- [ ] Add Redis dependency to bid service
- [ ] Implement `processAutoBid(playerId, itemId, newBidAmount)`:
  ```typescript
  // 1. Acquire Redis lock: "auction:item:{itemId}:auto-bid-lock"
  // 2. Check if player has active bid with maxAutoBid > newBidAmount
  // 3. Calculate auto-bid: MIN(newBid + 5%, maxAutoBid)
  // 4. Call placeBid() recursively (this may trigger opponent's auto-bid)
  // 5. Release lock
  ```

- [ ] Trigger auto-bid in `refundOutbidPlayer()`:
  ```typescript
  async function refundOutbidPlayer(playerId, itemId) {
    // ... existing refund logic ...
    
    // Queue auto-bid (use async worker or immediate call)
    await processAutoBid(playerId, itemId, item.currentBid);
  }
  ```

**Testing:**
```bash
# Player A bids 1000 with max 2000
curl -X POST http://localhost:4000/v1/auction/bid \
  -d '{"itemId": "item_abc", "bidAmount": 1000, "maxAutoBid": 2000}'

# Player B bids 1100 (no max)
curl -X POST http://localhost:4000/v1/auction/bid \
  -d '{"itemId": "item_abc", "bidAmount": 1100, "maxAutoBid": 1100}'

# Check item currentBid: should be 1155 (auto-bid from A)
# Check item currentWinnerId: should be Player A

# Player B bids 2500
curl -X POST http://localhost:4000/v1/auction/bid \
  -d '{"itemId": "item_abc", "bidAmount": 2500, "maxAutoBid": 2500}'

# Check item currentBid: should be 2500
# Check item currentWinnerId: should be Player B (A's max exceeded)
```

**Success Criteria:**
- ✅ Auto-bid triggers when player outbid
- ✅ Auto-bid respects max threshold
- ✅ Auto-bid conflicts resolve correctly (higher max wins)
- ✅ No infinite loops or deadlocks
- ✅ Redis lock prevents concurrent auto-bid corruption

---

### Phase 4: Settlement and Delivery (3-4 days)

**Goal:** Auctions end automatically, winners get items, losers refunded

**Tasks:**
- [ ] Create `apps/api/src/modules/auction/services/settlement.service.ts`
  - `settleAuction(auctionId)` - process all 6 items
  - `settleItem(item)` - deliver or create pending reward
  - `deliverItemToWinner(winnerId, itemCode)` - add to inventory
  - `createPendingReward(winnerId, item)` - if inventory full

- [ ] Create `apps/api/src/modules/auction/jobs/auction-settler.job.ts`
  - Cron: `* * * * *` (every minute)
  - Find auctions with `endTime <= now()` and `status = 'active'`
  - Call `settleAuction(auctionId)` for each

- [ ] Create `apps/api/src/modules/auction/jobs/expired-rewards.job.ts`
  - Cron: `0 * * * *` (hourly)
  - Find `AuctionPendingReward` where `expiresAt < now()` and `claimed = false`
  - Refund 80% of winning bid as ducats
  - Delete pending reward

- [ ] Add routes:
  - `GET /v1/auction/rewards/pending` - player's unclaimed items
  - `POST /v1/auction/rewards/claim` - claim pending item

**Testing:**
```bash
# Create auction ending in 1 minute (for testing)
# Manually set endTime = now + 1 minute in DB

# Player A bids 1000 and wins
curl -X POST http://localhost:4000/v1/auction/bid \
  -d '{"itemId": "item_abc", "bidAmount": 1000, "maxAutoBid": 1000}'

# Wait 1 minute for settlement cron to run

# Check Player A inventory: should have item
curl http://localhost:4000/v1/player/state \
  -H "Authorization: Bearer $PLAYER_A_TOKEN"
# Expected: inventoryItems includes won item

# Test inventory full scenario:
# Fill Player A's inventory (48 slots)
# Player A wins another auction item
# Wait for settlement

# Check pending rewards
curl http://localhost:4000/v1/auction/rewards/pending \
  -H "Authorization: Bearer $PLAYER_A_TOKEN"
# Expected: [{ id, itemCode, winningBid, expiresAt }]

# Claim reward
curl -X POST http://localhost:4000/v1/auction/rewards/claim \
  -d '{"rewardId": "reward_abc"}' \
  -H "Authorization: Bearer $PLAYER_A_TOKEN"
# Expected: { success: true, item: {...} }
```

**Success Criteria:**
- ✅ Auctions settle automatically at endTime
- ✅ Winners receive items in inventory
- ✅ Losers refunded (should already be refunded during bidding)
- ✅ Pending rewards created if inventory full
- ✅ Cannot bid while having pending rewards
- ✅ Expired rewards converted to ducats (80%)

---

### Phase 5: Frontend UI (5-6 days)

**Goal:** Players can browse auctions and place bids in browser

**Tasks:**
- [ ] Create `apps/web/src/pages/AuctionHouseScreen.tsx`
- [ ] Create `apps/web/src/components/auction/AuctionTabBar.tsx`
  - 3 tabs for 3 concurrent auctions
  - Show "Ends in: Xh Ym" countdown
  - Highlight active tab

- [ ] Create `apps/web/src/components/auction/AuctionItemGrid.tsx`
  - Grid layout: 3 columns x 2 rows (6 items)
  - Each item shows icon, rarity badge, current bid, bid count

- [ ] Create `apps/web/src/components/auction/AuctionItemCard.tsx`
  - States: idle, winning (green border), outbid (red border), ended
  - Click opens bidding modal
  - Hover shows item tooltip (reuse existing component)

- [ ] Create `apps/web/src/components/auction/BiddingModal.tsx`
  - Item preview (icon, stats, affixes)
  - Current bid display
  - Bid input field (validate min bid)
  - Auto-bid max input (optional)
  - "Place Bid" button

- [ ] Create `apps/web/src/components/auction/AuctionTimer.tsx`
  - Countdown component (updates every second)
  - Format: "12h 30m" or "4m 15s" or "58s"
  - Show red warning when < 2 minutes

- [ ] Create `apps/web/src/components/auction/PendingRewardsPanel.tsx`
  - List of unclaimed items
  - "Claim" button for each
  - Show expiration countdown

- [ ] Add route to `apps/web/src/App.tsx`:
  ```typescript
  <Route path="/auction" element={<AuctionHouseScreen />} />
  ```

- [ ] Implement polling (refresh every 10 seconds):
  ```typescript
  useEffect(() => {
    const interval = setInterval(() => {
      refetchAuctions();
    }, 10000);
    return () => clearInterval(interval);
  }, []);
  ```

**Testing:**
- Navigate to `http://localhost:3000/auction`
- Verify 3 auction tabs visible
- Click each tab, verify 6 items load
- Hover over item, verify tooltip appears with stats
- Click item, verify bidding modal opens
- Enter bid amount lower than minimum → verify validation error
- Enter valid bid → verify modal closes, item shows "Winning" state
- Open in second browser (different account) → outbid first player
- Verify first player sees "Outbid" state (after 10-second poll)
- Wait for auction to end → verify winner sees "Won" badge
- Check inventory → verify item delivered

**Success Criteria:**
- ✅ UI matches ASCII wireframe from design doc
- ✅ Can place bids via modal
- ✅ Auto-bid input works correctly
- ✅ Timers count down in real-time
- ✅ Item states update correctly (winning/outbid/won/lost)
- ✅ Pending rewards panel functional
- ✅ Responsive on mobile (stack items vertically)

---

### Phase 6: Polish / Balancing / Launch (2-3 days)

**Goal:** Production-ready with anti-abuse, telemetry, performance

**Tasks:**
- [ ] Add extension mechanic to `bid.service.ts`:
  ```typescript
  const timeRemaining = item.auction.endTime.getTime() - Date.now();
  if (timeRemaining < 2 * 60 * 1000 && item.extensionsUsed < 5) {
    await tx.auctionItem.update({
      where: { id: itemId },
      data: { extensionsUsed: { increment: 1 } }
    });
    await tx.auctionInstance.update({
      where: { id: item.auctionInstanceId },
      data: { endTime: new Date(item.auction.endTime.getTime() + 2 * 60 * 1000) }
    });
  }
  ```

- [ ] Add rate limiting in `routes.ts`:
  ```typescript
  fastify.post("/v1/auction/bid", {
    preHandler: [fastify.authenticate, rateLimitBids]
  }, async (request, reply) => {
    // ... bid logic
  });
  
  async function rateLimitBids(request, reply) {
    const key = `bid:rate:${request.user.playerId}`;
    const count = await fastify.redis.incr(key);
    await fastify.redis.expire(key, 60);
    if (count > 10) {
      return reply.code(429).send({ error: "Rate limit: max 10 bids per minute" });
    }
  }
  ```

- [ ] Add telemetry events:
  ```typescript
  await fastify.telemetry.log("auction.bid.placed", {
    playerId,
    itemId,
    bidAmount,
    maxAutoBid,
    isAutoBid: false
  });
  
  await fastify.telemetry.log("auction.item.won", {
    playerId: winnerId,
    itemId,
    finalBid: item.currentBid
  });
  ```

- [ ] Performance test with k6 or artillery:
  ```javascript
  // k6 script
  import http from 'k6/http';
  export const options = {
    vus: 100, // 100 virtual users
    duration: '30s',
  };
  export default function () {
    const payload = JSON.stringify({
      itemId: 'item_abc',
      bidAmount: Math.floor(Math.random() * 10000),
      maxAutoBid: Math.floor(Math.random() * 20000)
    });
    http.post('http://localhost:4000/v1/auction/bid', payload, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${__ENV.TOKEN}` }
    });
  }
  ```

- [ ] Balance starting bids per rarity:
  ```typescript
  // item-generator.service.ts
  function calculateStartingBid(itemLevel: number, rarity: string): number {
    const baseValue = itemLevel * 10; // 1 ducat per level
    const rarityMultiplier = {
      common: 1,
      uncommon: 3,
      rare: 10,
      epic: 30
    };
    return Math.floor(baseValue * rarityMultiplier[rarity] * 0.6); // 60% of "vendor value"
  }
  ```

- [ ] Add error boundaries and loading states:
  ```typescript
  // AuctionHouseScreen.tsx
  if (isLoading) return <LoadingSpinner message="Loading auctions..." />;
  if (error) return <ErrorState message="Failed to load auctions" retry={refetch} />;
  if (auctions.length === 0) return <EmptyState title="No Active Auctions" />;
  ```

**Testing:**
- Run k6 load test: 100 concurrent users bidding → verify no crashes
- Attempt to spam bids → verify rate limit blocks after 10
- Place bid in final 90 seconds → verify auction extends by 2 minutes
- Verify extension capped at 5 (max 10 minutes)
- Check Grafana/telemetry dashboard → verify events logged
- Test on mobile device → verify responsive layout
- Test on slow connection → verify loading states appear

**Success Criteria:**
- ✅ Extension mechanic works (2-minute snipe protection)
- ✅ Rate limiting prevents abuse (10 bids/min)
- ✅ Telemetry events logged correctly
- ✅ No crashes under 100 concurrent users
- ✅ Starting bids balanced per rarity
- ✅ Error handling robust (graceful degradation)
- ✅ Mobile responsive

---

## 🚀 Launch Checklist

- [ ] All 6 phases complete and tested
- [ ] Database migrations applied to production
- [ ] Cron jobs scheduled (auction creator, settler, expired rewards)
- [ ] Redis configured and tested
- [ ] Monitoring/alerts set up (Sentry, Grafana)
- [ ] Rollback plan documented
- [ ] Announce to players (in-game message, Discord)
- [ ] Monitor first 24 hours closely (check for crashes, balance issues)

---

## Common Issues & Solutions

### Issue: Auctions not appearing in UI
**Solution:** Check cron job ran successfully. Manually trigger:
```bash
curl -X POST http://localhost:4000/v1/auction/test/create-auctions
```

### Issue: Bids rejected with "Insufficient ducats"
**Solution:** Verify player currency balance. Check for pending bids that may have reserved ducats.

### Issue: Auto-bid infinite loop
**Solution:** Check Redis lock is acquired/released correctly. Add timeout to lock (10 seconds).

### Issue: Settlement not running
**Solution:** Verify cron job scheduled correctly. Check server timezone vs UTC.

### Issue: Inventory full but no pending reward created
**Solution:** Check `deliverItemToWinner` logic. Add debug logging.

### Issue: Timers not updating in UI
**Solution:** Verify `AuctionTimer` component re-renders every second. Check `setInterval` cleanup.

---

## Post-Launch Monitoring

**Metrics to watch:**
- Auctions created per day
- Total bids placed
- Average bids per item
- Auto-bid trigger rate
- Settlement success rate
- Pending rewards expiring (high expiry = bad UX)
- Player complaints (Discord, support tickets)

**Economy balance:**
- Average ducats spent per player per day
- Compare against ducat sources (combat, jobs)
- Adjust starting bids if inflation detected

**Performance:**
- API response times (p50, p95, p99)
- Database query duration
- Redis hit ratio
- WebSocket connection count (future)

---

## V2 Roadmap (Post-Launch)

**Month 1 (Polish):**
- Real-time WebSocket updates (remove 10-second polling)
- Auction notifications (push/email)
- Advanced filters (rarity, class, level)

**Month 2 (Features):**
- Player-submitted items (with moderation)
- Auction house tax (5% seller fee)
- Buy-it-now option

**Month 3 (Advanced):**
- Shill bid detection
- Cross-server auctions (premium feature)
- Guild/clan private auctions

---

## Resources

- **Full Design Document:** `AUCTION_HOUSE_DESIGN.md`
- **Prisma Schema:** `prisma-schema-additions.prisma`
- **Starter Code:** `starter-code/` directory
- **API Documentation:** Generate with Swagger/OpenAPI after routes complete
- **Discord Support:** #dev-auction-house channel

---

**Good luck! Start with Phase 1 and work incrementally. Test after each phase. 🚀**
