# Auction House Quick Reference

Quick lookup for formulas, rules, and constants used throughout the auction system.

## Key Constants

```typescript
// Auction configuration
const AUCTION_DURATION_HOURS = 16;
const AUCTIONS_PER_BRACKET = 3;
const ITEMS_PER_AUCTION = 6;
const AUCTION_START_TIMES_UTC = [0, 8, 16]; // 00:00, 08:00, 16:00

// Level brackets (10 brackets total)
const LEVEL_BRACKETS = [
  [1, 10], [11, 20], [21, 30], [31, 40], [41, 50],
  [51, 60], [61, 70], [71, 80], [81, 90], [91, 100]
];

// Item distribution per auction
const ITEM_RARITY_DISTRIBUTION = {
  common: 2,
  uncommon: 2,
  rare: 1,
  epic: 1
};

// Extension mechanic
const EXTENSION_TRIGGER_MINUTES = 2; // Bid in final 2 minutes triggers extension
const EXTENSION_DURATION_MINUTES = 2; // Extends by 2 minutes
const MAX_EXTENSIONS_PER_ITEM = 5; // Max 10 minutes total extension

// Rate limiting
const MAX_BIDS_PER_MINUTE = 10;

// Pending rewards
const PENDING_REWARD_EXPIRY_DAYS = 7;
const EXPIRED_REWARD_REFUND_PERCENTAGE = 0.8; // 80% refund
```

## Formulas

### Starting Bid Calculation
```typescript
function calculateStartingBid(itemLevel: number, rarity: string): number {
  const baseValue = itemLevel * 10; // 1 ducat per level
  
  const rarityMultiplier = {
    common: 1,
    uncommon: 3,
    rare: 10,
    epic: 30
  };
  
  return Math.floor(baseValue * rarityMultiplier[rarity] * 0.6);
}

// Examples:
// Level 10 common: 10 * 10 * 1 * 0.6 = 60 ducats
// Level 10 rare: 10 * 10 * 10 * 0.6 = 600 ducats
// Level 50 epic: 50 * 10 * 30 * 0.6 = 9,000 ducats
```

### Minimum Bid Increment
```typescript
function calculateMinBid(currentBid: number): number {
  if (currentBid === 0) {
    return 1; // First bid can be starting bid
  }
  
  const fivePercent = Math.ceil(currentBid * 0.05);
  return currentBid + Math.max(10, fivePercent);
}

// Examples:
// Current bid 100: 100 + max(10, 5) = 110 (10 ducat floor)
// Current bid 1000: 1000 + max(10, 50) = 1050 (5%)
// Current bid 10000: 10000 + max(10, 500) = 10500 (5%)
```

### Auto-Bid Amount Calculation
```typescript
function calculateAutoBidAmount(
  competitorBid: number,
  myMaxAutoBid: number
): number {
  const minIncrement = Math.max(10, Math.ceil(competitorBid * 0.05));
  const myAutoBid = competitorBid + minIncrement;
  
  return Math.min(myAutoBid, myMaxAutoBid);
}

// Example:
// Competitor bids 1000, my max is 2000
// minIncrement = max(10, 50) = 50
// myAutoBid = 1000 + 50 = 1050
// Result: 1050 (within max)

// Example 2:
// Competitor bids 1900, my max is 2000
// minIncrement = max(10, 95) = 95
// myAutoBid = 1900 + 95 = 1995
// Result: 1995 (within max)

// Example 3:
// Competitor bids 2500, my max is 2000
// myAutoBid = 2500 + 125 = 2625
// Result: 2000 (capped at max)
```

## Bidding Rules Quick Reference

| Rule | Value | Enforcement |
|------|-------|-------------|
| Min bid increment | MAX(10, 5% of current) | Enforced at API |
| Max bids per minute | 10 | Redis counter |
| Max concurrent bids | Unlimited | No limit |
| Bid cancellation | Not allowed | N/A |
| Auto-bid visibility | Hidden from others | UI + API |
| Player name visibility | Anonymous | API filters playerIds |
| Bid amounts visible | Yes (last 5) | API returns history |
| Inventory full handling | Pending reward | Settlement checks space |
| Offline winner | Item delivered on login | Settlement doesn't require online |

## State Machine

### Auction Instance States
```
pending → active → settling → settled
```

- **pending**: Created but not started yet (unused in V1)
- **active**: Currently accepting bids
- **settling**: End time reached, processing winners/losers
- **settled**: Fully processed, items delivered, refunds complete

### Auction Bid States
```
active → outbid → refunded (losing path)
active → won (winning path)
```

- **active**: Current highest bid
- **outbid**: Was highest, now outbid by someone else
- **won**: Auction ended, this bid won
- **refunded**: Losing bid, ducats returned (legacy state, may not be used if refunds are immediate)

### Item States (UI)
```
idle → winning → outbid → won/lost
```

- **idle**: Not bidding on this item
- **winning**: You are current highest bidder
- **outbid**: You were highest, now outbid
- **won**: Auction ended, you won
- **lost**: Auction ended, you lost

