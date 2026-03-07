# Cross-Platform Microtransaction Architecture

## Overview
Multi-platform game with targets: **Web Browser**, **Steam**, **iOS App Store**, **Google Play Store**

## Strategic Approach: Unified Backend + Platform-Specific Payment Adapters

### Core Architecture

```
Player Purchase Flow:
1. Player initiates purchase in-game (any platform)
2. Platform-specific adapter handles payment
3. Platform validates transaction
4. Backend receives webhook/receipt verification
5. Backend credits virtual currency/items
6. Game client receives update via WebSocket
```

## Platform-Specific Implementation

### 1. **Web Browser** (Direct Web Payments)

**Options:**
- **Stripe** (Recommended) - Best for global reach, regulatory compliance
- **PayPal** - Additional option for users without cards
- **Paddle** - Merchant of record (handles VAT/tax automatically)

**Implementation:**
```typescript
// Backend: apps/api/src/modules/payments/adapters/stripe.ts
POST /v1/payments/web/initiate
POST /v1/payments/web/webhook (Stripe webhook verification)
```

**Pros:**
- Full control over pricing
- Lowest fees (2.9% + $0.30 typically)
- Direct customer relationship

**Cons:**
- Must handle VAT/tax compliance manually (unless using Paddle)
- Need PCI compliance (mitigated by using Stripe Checkout)

---

### 2. **Steam**

**Solution: Steam Microtransactions API**

**Implementation:**
```typescript
// Backend: apps/api/src/modules/payments/adapters/steam.ts
// Uses Steamworks Web API for transaction initiation
POST /v1/payments/steam/initiate
POST /v1/payments/steam/finalize (Steam calls this after purchase)
```

**Key Points:**
- 30% revenue share to Steam
- Must use Steam Wallet
- Steam handles all payment processing
- Can use Steam Inventory Service for items (optional)
- Use Steamworks SDK in desktop client

**Setup Required:**
- Steamworks partner account
- Define in-app purchases in Steamworks backend
- Integrate Steamworks SDK in `apps/desktop`

---

### 3. **iOS App Store**

**Solution: Apple In-App Purchase (IAP)**

**Implementation:**
```typescript
// Backend: apps/api/src/modules/payments/adapters/apple.ts
POST /v1/payments/apple/verify-receipt
// Uses Apple's verifyReceipt or App Store Server API
```

**Key Points:**
- 30% revenue share to Apple (15% for < $1M annual revenue)
- MUST use Apple IAP for digital goods (no alternative)
- Cannot mention other payment methods in iOS app
- Use StoreKit 2 for modern implementation
- Server-side receipt validation required

**Types of Purchases:**
- **Consumable** - Virtual currency (gems, gold)
- **Non-consumable** - Permanent unlocks (stash tabs)
- **Auto-renewable subscriptions** - Battle passes, VIP

**Setup Required:**
- Apple Developer Program ($99/year)
- Configure products in App Store Connect
- Implement StoreKit in iOS build (if separate from web)
- Server receipt verification

---

### 4. **Google Play Store**

**Solution: Google Play Billing**

**Implementation:**
```typescript
// Backend: apps/api/src/modules/payments/adapters/google.ts
POST /v1/payments/google/verify-purchase
// Uses Google Play Developer API for verification
```

**Key Points:**
- 30% revenue share to Google (15% for first $1M annually)
- Must use Google Play Billing for digital goods
- Use Google Play Billing Library 5.0+
- Server-side verification with Google Play Developer API
- Real-time developer notifications via Pub/Sub

**Types of Purchases:**
- **Consumable** - Virtual currency
- **Non-consumable** - Permanent items
- **Subscriptions** - Recurring content

**Setup Required:**
- Google Play Developer account ($25 one-time)
- Configure products in Google Play Console
- Implement Play Billing Library in Android build
- Set up Google Cloud Pub/Sub for real-time notifications

---

## Recommended Solution Architecture

### Virtual Currency System (Recommended)

Use **two-currency model**:
1. **Premium Currency** (Gems/Crowns) - Purchasable with real money
2. **Soft Currency** (Gold/Ducats) - Earned through gameplay

**Why?**
- Unified backend - all platforms buy "Gems", Gems buy items
- Simplifies accounting and prevents platform policy violations
- Allows cross-platform balance (buy on Steam, use on mobile)
- Single source of truth for player inventory

