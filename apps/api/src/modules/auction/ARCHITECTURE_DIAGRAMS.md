# Auction House Architecture Diagrams

Visual reference for system architecture, data flow, and component relationships.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Auction     │  │  Bidding     │  │  Pending     │             │
│  │  House       │  │  Modal       │  │  Rewards     │             │
│  │  Screen      │  │              │  │  Panel       │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│         │                 │                  │                      │
│         └─────────────────┴──────────────────┘                      │
│                           │                                         │
│                    Polling (10s)                                    │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                      REST API
                            │
┌───────────────────────────┼─────────────────────────────────────────┐
│                    BACKEND (Fastify)                                │
│                           │                                         │
│  ┌────────────────────────┴────────────────────────┐               │
│  │         API Routes (routes.ts)                  │               │
│  │  • GET  /v1/auction/active                      │               │
│  │  • GET  /v1/auction/:id                         │               │
│  │  • POST /v1/auction/bid                         │               │
│  │  • GET  /v1/auction/rewards/pending             │               │
│  │  • POST /v1/auction/rewards/claim               │               │
│  └─────────────────────┬───────────────────────────┘               │
│                        │                                            │
│    ┌───────────────────┼────────────────────┐                      │
│    │                   │                    │                      │
│  ┌─▼───────────┐  ┌────▼────────┐  ┌───────▼──────┐               │
│  │  Instance   │  │    Bid      │  │  Settlement  │               │
│  │  Service    │  │  Service    │  │   Service    │               │
│  │             │  │             │  │              │               │
│  │ • create    │  │ • placeBid  │  │ • settle     │               │
│  │ • getActive │  │ • autoBid   │  │ • deliver    │               │
│  │ • getDetail │  │ • refund    │  │ • expire     │               │
│  └─────────────┘  └─────────────┘  └──────────────┘               │
│         │                 │                  │                      │
│         └─────────────────┴──────────────────┘                      │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
           ┌────────────────┴────────────────┐
           │                                 │
    ┌──────▼──────┐                  ┌──────▼──────┐
    │  PostgreSQL │                  │    Redis    │
    │             │                  │             │
    │ • auction_  │                  │ • rate      │
    │   instances │                  │   limits    │
    │ • auction_  │                  │ • auto-bid  │
    │   items     │                  │   locks     │
    │ • auction_  │                  │             │
    │   bids      │                  │             │
    │ • pending_  │                  │             │
    │   rewards   │                  │             │
    └─────────────┘                  └─────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       CRON JOBS (Background)                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Auction     │  │  Auction     │  │  Expired     │             │
│  │  Creator     │  │  Settler     │  │  Rewards     │             │
│  │              │  │              │  │              │             │
│  │ 00:00,08:00  │  │ Every 1 min  │  │ Every 1 hour │             │
│  │ 16:00 UTC    │  │              │  │              │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## Bidding Flow

```
┌─────────────┐
│   Player A  │
│ Bids 1000   │
│ Max: 2000   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  1. Check currency (10,000 ducats available)   │
│  2. Verify bid > currentBid (0)                 │
│  3. Deduct 1000 ducats (reserve)                │
│  4. Create bid record (active)                  │
│  5. Update item: currentBid=1000, winner=A      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │  Item State:   │
          │  Bid: 1000     │
          │  Winner: A     │
          └────────────────┘
                   │
       ┌───────────┴───────────┐
       │   Player B Bids 1500  │
       │   Max: 1500           │
       └───────────┬───────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  1. Check currency (10,000 ducats available)    │
│  2. Verify bid > currentBid (1000)               │
│     → 1500 > 1000 ✓                              │
│  3. Deduct 1500 ducats (reserve)                 │
│  4. Create bid record (active)                   │
│  5. Update item: currentBid=1500, winner=B       │
│  6. Refund previous winner (A):                  │
│     → Mark A's bid as "outbid"                   │
│     → Add 1000 ducats to A's balance             │
│  7. Trigger auto-bid for A                       │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │  Item State:   │
          │  Bid: 1500     │
          │  Winner: B     │
          └────────────────┘
                   │
       ┌───────────┴───────────┐
       │   Auto-Bid Triggered  │
       │   (A's max: 2000)     │
       └───────────┬───────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  1. Acquire Redis lock (prevent concurrency)     │
│  2. Check A's previous bid maxAutoBid (2000)     │
│  3. Calculate auto-bid:                          │
│     → minIncrement = max(10, 1500*0.05) = 75     │
│     → autoBid = min(1500+75, 2000) = 1575        │
│  4. Check A's balance (10,000 - refunded)        │
│  5. Place bid for A (1575, max 2000)             │
│  6. Release Redis lock                           │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │  Final State:  │
          │  Bid: 1575     │
          │  Winner: A     │
          │  (auto-bid)    │
          └────────────────┘
```

## Auto-Bid Conflict Resolution

