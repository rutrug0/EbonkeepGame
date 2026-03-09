# Auction House System

Complete implementation blueprint and starter code for a browser RPG auction house feature.

## 📁 Files in This Directory

### Core Documentation
- **`AUCTION_HOUSE_DESIGN.md`** - Complete system design (9 sections)
  - System analysis, V1 design decisions
  - Backend architecture (domain models, DB schema, services, cron jobs)
  - Frontend architecture (UI layouts, components, states)
  - Game design recommendations (economy, anti-abuse, UX)
  - Phase-by-phase implementation plan (6 phases)
  - Testing strategy (unit, integration, concurrency, settlement, UI)
  - Pseudocode (bidding, auto-bid, settlement, rewards)
  - V1/V2 recommendations

- **`implementation-roadmap.md`** - Step-by-step checklist
  - Phase 0-6 detailed tasks with testing instructions
  - Success criteria per phase
  - Common issues and solutions
  - Post-launch monitoring recommendations
  - V2 roadmap

### Database
- **`prisma-schema-additions.prisma`** - Copy these models to `apps/api/prisma/schema.prisma`
  - `AuctionInstance`
  - `AuctionItem`
  - `AuctionBid`
  - `AuctionPendingReward`
  - `AuctionParticipation`

### Starter Code (`starter-code/`)
Ready-to-use TypeScript services and routes:
- **`services/bid.service.ts`** - Bidding logic (manual + auto-bid, rate limiting, refunds)
- **`services/instance.service.ts`** - Auction management and player queries
- **`services/item-generator.service.ts`** - Mock item generation for V1
- **`routes.ts`** - Complete API endpoints with auth
- **`README.md`** - Quick start guide for starter code

## 🚀 Quick Start (5 Steps)

### 1. Read the Design
Start with `AUCTION_HOUSE_DESIGN.md` sections 1-2 to understand the system.

### 2. Add Database Tables
```bash
# Copy models from prisma-schema-additions.prisma to apps/api/prisma/schema.prisma
# Then run:
npx prisma migrate dev --name add_auction_tables
npx prisma generate
```

### 3. Copy Starter Code
```bash
mkdir -p apps/api/src/modules/auction/services
cp apps/auction/starter-code/services/*.ts apps/api/src/modules/auction/services/
cp apps/auction/starter-code/routes.ts apps/api/src/modules/auction/routes.ts
```

### 4. Register Routes
In `apps/api/src/index.ts`:
```typescript
import { auctionRoutes } from "./modules/auction/routes.js";
await fastify.register(auctionRoutes);
```