### Database Schema

```sql
-- Add to apps/api/prisma/schema.prisma

model Transaction {
  id            String   @id @default(cuid())
  accountId     String
  platform      String   // 'web', 'steam', 'ios', 'android'
  platformTxId  String   @unique // Platform's transaction ID
  productId     String   // 'gems_500', 'stash_tab_1'
  amount        Int      // In cents/smallest unit
  currency      String   // 'USD', 'EUR', etc.
  status        String   // 'pending', 'completed', 'failed', 'refunded'
  gemsGranted   Int      // Virtual currency amount
  createdAt     DateTime @default(now())
  completedAt   DateTime?
  
  account       Account  @relation(fields: [accountId], references: [id])
  
  @@index([accountId])
  @@index([platformTxId])
}

model Currency {
  id          String   @id @default(cuid())
  accountId   String
  type        String   // 'gems', 'gold'
  amount      Int      @default(0)
  
  account     Account  @relation(fields: [accountId], references: [id])
  
  @@unique([accountId, type])
}

model Purchase {
  id            String   @id @default(cuid())
  accountId     String
  transactionId String?  // Links to Transaction if real-money purchase
  productType   String   // 'stash_tab', 'cosmetic', 'consumable'
  productId     String
  gemsSpent     Int
  createdAt     DateTime @default(now())
  
  account       Account     @relation(fields: [accountId], references: [id])
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
  
  @@index([accountId])
}
```

### Product Catalog (Backend)

```typescript
// packages/shared/src/shop.ts

export const PRODUCTS = {
  // Premium Currency Packs
  gems_100: { gems: 100, price: { USD: 0.99, EUR: 0.99 } },
  gems_500: { gems: 550, price: { USD: 4.99, EUR: 4.99 } }, // 10% bonus
  gems_1000: { gems: 1150, price: { USD: 9.99, EUR: 9.99 } }, // 15% bonus
  gems_2500: { gems: 3000, price: { USD: 19.99, EUR: 19.99 } }, // 20% bonus
  
  // Direct Purchases (spend Gems)
  stash_tab: { gemsPrice: 150, type: 'expansion' },
  cosmetic_armor_set_1: { gemsPrice: 500, type: 'cosmetic' },
  name_change: { gemsPrice: 200, type: 'service' },
} as const;
```

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Design virtual currency schema
- [ ] Create `payments` module in backend
- [ ] Implement base payment adapter interface
- [ ] Create transaction logging system
- [ ] Build gem purchase UI in web client

### Phase 2: Web Payments (Week 2-3)
- [ ] Set up Stripe account
- [ ] Implement Stripe Checkout integration
- [ ] Create webhook handler for Stripe
- [ ] Test purchase flow end-to-end
- [ ] Add purchase history UI

### Phase 3: Steam Integration (Week 3-4)
- [ ] Register Steamworks partner account
- [ ] Configure microtransaction items in Steamworks
- [ ] Integrate Steamworks SDK in desktop app
- [ ] Implement Steam payment adapter
- [ ] Test with Steam sandbox

### Phase 4: Mobile Stores (Week 5-8)
- [ ] Set up Apple Developer account
- [ ] Configure IAP products in App Store Connect
- [ ] Implement Apple payment adapter + receipt verification
- [ ] Set up Google Play Developer account
- [ ] Configure products in Google Play Console
- [ ] Implement Google Play Billing adapter + verification
- [ ] Test on TestFlight and Google Play Internal Testing

### Phase 5: Security & Compliance (Ongoing)
- [ ] Implement receipt validation for all platforms
- [ ] Add fraud detection (multiple purchase attempts, refund abuse)
- [ ] GDPR compliance for transaction data
- [ ] Add transaction audit logging
- [ ] Implement refund handling

---

## Security Best Practices

### 1. Server-Side Verification
**CRITICAL**: Never trust client for purchase validation

```typescript
// ❌ WRONG - Client says "I bought this"
app.post('/purchase', (req) => {
  await grantGems(req.body.accountId, req.body.gems);
});

// ✅ CORRECT - Server verifies with platform
app.post('/purchase/verify', async (req) => {
  const receipt = req.body.receipt;
  const verification = await platform.verifyReceipt(receipt);
  
  if (verification.valid && !verification.used) {
    await grantGems(verification.accountId, verification.gems);
    await markReceiptUsed(receipt);
  }
});
```