## API Endpoints Cheat Sheet

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/v1/auction/active` | ✅ | List active auctions for player's bracket |
| GET | `/v1/auction/:id` | ✅ | Auction details with player's bid status |
| POST | `/v1/auction/bid` | ✅ | Place a bid (manual or with auto-bid max) |
| GET | `/v1/auction/item/:id/bids` | ✅ | Bid history (last 5, anonymous) |
| GET | `/v1/auction/my-activity` | ✅ | Player's auction summary |
| GET | `/v1/auction/my-bids` | ✅ | All active bids by player |
| GET | `/v1/auction/rewards/pending` | ✅ | Unclaimed auction items |
| POST | `/v1/auction/rewards/claim` | ✅ | Claim a pending reward |

## Database Queries Cheat Sheet

### Get active auctions for player
```sql
SELECT * FROM auction_instances
WHERE level_bracket_min <= :player_level
  AND level_bracket_max >= :player_level
  AND status = 'active'
ORDER BY start_time ASC
LIMIT 3;
```

### Check if player is winning an item
```sql
SELECT current_winner_id = :player_id AS am_i_winning
FROM auction_items
WHERE id = :item_id;
```

### Get player's reserved ducats (from active bids)
```sql
SELECT SUM(bid_amount) AS reserved_ducats
FROM auction_bids
WHERE player_id = :player_id
  AND status = 'active';
```

### Find auctions needing settlement
```sql
SELECT * FROM auction_instances
WHERE end_time <= NOW()
  AND status = 'active';
```

### Get expired pending rewards
```sql
SELECT * FROM auction_pending_rewards
WHERE expires_at < NOW()
  AND claimed = false;
```

## Redis Keys

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `bid:rate:{playerId}` | 60s | Rate limit counter (10 bids/min) |
| `auction:item:{itemId}:auto-bid-lock` | 10s | Auto-bid processing lock |

## Cron Schedule

| Job | Schedule | Purpose |
|-----|----------|---------|
| Auction Creator | `0 0,8,16 * * *` | Create new auctions at 00:00, 08:00, 16:00 UTC |
| Auction Settler | `* * * * *` | Check every minute for ended auctions |
| Expired Rewards | `0 * * * *` | Process unclaimed rewards hourly |

## Common Edge Cases

### Race Condition: Two players bid simultaneously
**Solution:** Transaction isolation level `Serializable` ensures one bid commits first, other sees updated current bid and must bid higher.

### Player outbids themselves
**Solution:** Check `currentWinnerId !== playerId` before refunding previous bid.

### Auto-bid infinite loop
**Solution:** Redis lock with 10-second TTL prevents concurrent auto-bid processing.

### Settlement runs twice
**Solution:** Atomically update status from `active` to `settling`. If update count is 0, another process already settling.

### Inventory full on claim
**Solution:** Check inventory space in transaction. If full, reject claim with error message.

### Player deletes account while winning
**V1 behavior:** Item delivered to deleted account (lost).  
**V2 improvement:** Detect deleted accounts, refund to next highest bidder.

## Test Data Examples

### Create test player with ducats
```sql
INSERT INTO currency_balances (player_id, ducats, imperials)
VALUES ('test_player_1', 100000, 0);
```

### Create test auction ending soon
```sql
INSERT INTO auction_instances (
  id, level_bracket_min, level_bracket_max,
  start_time, end_time, status
) VALUES (
  'test_auction_1', 1, 10,
  NOW(), NOW() + INTERVAL '5 minutes', 'active'
);
```

### Verify bid refund
```sql
-- Before bid: 10000 ducats
-- Player A bids 1000
-- After bid: 9000 ducats
-- Player B outbids with 1500
-- After outbid: 10000 ducats (refunded)

SELECT ducats FROM currency_balances WHERE player_id = 'player_a';
-- Expected: 10000
```

## Performance Benchmarks (Target)

| Metric | Target | Notes |
|--------|--------|-------|
| Place bid latency (p95) | <200ms | With auto-bid trigger |
| Settlement time per auction | <5s | All 6 items processed |
| Concurrent bidders | 100+ | No deadlocks or failures |
| Auto-bid resolution time | <1s | Two-player conflict |
| API response time (p50) | <50ms | GET endpoints |

## Monitoring Alerts

Set up alerts for:
- ❗ Settlement failures (any auction stuck in `settling` for >5 minutes)
- ❗ High rate limit rejections (>10% of bid requests)
- ❗ Redis connection failures
- ❗ Database transaction timeouts
- ❗ Pending rewards expiring (>10% expiry rate suggests UX issue)
- ❗ Auto-bid lock timeouts (indicates concurrency bug)

## Quick Debugging Tips

### Bid rejected: "Insufficient ducats"
1. Check player's currency balance
2. Check active bids (reserved ducats)
3. Sum: `available = balance - SUM(active_bids)`

### Auto-bid not triggering
1. Check Redis lock: `redis-cli GET auction:item:{itemId}:auto-bid-lock`
2. Check previous bid's `maxAutoBid` value
3. Check player's currency balance
4. Check logs for auto-bid errors

### Settlement not running
1. Verify cron job scheduled correctly
2. Check server timezone (should use UTC)
3. Check database for auctions with `status = 'settling'` (stuck?)
4. Check logs for settlement errors

### Frontend shows outdated bid status
1. Check polling interval (should be 10 seconds)
2. Verify API returns correct `currentWinnerId`
3. Check WebSocket connection (if implemented)

---

**Print this page for quick reference during development!**
