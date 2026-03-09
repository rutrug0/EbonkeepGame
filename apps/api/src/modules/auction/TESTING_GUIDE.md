# Auction System Testing Guide

Quick guide to test the auction system locally without needing full game integration.

## Prerequisites

1. Database migrated with auction tables
2. Auction config file in place (`apps/api/auction_config.ini`)
3. API server running with auction routes registered
4. Test endpoints enabled (`enable_test_endpoints = 1` in config)

## Quick Start Testing

### Option 1: Manual API Testing

#### 1. Create Test Auctions
```bash
curl -X POST http://localhost:3000/v1/auction/test/create-auctions
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Auctions created"
}
```

This creates 10 auction instances (one per level bracket) with 6 items each.

#### 2. View Active Auctions
```bash
curl -X GET http://localhost:3000/v1/auction/active \
  -H "Authorization: Bearer YOUR_PLAYER_TOKEN"
```

**Expected Response:**
```json
{
  "auctions": [
    {
      "id": "auction_id",
      "levelBracketMin": 1,
      "levelBracketMax": 10,
      "startTime": "2026-03-09T12:00:00Z",
      "endTime": "2026-03-10T00:00:00Z",
      "status": "active",
      "items": [...]
    }
  ]
}
```

#### 3. Place a Bid
```bash
curl -X POST http://localhost:3000/v1/auction/bid \
  -H "Authorization: Bearer YOUR_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "ITEM_ID_FROM_AUCTION",
    "bidAmount": 1000
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "bid": {
    "id": "bid_id",
    "bidAmount": 1000,
    "createdAt": "2026-03-09T12:05:00Z"
  }
}
```

#### 4. Submit Player Item
```bash
curl -X POST http://localhost:3000/v1/auction/submit \
  -H "Authorization: Bearer YOUR_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemData": {
      "name": "Epic Sword",
      "level": 50,
      "rarity": "epic",
      "stats": { "damage": 250 }
    },
    "desiredStartingBid": 5000
  }'
```

#### 5. Approve Submission (Admin)
```bash
curl -X POST http://localhost:3000/v1/auction/admin/submissions/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"listingId": "LISTING_ID"}'
```

#### 6. Trigger Settlement
```bash
curl -X POST http://localhost:3000/v1/auction/test/settle-auctions
```

**Expected Response:**
```json
{
  "success": true,
  "settledCount": 60,
  "totalFeesCollected": 2500
}
```

---

### Option 2: Automated Test Data Script

Use the test data generator to create a full test environment:

#### Setup Test Environment
```powershell
cd apps\api
npx tsx ..\auction\starter-code\test-data.ts setup
```

This creates:
- 10 test players (Level 1-100, 10k-100k ducats)
- 5 test item submissions
- Auto-approves all submissions

#### Simulate Random Bids
```powershell
npx tsx ..\auction\starter-code\test-data.ts bids 10 20
```

Creates 20 random bids from 10 test players.

#### Cleanup Test Data
```powershell
npx tsx ..\auction\starter-code\test-data.ts cleanup
```

Removes all auction data and test players.

---

## Testing Scenarios

### Scenario 1: Basic Bidding Flow
1. Create auction → Place bid → Check bid history → Win item → Claim reward

**Steps:**
```bash
# 1. Create auction
curl -X POST http://localhost:3000/v1/auction/test/create-auctions

# 2. Get active auctions (copy an itemId)
curl -X GET http://localhost:3000/v1/auction/active \
  -H "Authorization: Bearer PLAYER_TOKEN"

# 3. Place bid
curl -X POST http://localhost:3000/v1/auction/bid \
  -H "Authorization: Bearer PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemId": "ITEM_ID", "bidAmount": 1000}'

# 4. View bid history
curl -X GET http://localhost:3000/v1/auction/item/ITEM_ID/bids \
  -H "Authorization: Bearer PLAYER_TOKEN"

# 5. (Wait for auction to end or force settlement)
curl -X POST http://localhost:3000/v1/auction/test/settle-auctions

# 6. View pending rewards
curl -X GET http://localhost:3000/v1/auction/rewards/pending-v2 \
  -H "Authorization: Bearer PLAYER_TOKEN"

# 7. Claim reward
curl -X POST http://localhost:3000/v1/auction/rewards/claim-v2 \
  -H "Authorization: Bearer PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rewardId": "REWARD_ID"}'
```

---

### Scenario 2: Snipe Protection
Test auction extension when bids are placed in the final minutes.

**Steps:**
1. Create auction
2. Manually adjust `endTime` in database to be 1 minute from now:
```sql
UPDATE "AuctionInstance" 
SET "endTime" = NOW() + INTERVAL '1 minute'
WHERE status = 'active'
LIMIT 1;
```
3. Place a bid (should trigger extension)
4. Check `extensionsUsed` in database:
```sql
SELECT id, bidCount, extensionsUsed 
FROM "AuctionItem" 
WHERE "auctionInstanceId" = 'AUCTION_ID';
```
5. Verify auction `endTime` extended by 2 minutes

---

### Scenario 3: Player Item Submission Flow
Test the full player submission workflow.

