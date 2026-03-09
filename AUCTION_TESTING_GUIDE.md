# Auction House Testing Guide

## ✅ Co bolo hotové

1. **Backend**:
   - ✅ Všetky API endpoints funkčné (15+ routes)
   - ✅ Prisma schéma s 6 modelmi
   - ✅ Background jobs (settlement, creation, expired rewards)
   - ✅ Admin middleware a autentifikácia
   - ✅ Test endpoint pre manuálne vytvorenie aukcií

2. **Frontend**:
   - ✅ AuctionHouse.tsx komponent vytvorený
   - ✅ Integrovaný do App.tsx
   - ✅ 3 tabyBrowse Auctions**, **My Bids**, **Rewards**
   - ✅ Interaktívny bidding interface
   - ✅ Real-time data fetching

---

## 🚀 Postup testovania

### Krok 1: Priprav testové dáta (jednorázovo)

Toto vytvorí 10 test playerov s peniazmi a 5 schválených itemov pre aukcie:

```powershell
cd c:\Users\gethe\Desktop\browserovka\apps\api
npx tsx src/modules/auction/test-data.ts setup
```

**Output**:
```
=== Setting up test environment ===

Created test player: test_player_1 (Level 42, 67543 ducats)
Created test player: test_player_2 (Level 18, 23456 ducats)
...

✓ Created 10 test players
✓ Created 5 test submissions
✓ Approved all submissions

=== Test environment ready ===
```

### Krok 2: Vytvor aukcie (manuálne pre testovanie)

Pretože aukcie sa normálne vytvárajú automaticky o 00:00, 08:00, 16:00 UTC, pridali sme test endpoint:

```powershell
curl -X POST http://localhost:4000/v1/auction/test/create-auctions
```

**Response**:
```json
{
  "success": true,
  "message": "Auctions created"
}
```

### Krok 3: Spusti aplikáciu

```powershell
cd c:\Users\gethe\Desktop\browserovka

# Ak ešte nebežia servery:
.\run-local.bat
```

Počkaj, kým sa API a Web spustia:
- API: `http://localhost:4000`
- Web: `http://localhost:5173`

### Krok 4: Prihlás sa do frontend

1. Otvor `http://localhost:5173` v browseri
2. Prihlás sa s existujúcim účtom (alebo test accountom ak máš)
3. V hornej navigácii klikni na **Auction House** 🔨

### Krok 5: Testuj funkcie

#### A) Browse Auctions (hlavná obrazovka)
- Vidíš aktívne aukcie podľa level bracketu (napr. 1-25, 26-50, 51-75)
- Každá aukcia zobrazuje:
  - Počet itemov
  - Zostávajúci čas (napr. "11h 45m")
- Klikni na aukciu pre zobrazenie itemov

#### B) Bidding (staviť)
Pre každý item vidíš:
- Názov, level, rarity, kategória
- Current Bid (aktuálna ponuka)
- Starting Bid (počiatočná cena)
- Počet bidov

**Ako staviť**:
1. Do input poľa zadaj sumu (musí byť >= minimálnej hodnote)
2. Klikni **Place Bid**
3. Bid sa okamžite zobrazí

**Error handling**:
- Ak nemáš dosť ducats → červené hlásenie
- Ak je item už overbidnutý → error z backendu
- Snipe protection: ak stavíš v posledných 2 minútach, aukcia sa predĺži

#### C) My Bids Tab
- Zobrazia sa všetky tvoje aktívne bidy
- Vidíš status (active, outbid, winning)
- Môžeš sledovať, či vyhrával alebo ťa niekto predbehol

#### D) Rewards Tab
- Unclaimed wins (výhry, ktoré si ešte nesebaral)
- Expiry countdown (vyprší za 7 dní)
- Klikni **Claim** pre získanie itemu do inventory

---

## 🧪 Advanced Testing

### Backend API Direct Testing

#### 1. Check Active Auctions
```powershell
$token = "YOUR_JWT_TOKEN"
curl -H "Authorization: Bearer $token" http://localhost:4000/v1/auction/active
```

#### 2. Place Bid
```powershell
curl -X POST http://localhost:4000/v1/auction/bid `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"itemId": "ITEM_ID", "bidAmount": 1000}'
```

#### 3. Get My Bids
```powershell
curl -H "Authorization: Bearer $token" http://localhost:4000/v1/auction/my-bids
```

#### 4. Get Pending Rewards
```powershell
curl -H "Authorization: Bearer $token" http://localhost:4000/v1/auction/rewards/pending
```

### Simulate Random Bids

Vytvor 20 náhodných bidov od test playerov:

```powershell
cd apps/api
npx tsx src/modules/auction/test-data.ts bids 10 20
```

### Clean Up Test Data

Odstráň všetky test dáta:

```powershell
cd apps/api
npx tsx src/modules/auction/test-data.ts cleanup
```

---

## 📊 Konfigurácia

Všetky nastavenia sú v `apps/api/src/modules/auction/auction_config.ini`:

```ini
[instance]
auction_start_times_utc = 0,8,16  # Kedy sa vytvárajú aukcie (UTC)
auction_duration_hours = 8        # Trvanie aukcie
minimum_items_per_bracket = 15    # Min items na bracket
maximum_items_per_bracket = 25    # Max items na bracket