### 2. Idempotency
Store platform transaction IDs to prevent double-crediting:

```typescript
const existingTx = await db.transaction.findUnique({
  where: { platformTxId: steamTxId }
});

if (existingTx) {
  return { status: 'already_processed' };
}
```

### 3. Webhook Signature Verification
Always verify webhook signatures:

```typescript
// Stripe example
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
```

---

## Platform Policy Compliance

### Apple Rules
- ✅ Use IAP for gems, items, features
- ❌ Cannot link to external payment in iOS app
- ❌ Cannot mention prices are cheaper elsewhere
- ✅ Can sell physical goods outside IAP (not applicable here)

### Google Rules
- ✅ Use Google Play Billing for digital goods
- ❌ Cannot bypass Google Play Billing
- ✅ Can mention other platforms exist

### Steam Rules
- ✅ Must use Steam Wallet for Steam version
- ✅ Can mention game exists on other platforms
- ⚠️ Price parity - Steam prices should match other platforms

---

## Pricing Strategy Recommendations

### 1. Price Points
Align with psychological price points:
- $0.99 - Impulse buy
- $4.99 - Small pack (most common purchase)
- $9.99 - Medium pack (best value per gem)
- $19.99 - Large pack
- $49.99 - Whale pack
- $99.99 - Ultra whale

### 2. Bonus Gems
Incentivize larger purchases:
- $0.99 - 100 gems (baseline)
- $4.99 - 550 gems (10% bonus)
- $9.99 - 1150 gems (15% bonus)
- $19.99 - 3000 gems (20% bonus)

### 3. First-Time Purchase Bonus
Double gems on first purchase to convert players.

---

## Testing Strategy

### Stripe Testing
- Use test mode with test cards: `4242 4242 4242 4242`

### Steam Testing
- Use Steamworks sandbox environment
- Test accounts provided by Steamworks

### Apple Testing
- Use StoreKit testing in Xcode
- Sandbox test accounts in App Store Connect
- TestFlight for beta testing

### Google Testing
- Use test accounts in Google Play Console
- License test accounts for immediate purchase
- Internal testing track

---

## Cost Analysis

| Platform | Fee | Notes |
|----------|-----|-------|
| Stripe | 2.9% + $0.30 | Per transaction |
| PayPal | 2.9% + $0.30 | Per transaction |
| Paddle | 5% + $0.50 | Merchant of record (handles tax) |
| Steam | 30% | Per transaction |
| Apple | 30% / 15% | Small business program < $1M |
| Google | 30% / 15% | First $1M annually |

**Example: $4.99 Purchase**
- Web (Stripe): You get $4.54 (91%)
- Steam: You get $3.49 (70%)
- iOS: You get $3.49 (70%) or $4.24 (85% if small business)
- Android: You get $3.49 (70%) or $4.24 (85% for first $1M)

---

## Monetization Strategy for Ebonkeep

Based on your existing economy design:

### Premium Items (Buy with Gems)
1. **Stash Tabs** - 150 gems each (convenience)
2. **Cosmetic Armor Sets** - 300-800 gems (vanity)
3. **Character Slots** - 200 gems (alt-friendly)
4. **Name Change** - 150 gems (service)
5. **Battle Pass** - 1000 gems (seasonal, $9.99 value)

### Future Considerations
- **Vestige Enchanting Boosters** - Speed up enhancement
- **Respec Tokens** - Reset skill/stat allocation
- **Cosmetic Weapon Skins** - Visual variety
- **Inventory Pet** - Auto-loot feature

### What NOT to Sell (Avoid Pay-to-Win)
- ❌ Direct stat boosts
- ❌ Exclusive powerful gear
- ❌ XP boosters (unless PvE only)
- ❌ Energy/stamina systems requiring gems

---

## Next Steps

1. **Decide on initial platform**: Start with **Web (Stripe)** - fastest to implement and test
2. **Set up Stripe account**: https://stripe.com
3. **Implement virtual currency system**: Gems + soft currency
4. **Build purchase flow**: UI → Backend → Stripe → Webhook → Grant Gems
5. **Add to existing economy module**: Integrate with your `apps/api/src/modules/economy`

Would you like me to start implementing the basic infrastructure? I can create:
- Database schema for transactions and currencies
- Base payment adapter interface
- Stripe integration for web
- Purchase UI components for the web client