**Steps:**
```bash
# 1. Submit item as player
curl -X POST http://localhost:3000/v1/auction/submit \
  -H "Authorization: Bearer PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemData": {"name": "Rare Helmet", "level": 30, "rarity": "rare"},
    "desiredStartingBid": 2000
  }'
# Response: {"success": true, "listingId": "..."}

# 2. View pending submissions (admin)
curl -X GET http://localhost:3000/v1/auction/admin/submissions/pending \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Approve submission (admin)
curl -X POST http://localhost:3000/v1/auction/admin/submissions/approve \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"listingId": "LISTING_ID"}'

# 4. Create next auction (approved item will be included)
curl -X POST http://localhost:3000/v1/auction/test/create-auctions

# 5. Verify player item is in auction with isPlayerSubmitted=true
curl -X GET http://localhost:3000/v1/auction/active \
  -H "Authorization: Bearer PLAYER_TOKEN"
# Look for "isPlayerSubmitted": true in items array

# 6. Bid on player item and win
curl -X POST http://localhost:3000/v1/auction/bid \
  -H "Authorization: Bearer PLAYER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemId": "PLAYER_ITEM_ID", "bidAmount": 2500}'

# 7. Settle auction
curl -X POST http://localhost:3000/v1/auction/test/settle-auctions

# 8. Check seller received payment (bid - 5% fee)
# Expected: 2500 - (2500 * 0.05) = 2375 ducats added to seller balance
```

---

### Scenario 4: Rate Limiting
Test bid rate limiting (default: 10 bids per minute).

**Steps:**
```bash
# Place 11 bids rapidly (11th should fail)
for i in {1..11}; do
  curl -X POST http://localhost:3000/v1/auction/bid \
    -H "Authorization: Bearer PLAYER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"itemId": "ITEM_ID", "bidAmount": '$((1000 + i * 10))'}'
  echo ""
done

# Expected: First 10 succeed, 11th returns error:
# {"success": false, "error": "Rate limit exceeded: max 10 bids per minute"}
```

---

### Scenario 5: Insufficient Funds
Test bidding without enough ducats.

**Steps:**
```sql
-- Reduce player's ducats to 100
UPDATE "CurrencyBalance" 
SET ducats = 100 
WHERE "playerId" = 'PLAYER_ID';
```

```bash
# Try to bid 1000 ducats
curl -X POST http://localhost:3000/v1/auction/bid \
  -H "Authorization: Bearer PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemId": "ITEM_ID", "bidAmount": 1000}'

# Expected: {"success": false, "error": "Insufficient ducats"}
```

---

## Verification Checklist

### Core Functionality
- [ ] Auctions created successfully (10 instances, 6 items each)
- [ ] Players can view auctions in their level bracket
- [ ] Bids can be placed and increase current bid
- [ ] Previous bidder is refunded when outbid
- [ ] Min bid increment enforced (5% or 10 ducats)
- [ ] Rate limiting works (10 bids/min)
- [ ] Bid history displays correctly

### Snipe Protection
- [ ] Bids in final 2 minutes trigger extension
- [ ] Auction extended by 2 minutes
- [ ] Maximum 5 extensions per item enforced
- [ ] `extensionsUsed` counter increments correctly

### Player Submissions
- [ ] Players can submit items (status: pending)
- [ ] Admins can view pending submissions
- [ ] Admins can approve/reject submissions
- [ ] Approved items appear in next auction
- [ ] Player items marked with `isPlayerSubmitted: true`
- [ ] Seller receives payment after auction (bid - 5% fee)
- [ ] Unsold items returned to seller

### Settlement
- [ ] Settlement job runs automatically (check logs)
- [ ] Completed auctions marked as "completed"
- [ ] Winners receive pending rewards
- [ ] Sellers paid correctly (with fee deduction)
- [ ] Unsold items handled correctly

### Configuration
- [ ] Config values loaded from INI file
- [ ] Changing config values affects behavior
- [ ] All config sections present and valid

---

## Common Issues & Solutions

### Issue: "Config file not found"
**Solution:** Ensure `auction_config.ini` is in `apps/api/` or set `AUCTION_CONFIG_PATH` env var.

### Issue: "Player not found"
**Solution:** Use test data generator to create test players, or use existing player IDs from your database.

### Issue: Background jobs not running
**Solution:** Check console for "[Auction Jobs] Starting background jobs...". Verify `initializeAuctionJobs()` is called.

### Issue: No auctions visible
**Solution:** Ensure auctions were created and player level matches bracket (1-10, 11-20, etc.).

### Issue: Settlement not working
**Solution:** Manually set `endTime` to past date in database to force settlement trigger.

---

## Performance Testing

### Load Test: Concurrent Bidding
Simulate 50 players bidding simultaneously:

```javascript
// Use artillery, k6, or similar tool
// artillery.yml example:
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 50
scenarios:
  - name: "Place Bids"
    flow:
      - post:
          url: "/v1/auction/bid"
          headers:
            Authorization: "Bearer {{ $randomString() }}"
          json:
            itemId: "{{ itemId }}"
            bidAmount: "{{ $randomNumber(1000, 10000) }}"
```

### Database Performance
Check query performance on large datasets:

```sql
-- Create 1000 auction instances
-- Run settlement job
-- Measure query times
EXPLAIN ANALYZE 
SELECT * FROM "AuctionInstance" 
WHERE status = 'active' AND "endTime" <= NOW();
```

---

## Next Steps After Testing

1. **Disable test endpoints** in production (`enable_test_endpoints = 0`)
2. **Set up monitoring** for background jobs
3. **Tune config values** based on player behavior
4. **Add logging/analytics** for auction metrics
5. **Implement proper cron scheduling** (replace setInterval)
6. **Add error alerting** for settlement failures
7. **Optimize database queries** (add indexes if needed)

---

## Test Data Reference

**Test Player IDs:** `test_player_1` through `test_player_10`  
**Default Admin ID:** `admin`  
**Test Item Submissions:** Auto-generated with rarities: common, uncommon, rare, epic  
**Currency Range:** 10,000 - 100,000 ducats per test player  
**Level Range:** 1-100 (random distribution)
