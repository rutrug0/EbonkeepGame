# Auction System Migration Guide

This guide walks you through migrating the auction system into your main API.

## Step 1: Copy Files

### 1.1 Copy Configuration File
```powershell
# Copy auction_config.ini to your API root
Copy-Item "apps/auction/auction_config.ini" "apps/api/auction_config.ini"
```

### 1.2 Copy Service Files
```powershell
# Create auction module directory
New-Item -Path "apps/api/src/modules/auction" -ItemType Directory -Force
New-Item -Path "apps/api/src/modules/auction/services" -ItemType Directory -Force

# Copy all service files
Copy-Item "apps/auction/starter-code/services/*.ts" "apps/api/src/modules/auction/services/"

# Copy routes and background jobs
Copy-Item "apps/auction/starter-code/routes.ts" "apps/api/src/modules/auction/"
Copy-Item "apps/auction/starter-code/background-jobs.ts" "apps/api/src/modules/auction/"
Copy-Item "apps/auction/starter-code/index.ts" "apps/api/src/modules/auction/"
```

## Step 2: Update Database Schema

### 2.1 Copy Prisma Schema Additions

Open `apps/api/prisma/schema.prisma` and add the following models from `apps/auction/prisma-schema-additions.prisma`:

```prisma
model AuctionInstance {
  id               String         @id @default(cuid())
  levelBracketMin  Int
  levelBracketMax  Int
  startTime        DateTime
  endTime          DateTime
  status           String         // "active", "completed"
  createdAt        DateTime       @default(now())
  
  items            AuctionItem[]
  
  @@index([status, endTime])
  @@index([levelBracketMin, levelBracketMax, status])
}

model AuctionItem {
  id                  String          @id @default(cuid())
  auctionInstanceId   String
  itemData            Json            // Full item object
  itemLevel           Int
  itemRarity          String          // "common", "uncommon", "rare", "epic"
  itemCategory        String          // "weapon", "armor", "jewelry"
  startingBid         Int
  currentBid          Int             @default(0)
  currentWinnerId     String?
  bidCount            Int             @default(0)
  extensionsUsed      Int             @default(0)
  status              String          @default("active") // "active", "won", "unsold"
  createdAt           DateTime        @default(now())
  
  // Player submission fields
  isPlayerSubmitted   Boolean         @default(false)
  sellerId            String?
  feePercentage       Int             @default(0)
  
  auctionInstance     AuctionInstance @relation(fields: [auctionInstanceId], references: [id])
  bids                AuctionBid[]
  
  @@index([auctionInstanceId])
  @@index([currentWinnerId])
  @@index([isPlayerSubmitted])
}

model AuctionBid {
  id          String   @id @default(cuid())
  itemId      String
  playerId    String
  bidAmount   Int
  status      String   // "active", "outbid", "won", "lost"
  createdAt   DateTime @default(now())
  
  item        AuctionItem @relation(fields: [itemId], references: [id])
  
  @@index([itemId, createdAt])
  @@index([playerId, status])
}

model AuctionPendingReward {
  id          String    @id @default(cuid())
  playerId    String
  itemId      String
  itemData    Json
  winningBid  Int
  expiresAt   DateTime
  claimedAt   DateTime?
  createdAt   DateTime  @default(now())
  
  @@index([playerId, claimedAt])
  @@index([expiresAt])
}

model AuctionParticipation {
  id                String   @id @default(cuid())
  auctionInstanceId String
  playerId          String
  joinedAt          DateTime @default(now())
  
  @@unique([auctionInstanceId, playerId])
  @@index([playerId])
}

model AuctionPlayerListing {
  id                  String    @id @default(cuid())
  playerId            String
  itemData            Json
  desiredStartingBid  Int
  status              String    // "pending", "approved", "rejected", "listed", "sold", "returned"
  createdAt           DateTime  @default(now())
  
  // Approval fields
  approvedBy          String?
  approvedAt          DateTime?
  rejectedBy          String?
  rejectedAt          DateTime?
  rejectionReason     String?
  
  // Listing fields
  listedInAuctionId   String?
  listedAt            DateTime?
  
  @@index([playerId, status])
  @@index([status, approvedAt])
}
```

### 2.2 Run Migration

```powershell
cd apps/api
npx prisma migrate dev --name add_auction_system
npx prisma generate
```

## Step 3: Install Dependencies

If not already installed:

```powershell
cd apps/api
npm install node-cron
npm install --save-dev @types/node-cron
```