```
Player A: Bid 1000, Max 3000
Player B: Bid 1500, Max 2500

┌────────────────────────────────────────────┐
│  Round 1: B bids 1500 (manual)            │
│  → A auto-bids to 1575 (1500 + 75)        │
│  Winner: A at 1575                         │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Round 2: B auto-bids to 1654 (1575 + 79) │
│  → A auto-bids to 1737 (1654 + 83)        │
│  Winner: A at 1737                         │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Round 3: B auto-bids to 1824 (1737 + 87) │
│  → A auto-bids to 1915 (1824 + 91)        │
│  Winner: A at 1915                         │
└────────────┬───────────────────────────────┘
             │
            ...
             │
             ▼
┌────────────────────────────────────────────┐
│  Round N: B auto-bids to 2500 (MAX)       │
│  → A auto-bids to 2625 (2500 + 125)       │
│  → B cannot auto-bid (max exceeded)        │
│  Winner: A at 2625 (FINAL)                 │
└────────────────────────────────────────────┘
```

## Settlement Flow

```
                    ┌──────────────────┐
                    │ Auction End Time │
                    │    Reached       │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Cron Job Runs   │
                    │  (every 1 min)   │
                    └────────┬─────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │   Find auctions with endTime <= now     │
        │   AND status = 'active'                 │
        └────────────────────┬────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ Set status to    │
                    │  'settling'      │
                    │  (atomic)        │
                    └────────┬─────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │  Load all 6 items in auction            │
        └────────────────────┬────────────────────┘
                             │
                 ┌───────────┴───────────┐
                 │  For each item:       │
                 └───────────┬───────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │  If no bids: skip (item unsold)         │
        │  Else: process winner                   │
        └────────────────────┬────────────────────┘
                             │
                 ┌───────────▼───────────┐
                 │  Mark winning bid     │
                 │  as 'won'             │
                 └───────────┬───────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │  Check winner's inventory space         │
        └────────────────────┬────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐          ┌─────────▼────────┐
     │  Has Space      │          │  Inventory Full  │
     └────────┬────────┘          └─────────┬────────┘
              │                             │
  ┌───────────▼───────────┐     ┌───────────▼───────────┐
  │ Deliver item directly │     │ Create pending reward │
  │ to inventory          │     │ (7-day expiry)        │
  └───────────────────────┘     └───────────────────────┘
              │                             │
              └─────────────┬───────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │  Mark all outbid bids as 'lost'       │
        │  (already refunded during bidding)    │
        └───────────────────┬───────────────────┘
                            │
                ┌───────────▼───────────┐
                │ Log telemetry event   │
                │ 'auction.item.won'    │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │  Repeat for next item │
                └───────────────────────┘
```

## Database Schema Relationships

```
┌─────────────────────┐
│  AuctionInstance    │
│                     │
│  id                 │◄───┐
│  levelBracketMin    │    │
│  levelBracketMax    │    │
│  startTime          │    │
│  endTime            │    │ 1:N
│  status             │    │
└─────────────────────┘    │
                           │
                           │
┌─────────────────────┐    │
│  AuctionItem        │    │
│                     │    │
│  id                 │    │
│  auctionInstanceId  │────┘
│  itemCode           │
│  itemLevel          │
│  currentBid         │
│  currentWinnerId    │────┐
│  bidCount           │    │
│  extensionsUsed     │    │
└──────────┬──────────┘    │
           │               │
           │ 1:N           │
           │               │
┌──────────▼──────────┐    │
│  AuctionBid         │    │
│                     │    │
│  id                 │    │
│  itemId             │────┘
│  playerId           │────┐
│  bidAmount          │    │
│  maxAutoBid         │    │
│  isAutoBid          │    │
│  status             │    │
└─────────────────────┘    │
                           │
                           │
┌─────────────────────┐    │
│  PlayerProfile      │    │
│                     │    │
│  id                 │◄───┘
│  level              │
│  class              │
└──────────┬──────────┘
           │
           │ 1:1
           │
┌──────────▼──────────┐
│  CurrencyBalance    │
│                     │
│  playerId           │
│  ducats             │
│  imperials          │
└─────────────────────┘

┌────────────────────────┐
│  AuctionPendingReward  │
│                        │
│  id                    │
│  playerId              │────┐
│  itemId                │    │
│  itemCode              │    │
│  winningBid            │    │
│  expiresAt             │    │
│  claimed               │    │
└────────────────────────┘    │
                              │
            ┌─────────────────┘
            │
            ▼
┌─────────────────────┐
│  PlayerProfile      │
└─────────────────────┘
```

## UI Component Tree

