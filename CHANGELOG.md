# Changelog

All notable changes to Ebonkeep project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added - March 8, 2026

#### PayPal Integration & Imperial Shop
- **Imperial Shop UI Component** - Beautiful modal interface for purchasing Imperials
  - 3 bundle tiers: 100 ($5), 400 ($15), 900 ($30) Imperials
  - Added to navigation menu as "Imperial Shop"
  - Automatic payment flow with success confirmation
  - Location: `apps/web/src/components/ImperialShop.tsx`

- **Payment API Endpoints** - Complete REST API for transactions
  - `GET /v1/payments/bundles` - List available bundles
  - `POST /v1/payments/create` - Create PayPal order
  - `POST /v1/payments/capture` - Capture payment & credit Imperials
  - `POST /v1/payments/cancel` - Cancel pending payment
  - `GET /v1/payments/history` - Transaction history
  - `POST /v1/payments/webhook/paypal` - PayPal webhook handler (stub)
  - Location: `apps/api/src/modules/payments/routes.ts`

- **Transaction Service** - Business logic for payment processing
  - PayPal OAuth 2.0 client with token caching
  - Transaction state management (pending, completed, failed, cancelled)
  - Automatic Imperial crediting on successful payment
  - Idempotent payment capture (prevents double-crediting)
  - Location: `transactions/transaction.service.ts`, `transactions/paypal.client.ts`

- **Database Schema** - Transaction model for audit trail
  - Tracks payment status, amounts, bundles, and metadata
  - Linked to Account for transaction history
  - Migration: `add_transactions`
  - Location: `apps/api/prisma/schema.prisma`

- **Type Safety** - Zod schemas and TypeScript types
  - `ImperialBundle`, `Transaction`, `TransactionStatus`
  - Payment request/response schemas
  - PayPal API type definitions
  - Location: `packages/shared/src/index.ts`, `transactions/paypal.types.ts`

- **Documentation**
  - `PAYPAL_SETUP.md` - Complete setup guide for sandbox and production
  - `transactions/readme.md` - Architecture and API documentation
  - `.env.example` - All PayPal environment variables with descriptions

#### Configuration
- **Environment Variables**
  - `PAYPAL_SANDBOX` - Toggle between sandbox and production
  - `PAYPAL_CLIENT_ID` - PayPal API client ID
  - `PAYPAL_CLIENT_SECRET` - PayPal API secret
  - `PAYPAL_RETURN_URL` - Success redirect URL
  - `PAYPAL_CANCEL_URL` - Cancel redirect URL

- **TypeScript Paths** - Module aliases for cleaner imports
  - `@ebonkeep/transactions/*` - Transaction module imports

### Changed
- **Navigation** - Added "Imperial Shop" menu item
- **Translations** - Added `menu.shop` translation key (English)
- **Account System** - Transaction history linked to accounts

### Technical Details

#### Payment Flow
1. User clicks "Buy Now" on bundle
2. Frontend POST to `/v1/payments/create`
3. Backend creates PayPal order, saves transaction as "pending"
4. User redirected to PayPal for approval
5. User completes payment on PayPal
6. PayPal redirects back with order token
7. Frontend POST to `/v1/payments/capture`
8. Backend captures payment, updates transaction to "completed"
9. Imperials credited to all player profiles on account
10. Success message displayed, balance refreshed

#### Security Features
- JWT authentication required for all payment endpoints
- Transaction audit trail in database
- Idempotent captures via unique `providerOrderId`
- PayPal handles all card data (PCI-compliant)
- Production must use HTTPS for payment flows

#### Multi-Platform Architecture
- Adapter pattern in `/transactions` folder
- Designed for multiple payment providers:
  - ✅ PayPal (Web) - Implemented
  - 🔜 Steam Microtransactions API
  - 🔜 iOS App Store In-App Purchases
  - 🔜 Google Play In-App Billing

### Files Added
```
transactions/
  ├── index.ts                    # Module exports
  ├── paypal.types.ts             # PayPal API types
  ├── paypal.client.ts            # PayPal REST client
  ├── transaction.service.ts      # Business logic
  └── readme.md                   # Documentation (updated)

apps/api/src/modules/payments/
  └── routes.ts                   # Payment API routes

apps/web/src/components/
  └── ImperialShop.tsx           # Shop UI component

.env.example                      # Environment template
PAYPAL_SETUP.md                   # Setup guide
CHANGELOG.md                      # This file
```

### Files Modified
```
apps/api/
  ├── prisma/schema.prisma        # Added Transaction model
  ├── src/index.ts                # Registered payment routes
  └── tsconfig.json               # Added transaction path alias

apps/web/
  ├── src/App.tsx                 # Added shop to navigation
  └── src/i18n/locales/en/common.json  # Added translations

packages/shared/
  └── src/index.ts                # Added payment types & bundles

README.md                         # Updated with features
.cloude                          # Added project guidelines
```

### Migration Required
```bash
cd apps/api
npx prisma generate
npx prisma migrate dev --name add_transactions
```

## Previous Development

### Account & Authentication System
- Email/password registration
- JWT token authentication
- Email verification
- Password reset flow
- Guest login for development

### Player Profile & Stats
- Multi-class system (Warrior, Mage, Ranger)
- Stat training system
- Dual currency (Ducats/Imperials)
- Level and gear score tracking

### Inventory & Equipment
- Drag-and-drop inventory management
- Equipment slots by class archetype
- Item comparison tooltips
- Power-based sorting

### Combat System
- Turn-based combat playback
- Action resolution with animations
- Combat log and replay
- Contract mission system

---

**Note:** Dates and versions follow development timeline. Production releases will use semantic versioning.