## Step 4: Register Routes in Fastify

In `apps/api/src/app.ts` (or your main Fastify setup file):

```typescript
import { auctionRoutes } from "./modules/auction/routes.js";

// After other plugins are registered
await app.register(auctionRoutes);
```

## Step 5: Start Background Jobs

In `apps/api/src/app.ts` (after Fastify is ready):

```typescript
import { initializeAuctionJobs } from "./modules/auction/background-jobs.js";

// After app.listen() or in the ready hook
app.addHook("onReady", async () => {
  initializeAuctionJobs(app.prisma);
});
```

## Step 6: Add Authentication Middleware (If Not Present)

The auction routes expect these decorators:

```typescript
// In apps/api/src/plugins/auth.ts or similar

import fp from "fastify-plugin";

export default fp(async (fastify) => {
  // Authenticate decorator
  fastify.decorate("authenticate", async (request, reply) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      throw new Error("No token provided");
    }
    
    // Verify JWT and populate request.user
    const decoded = verifyJWT(token); // Implement this
    
    const player = await fastify.prisma.player.findUnique({
      where: { id: decoded.playerId }
    });
    
    if (!player) {
      throw new Error("Player not found");
    }
    
    request.user = {
      playerId: player.id,
      level: player.level
    };
  });
  
  // Admin-only decorator
  fastify.decorate("requireAdmin", async (request, reply) => {
    // Assumes authenticate was already called
    const player = await fastify.prisma.player.findUnique({
      where: { id: request.user.playerId },
      select: { role: true }
    });
    
    if (!player || (player.role !== "admin" && player.role !== "moderator")) {
      throw new Error("Admin access required");
    }
  });
});
```

## Step 7: Configure Environment Variable (Optional)

If you want to override the default config path:

```env
# In .env
AUCTION_CONFIG_PATH=./auction_config.ini
```

## Step 8: Test the Integration

### 8.1 Start the API
```powershell
cd apps/api
npm run dev
```

### 8.2 Test Endpoints

**Create test auctions:**
```powershell
curl -X POST http://localhost:3000/v1/auction/test/create-auctions
```

**Get active auctions:**
```powershell
curl -X GET http://localhost:3000/v1/auction/active `
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Place a bid:**
```powershell
curl -X POST http://localhost:3000/v1/auction/bid `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"itemId\": \"ITEM_ID\", \"bidAmount\": 1000}'
```

## Step 9: Disable Test Endpoints in Production

In `auction_config.ini`:

```ini
[auction.debug]
enable_test_endpoints = 0
```

## Verification Checklist

- [ ] Config file copied to `apps/api/auction_config.ini`
- [ ] All service files copied to `apps/api/src/modules/auction/`
- [ ] Prisma schema updated with 6 auction models
- [ ] Database migrated successfully (`prisma migrate dev`)
- [ ] Routes registered in Fastify app
- [ ] Background jobs initialized on app startup
- [ ] Authentication middleware implemented
- [ ] API starts without errors
- [ ] Test endpoints respond correctly
- [ ] Auctions can be created, items can be bid on
- [ ] Settlement job runs every minute (check logs)

## Troubleshooting

### Config file not found
- Ensure `auction_config.ini` is in the root of `apps/api/`
- Or set `AUCTION_CONFIG_PATH` environment variable

### Background jobs not running
- Check console logs for "[Auction Jobs] Starting background jobs..."
- Verify `initializeAuctionJobs()` is called after Prisma is initialized

### Authentication errors
- Verify `fastify.authenticate` and `fastify.requireAdmin` decorators are registered
- Check JWT token format and validation logic

### Database errors
- Run `npx prisma generate` after schema changes
- Verify all 6 auction models are in schema.prisma
- Check Prisma client version matches schema

## Next Steps

After successful migration:
1. Integrate with your inventory system (see INTEGRATION_CHECKLIST.md)
2. Create admin UI for approving player submissions
3. Add "Sell at Auction" button in inventory UI
4. Tune economy values in `auction_config.ini`
5. Set up proper cron scheduling (replace setInterval with node-cron or OS cron)
6. Add monitoring/alerting for background jobs
7. Implement analytics/telemetry for auction activity

## Support

Refer to:
- [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) - Feature overview and API docs
- [INTEGRATION_CHECKLIST.md](../INTEGRATION_CHECKLIST.md) - Integration points with game systems
- [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) - Formulas and configuration reference