### 5. Test
```bash
# Start API
npm --workspace @ebonkeep/api run dev

# Create test auctions
curl -X POST http://localhost:4000/v1/auction/test/create-auctions

# Query active auctions
curl http://localhost:4000/v1/auction/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📝 Implementation Timeline

**Week 1:** Backend foundation (DB + item generation + API endpoints)  
**Week 2:** Core bidding (place bid, refunds, rate limiting)  
**Week 3:** Auto-bid + settlement (auto-bid logic, end auctions, deliver items)  
**Week 4:** Frontend UI (React components, modals, timers)  
**Week 5:** Polish + launch (extensions, telemetry, performance testing)

**Total: 5 weeks to production-ready V1**

## ✅ V1 Features

- ✅ 3 concurrent auctions per level bracket (staggered by 8 hours)
- ✅ 6 items per auction (2 common, 2 uncommon, 1 rare, 1 epic)
- ✅ Anonymous bidding (no player names shown)
- ✅ Auto-bid up to max threshold
- ✅ Anti-snipe extension (2-minute bids extend auction)
- ✅ Automatic settlement (end auction, deliver items, refund losers)
- ✅ Pending rewards (if inventory full, 7-day claim window)
- ✅ Level-bracketed auctions ([1-10], [11-20], ..., [91-100])
- ✅ Rate limiting (10 bids per minute per player)

## ❌ Deferred to V2

- Player-submitted items (V1 is system-generated only)
- Real-time WebSocket updates (V1 uses 10-second polling)
- Auction house tax (V1 has 0% tax)
- Advanced filters and search
- Shill bid detection
- Cross-server auctions

## 📚 Key Design Decisions

### Auction Configuration (V1)
- **Duration:** 16 hours (increased from 12 for better global coverage)
- **Schedule:** 00:00, 08:00, 16:00 UTC (3 auctions, one ends every 8 hours)
- **Level brackets:** 10-level ranges to prevent high-level dominance
- **Instance size:** 100 players per bracket (increased from 50 for better liquidity)
- **Bid increment:** MAX(10 ducats, 5% of current bid)

### Anonymous Bidding
- ✅ Reduces social pressure and toxicity
- ✅ Prevents collusion (can't see who you're bidding against)
- ✅ Focuses on item value, not player identity
- Bid history shows amounts only (no player names)

### Auto-Bid System
- Player sets max auto-bid when placing bid
- System auto-bids up to max when outbid
- Max is hidden from competitors
- Uses Redis locks to prevent concurrency bugs
- Auto-bid conflicts resolve in timestamp order

### Settlement Safety
- Idempotent (multiple runs won't duplicate deliveries)
- Transaction-safe (all-or-nothing)
- Handles inventory full (creates pending reward)
- Pending rewards expire after 7 days → 80% ducat refund

## 🧪 Testing Priority

### Must Test Before Launch
1. **Concurrent bidding** - 100 players bidding simultaneously
2. **Auto-bid conflicts** - Two players with high max bids
3. **Settlement idempotency** - Run settlement twice, verify no duplication
4. **Inventory full** - Winner with full inventory gets pending reward
5. **Rate limiting** - Spam bids, verify 429 after 10/minute
6. **Refund correctness** - All losers get ducats back

### Integration Test Scenario
```
1. Create auction ending in 5 minutes
2. Player A bids 1000 with max 3000
3. Player B bids 1500 with max 2500
4. Verify auto-bid escalates until B's max reached
5. Verify A wins at 2625 ducats
6. Wait for auction end
7. Verify A receives item
8. Verify B refunded 2500 ducats
```

## 🛠️ What You Need to Build (Not in Starter Code)

### Settlement Service
```typescript
// apps/api/src/modules/auction/services/settlement.service.ts
class AuctionSettlementService {
  async settleAuction(auctionId: string): Promise<void>;
  async settleItem(item: AuctionItem): Promise<void>;
  async deliverItemToWinner(winnerId: string, itemCode: string): Promise<void>;
  async processExpiredRewards(): Promise<void>;
}
```

### Cron Jobs
```typescript
// apps/api/src/modules/auction/jobs/auction-creator.job.ts
cron.schedule("0 0,8,16 * * *", async () => {
  await instanceService.createAuctionInstances();
});

// apps/api/src/modules/auction/jobs/auction-settler.job.ts
cron.schedule("* * * * *", async () => {
  await settlementService.checkAndSettleAuctions();
});

// apps/api/src/modules/auction/jobs/expired-rewards.job.ts
cron.schedule("0 * * * *", async () => {
  await settlementService.processExpiredRewards();
});
```

### Frontend Components
```
apps/web/src/pages/AuctionHouseScreen.tsx
apps/web/src/components/auction/
  ├── AuctionTabBar.tsx
  ├── AuctionItemGrid.tsx
  ├── AuctionItemCard.tsx
  ├── BiddingModal.tsx
  ├── AuctionTimer.tsx
  └── PendingRewardsPanel.tsx
```

See `implementation-roadmap.md` Phase 5 for detailed UI specs.

## 🎯 Success Metrics (Monitor Post-Launch)

- **Participation rate:** % of active players who bid at least once per week
- **Average bids per auction:** Should be 10-20 bids per item
- **Settlement success rate:** Target 99.9% (no failed settlements)
- **Pending rewards expiring:** Target <5% (means inventory management is good)
- **Ducat sink ratio:** 20-30% of daily ducats should flow through auctions
- **Auto-bid usage:** Target 60%+ of bids use auto-bid feature

## 📞 Support

If you run into issues during implementation:
1. Check `starter-code/README.md` "Common Issues" section
2. Review pseudocode in `AUCTION_HOUSE_DESIGN.md` Section 8
3. Verify database schema matches `prisma-schema-additions.prisma`
4. Check Redis is running for auto-bid locks
5. Review transaction isolation level (should be `Serializable`)

## 📖 Recommended Reading Order

1. **`AUCTION_HOUSE_DESIGN.md`** (Sections 1-2) - Understand V1 decisions
2. **`prisma-schema-additions.prisma`** - Review DB schema
3. **`starter-code/README.md`** - Quick start guide
4. **`implementation-roadmap.md`** (Phase 1) - Start building
5. **`AUCTION_HOUSE_DESIGN.md`** (Sections 3-4) - Deep dive on architecture
6. **`AUCTION_HOUSE_DESIGN.md`** (Section 8) - Reference pseudocode as needed

## 🎉 Ready to Build?

Start with Phase 1 from `implementation-roadmap.md`:
1. Add Prisma schema
2. Run migration
3. Copy starter services
4. Register routes
5. Test with curl

**Estimated time to V1 launch: 5 weeks**

Good luck! 🚀