```
<AuctionHouseScreen>
│
├─ <Header>
│  └─ "AUCTION HOUSE" title + close button
│
├─ <AuctionTabBar>
│  ├─ <AuctionTab> Auction 1 (Ends in: 12h 30m)
│  ├─ <AuctionTab> Auction 2 (Ends in: 4h 15m) [ACTIVE]
│  ├─ <AuctionTab> Auction 3 (Ends in: 8h 45m)
│  └─ <MyActivitySummary> (Bids: 4, Won: 1, Pending: 1)
│
├─ <AuctionItemGrid>
│  ├─ <AuctionItemCard state="idle">
│  │  ├─ <ItemIcon />
│  │  ├─ <RarityBadge rarity="epic" />
│  │  ├─ <BidInfo currentBid={1250} bidCount={5} />
│  │  └─ <ItemTooltip /> (on hover)
│  │
│  ├─ <AuctionItemCard state="winning">
│  │  ├─ <ItemIcon />
│  │  ├─ <WinningBadge /> (gold crown)
│  │  ├─ <BidInfo myBid={2000} bidCount={3} />
│  │  └─ <ItemTooltip />
│  │
│  ├─ <AuctionItemCard state="outbid">
│  │  ├─ <ItemIcon />
│  │  ├─ <OutbidWarning /> (red pulsing)
│  │  ├─ <BidInfo myBid={1500} currentBid={1600} bidCount={12} />
│  │  └─ <ItemTooltip />
│  │
│  ├─ <AuctionItemCard state="idle" /> (x3 more items)
│  └─ ...
│
├─ {showBiddingModal && (
│    <BiddingModal>
│      ├─ <ItemPreview>
│      │  ├─ <ItemIcon large />
│      │  ├─ <ItemStats />
│      │  └─ <ItemAffixes />
│      │
│      ├─ <BidForm>
│      │  ├─ <CurrentBidDisplay currentBid={1250} />
│      │  ├─ <MinBidDisplay minBid={1313} />
│      │  ├─ <BidInput />
│      │  ├─ <AutoBidInput /> (optional max)
│      │  └─ <SubmitButton>Place Bid</SubmitButton>
│      │
│      └─ <CloseButton />
│    </BiddingModal>
│  )}
│
└─ <PendingRewardsPanel>
   ├─ <PendingRewardCard>
   │  ├─ <ItemIcon />
   │  ├─ <ItemName />
   │  ├─ <ExpiryTimer expiresIn="6d 12h" />
   │  └─ <ClaimButton>Claim</ClaimButton>
   │
   └─ <PendingRewardCard> (more if multiple)
```

## Timeline Example: 3 Staggered Auctions

```
                        24-Hour Period
├───────────────────────────────────────────────────┤

Auction 1:  [════════════════16h════════════════]
            00:00 UTC                        16:00 UTC

Auction 2:          [════════════════16h════════════════]
                    08:00 UTC                        00:00 UTC

Auction 3:                  [════════════════16h════════════════]
                            16:00 UTC                        08:00 UTC

Player sees:
- At 00:00: Auction 1 starts, Auction 3 has 8h left, Auction 2 has 16h left
- At 08:00: Auction 2 starts, Auction 1 has 8h left, Auction 3 has 16h left
- At 16:00: Auction 3 starts, Auction 2 has 8h left, Auction 1 has 16h left

→ Always 3 auctions active, one ending every 8 hours
```

## Player Journey Map

```
            ┌─────────────┐
            │  Player     │
            │  Opens      │
            │  Auction    │
            │  House      │
            └──────┬──────┘
                   │
                   ▼
         ┌─────────────────┐
         │ See 3 auction   │
         │ tabs, pick one  │
         └────────┬────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Browse 6 items │
         │ in grid        │
         └────────┬───────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌──────────┐              ┌──────────┐
│  Hover   │              │  Click   │
│  Item    │              │  Item    │
└────┬─────┘              └────┬─────┘
     │                         │
     ▼                         ▼
┌──────────┐              ┌──────────┐
│  See     │              │  Open    │
│  Tooltip │              │  Bidding │
│  with    │              │  Modal   │
│  Stats   │              └────┬─────┘
└──────────┘                   │
                               ▼
                      ┌────────────────┐
                      │ Enter bid amt  │
                      │ + auto-bid max │
                      │ (optional)     │
                      └────────┬───────┘
                               │
                               ▼
                      ┌────────────────┐
                      │  Place Bid     │
                      └────────┬───────┘
                               │
    ┌──────────────────────────┴──────────────────────────┐
    │                                                      │
    ▼                                                      ▼
┌─────────────┐                                    ┌─────────────┐
│  Success:   │                                    │  Error:     │
│  Item shows │                                    │  Show error │
│  "Winning"  │                                    │  message    │
│  badge      │                                    └─────────────┘
└──────┬──────┘
       │
       ▼
┌──────────────┐
│  Wait for    │
│  auction end │
│  (polling    │
│  updates)    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Outbid?     │
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
┌────┐   ┌────┐
│ Yes│   │ No │
└─┬──┘   └─┬──┘
  │        │
  ▼        ▼
┌──────┐ ┌──────┐
│Auto- │ │Keep  │
│bid   │ │win-  │
│trig- │ │ning  │
│gers  │ │      │
└──┬───┘ └───┬──┘
   │         │
   └────┬────┘
        │
        ▼
┌───────────────┐
│ Auction Ends  │
└───────┬───────┘
        │
  ┌─────┴─────┐
  │           │
  ▼           ▼
┌────┐      ┌────┐
│Won │      │Lost│
└─┬──┘      └─┬──┘
  │           │
  ▼           ▼
┌─────┐    ┌─────┐
│Item │    │Duca-│
│deli-│    │ts   │
│vered│    │refun│
│     │    │ded  │
└─────┘    └─────┘
```

---

**Use these diagrams as reference during implementation and debugging!**