[bidding]
bid_increment = 10                # Minimálny rozdiel medzi bidmi
low_ducats_warning_threshold = 100 # Warning ak máš málo peňazí

[snipe_protection]
enabled = true
window_minutes = 2                # Posledné 2min = snipe protection
extension_minutes = 2             # Predĺženie o 2min
max_extensions = 3                # Max 3 predĺženia

[fees]
aehouse_fee_percent = 5          # 5% fee z winning bidov
player_listing_fee = 100          # Fee za submission itemu

[rewards]
claim_window_days = 7             # 7 dní na claim win
expired_mail_storage_days = 30    # Potom sa pošle mailom
```

---

## 🐛 Troubleshooting

### "No Active Auctions"
- Najskôr musíš vytvoriť aukcie: `POST /v1/auction/test/create-auctions`
- Skontroluj, či existujú approved submissions v databáze
- Check background jobs: mal by sa zobraziť log pri štarte API

### "Failed to load auctions"
- Check API beží na `http://localhost:4000`
- Check token je platný (prihlás sa znova)
- Check browser console pre detailný error

### "Insufficient ducats"
- Tvoj player musí mať dostatok ducats v `currencyBalance`
- Test playeri majú 10k-100k ducats
- Skontroluj v DB: `SELECT * FROM "CurrencyBalance" WHERE "playerId" = 'tvoj_player_id';`

### Items sa neobjavia v aukcii
- Check sú submissiony approved: `SELECT * FROM "AuctionPlayerListing" WHERE status = 'approved';`
- Check level bracket má dosť itemov (min 15)
- Check `auction_config.ini` level brackets nastavenia

---

## 🎯 Čo testovať

### Must Test
- ✅ Zobrazenie aktívnych aukcií
- ✅ Zobrazenie itemov v aukcii
- ✅ Placing bid (úspešný)
- ✅ Placing bid (error - insufficient funds)
- ✅ My Bids tab zobrazenie
- ✅ Rewards tab zobrazenie
- ✅ Claiming reward

### Should Test
- ⏱️ Countdown timer (refresh po pár minútach)
- 🔄 Auto-refresh pri bidovaní
- 🛡️ Snipe protection (bidni v posledných 2min)
- 💰 Settlement (počkaj kým aukcia skončí)
- 📧 Expiry notification (wait 7 days - nebo zmeniš config)

### Nice to Have
- 🎨 Rarity colors (common/uncommon/rare/epic)
- 📊 Player submission workflow
- 🔐 Admin approval UI
- 🏆 Leaderboards (top bidders)

---

## 📝 Next Steps

1. **Player Item Submission UI**:
   - Tab v AuctionHouse pre submit vlastných itemov
   - Form: select item from inventory, set starting bid
   - Show submission status (pending/approved/rejected)

2. **Admin Moderation Panel**:
   - Separate UI pre adminov
   - Approve/reject submissions
   - Monitor auction health

3. **Real-time Updates**:
   - WebSocket notifications keď ťa niekto outbidne
   - Live countdown timers
   - Push notifications pre won items

4. **Mobile Responsiveness**:
   - Touch-friendly bidding
   - Optimized layout pre mobile

---

## ✨ Features Implemented

### Backend (100% Complete)
- [x] Auction instance management (create, settle)
- [x] Item bidding with validation
- [x] Snipe protection
- [x] Settlement with 5% fee
- [x] Player submissions (pending/approved/rejected)
- [x] Rewards system (claim/expire)
- [x] Background jobs (cron-based)
- [x] Admin moderation endpoints
- [x] Redis caching
- [x] Comprehensive error handling

### Frontend (80% Complete)
- [x] Browse active auctions
- [x] View auction items with details
- [x] Place bids with validation
- [x] My Bids tracker
- [x] Pending Rewards viewer
- [x] Claim rewards
- [x] Error notifications
- [x] Rarity-based styling
- [ ] Player item submission UI
- [ ] Real-time countdown
- [ ] WebSocket bid notifications
- [ ] Mobile responsive design

---

## 🎉 Enjoy Testing!

Machine presne tak, ako by sa nehralo live. Background jobs bežia automaticky, settlement sa deje každú minútu, a nové aukcie sa vytvoria 3x denne.

Ak nájdeš bug alebo máš nápad na feature, len napíš! 🚀
