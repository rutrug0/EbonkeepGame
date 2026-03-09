# V1 vs V2 Feature Comparison

Quick reference for what's included in V1 (launch) vs what's planned for V2 (future).

## Core Features

| Feature | V1 Status | V2 Planned | Rationale for V1 Decision |
|---------|-----------|------------|---------------------------|
| **System-generated items** | ✅ Included | Kept | Simpler, no moderation needed |
| **Player-submitted items** | ❌ Not included | ✅ Added | V1: Too complex; V2: Key feature for economy |
| **Anonymous bidding** | ✅ Included | Kept | Reduces toxicity, prevents collusion |
| **Reveal winner after end** | ❌ Not included | ✅ Optional | V2: Privacy setting to show/hide name |
| **Auto-bid** | ✅ Included | Kept | Critical for casual players |
| **Manual bid only mode** | ❌ Not offered | Same | All bids can optionally use auto-bid |
| **Level-bracketed instances** | ✅ Included | Kept | Prevents high-level dominance |
| **Cross-bracket bidding** | ❌ Not allowed | ❌ Stay restricted | Would break balance |

## Auction Configuration

| Setting | V1 Value | V2 Value | Notes |
|---------|----------|----------|-------|
| **Auction duration** | 16 hours | 16 hours | Tested in V1, likely stays same |
| **Concurrent auctions** | 3 per bracket | 3-5 per bracket | May increase if demand high |
| **Items per auction** | 6 | 6-10 | V2 may add "large auctions" |
| **Starting bid formula** | 60% of base value | Same | Balanced in V1, keep |
| **Bid increment** | MAX(10, 5%) | Same | Works well |
| **Extension trigger** | 2 minutes | 1-2 minutes | May tighten in V2 based on data |
| **Max extensions** | 5 (10 min total) | 5-10 | V2 may allow longer |
| **Level brackets** | 10 levels (e.g., 1-10) | 5-10 levels | May tighten brackets if population grows |

## Currency & Economy

| Feature | V1 | V2 | Notes |
|---------|----|----|-------|
| **Bid currency** | Ducats only | Ducats only | No Imperials in auctions |
| **Auction house tax** | 0% (no tax) | 5% seller fee | V1: Learn economy; V2: Add sink |
| **Bid cancellation** | Not allowed | Not allowed | Prevents abuse |
| **Refund on outbid** | 100% immediate | 100% immediate | No reason to change |
| **Expired reward refund** | 80% after 7 days | 80% after 7 days | Penalty encourages claiming |
| **Starting bid floor** | 60% of base | 50-70% variable | V2 may adjust per item type |

## Real-Time Updates

| Method | V1 | V2 | Upgrade Reason |
|--------|----|----|----------------|
| **Bid updates** | 10-second polling | WebSocket push | V2: Better UX, less latency |
| **Auction end countdown** | Client-side timer | Client + server sync | V2: More accurate |
| **Outbid notifications** | Poll + UI update | Push notification | V2: Immediate alert |
| **Won item notification** | No notification | Push + email | V2: Notification system exists |

## UI/UX Features

| Feature | V1 | V2 | Notes |
|---------|----|----|-------|
| **Auction tabs** | 3 tabs | 3+ tabs | May add more if auctions scale |
| **Item grid layout** | 6 items, 3x2 grid | Dynamic grid | V2: Responsive to item count |
| **Item tooltips** | On hover | On hover + tap (mobile) | V2: Better mobile support |
| **Bid history** | Last 5 bids | Full paginated history | V1: Simplicity; V2: Transparency |
| **Search/filter** | ❌ None | ✅ Added | V2: Filter by rarity, class, level |
| **Sort options** | None (fixed order) | Multiple sorts | V2: By bid, time left, level |
| **Watchlist** | ❌ Not included | ✅ Added | V2: Bookmark items of interest |
| **Bid calculator** | ❌ Not included | ✅ Added | V2: Shows min increment, auto-bid math |

## Advanced Bidding

| Feature | V1 | V2 | Notes |
|---------|----|----|-------|
| **Manual bid** | ✅ Included | Kept | Core feature |
| **Auto-bid** | ✅ Included | Enhanced | V2: May add "aggressive" vs "conservative" modes |
| **Buy-it-now** | ❌ Not included | ✅ Optional | V2: Seller can set instant buy price |
| **Reserve price** | ❌ Not included | ✅ Optional | V2: Min price to win (hidden) |
| **Sealed bid** | ❌ Not included | ❌ V3+ | Too complex for V2 |
| **Dutch auction** | ❌ Not included | ❌ V3+ | Different auction type |

## Anti-Abuse & Fraud Prevention

| Measure | V1 | V2 | Notes |
|---------|----|----|-------|
| **Rate limiting** | ✅ 10 bids/min | ✅ 10 bids/min | Sufficient |
| **Bid spam detection** | Basic (rate limit) | Advanced ML | V2: Pattern analysis |
| **Shill bidding detection** | ❌ Not included | ✅ Added | V2: Flag coordinated bids |
| **Bot detection** | Basic (rate limit) | CAPTCHA on suspicious | V2: More robust |
| **Inventory verification** | ✅ On claim | ✅ On claim | Same logic |
| **Currency verification** | ✅ On bid | ✅ On bid | Same logic |
| **Auction manipulation alerts** | ❌ Not included | ✅ Admin dashboard | V2: Monitor unusual activity |

## Settlement & Rewards

| Feature | V1 | V2 | Notes |
|---------|----|----|-------|
| **Auto-settlement** | ✅ Every 1 min | ✅ Every 1 min | Fast enough |
| **Item delivery** | ✅ Direct to inventory | Same | Works well |
| **Pending rewards** | ✅ 7-day expiry | Same | Good balance |
| **Inventory full handling** | ✅ Pending reward | Same | Robust solution |
| **Manual claim** | ✅ Included | Same | Required for full inventory |
| **Expired reward refund** | ✅ 80% ducats | Same | Fair penalty |
| **Multi-item claim** | ❌ One at a time | ✅ Batch claim | V2: Convenience feature |
| **Delivery confirmation** | ❌ No UI feedback | ✅ Success message | V2: Better UX |

## Admin/Moderation Tools

| Tool | V1 | V2 | Notes |
|------|----|----|-------|
| **Manual auction creation** | ✅ Test endpoint | ✅ Admin UI | V2: Production tool |
| **Cancel auction** | ❌ Not possible | ✅ Admin only | V2: Emergency stop |
| **Ban player from auctions** | ❌ Not included | ✅ Admin tool | V2: Abuse response |
| **Adjust bid manually** | ❌ Not possible | ❌ Stay restricted | Too risky |
| **View all active bids** | ❌ Not included | ✅ Admin dashboard | V2: Monitoring |
| **Item approval queue** | ❌ N/A (system-gen) | ✅ Required | V2: For player submissions |
| **Settlement logs** | ✅ Server logs | ✅ Admin UI | V2: Better visibility |

## Analytics & Telemetry

| Metric | V1 | V2 | Notes |
|--------|----|----|-------|
| **Bid placement events** | ✅ Logged | ✅ Logged + visualized | V2: Grafana dashboard |
| **Auto-bid usage rate** | ✅ Logged | ✅ Dashboard | V2: Track adoption |
| **Settlement success rate** | ✅ Logged | ✅ Alert on failures | V2: Proactive monitoring |
| **Average bids per item** | ❌ Not tracked | ✅ Tracked | V2: Balance indicator |
| **Ducat sink analysis** | ❌ Not tracked | ✅ Economy dashboard | V2: Balance economy |
| **Player retention** | ❌ Not tracked | ✅ Cohort analysis | V2: Track auction engagement |
| **Item popularity** | ❌ Not tracked | ✅ Track by rarity/class | V2: Improve item generation |

## Performance & Scalability

| Aspect | V1 | V2 | Notes |
|--------|----|----|-------|
| **Concurrent bidders** | Tested up to 100 | Tested up to 1000 | V2: Scale testing |
| **Database indexing** | Basic indexes | Optimized | V2: Query tuning |
| **Redis caching** | Minimal (locks only) | Aggressive caching | V2: Cache auction data |
| **API rate limiting** | Basic | Tiered by player level | V2: VIP players get more |
| **Background job scaling** | Single worker | Distributed workers | V2: Handle more auctions |
| **WebSocket fanout** | N/A (polling) | Optimized pubsub | V2: Handle many connections |

## Testing & QA

| Test Type | V1 | V2 | Notes |
|-----------|----|----|-------|
| **Unit tests** | ✅ Core services | ✅ Expanded coverage | V2: 90%+ coverage |
| **Integration tests** | ✅ Full flow | ✅ More scenarios | V2: Edge cases |
| **Load tests** | ✅ 100 users | ✅ 1000 users | V2: Scale up |
| **Concurrency tests** | ✅ Race conditions | ✅ Stress tests | V2: More extreme |
| **UI tests** | ✅ Basic E2E | ✅ Full E2E suite | V2: Automated regression |
| **Security tests** | ❌ Not included | ✅ Penetration testing | V2: Pro audit |

## Documentation

| Doc Type | V1 | V2 | Notes |
|----------|----|----|-------|
| **Player guide** | ❌ Not written | ✅ In-game tutorial | V2: Onboarding |
| **API docs** | ❌ Code comments only | ✅ Swagger/OpenAPI | V2: External devs |
| **Admin guide** | ❌ Not written | ✅ Admin manual | V2: Support team |
| **Architecture docs** | ✅ DESIGN.md | ✅ Keep updated | V1: Good foundation |
| **Runbooks** | ❌ Not written | ✅ Incident response | V2: Ops team |

## Mobile Experience

| Feature | V1 | V2 | Notes |
|---------|----|----|-------|
| **Responsive layout** | ✅ Basic responsive | ✅ Mobile-optimized | V2: Native feel |
| **Touch interactions** | ✅ Works | ✅ Optimized | V2: Swipe, long-press |
| **Mobile notifications** | ❌ Not included | ✅ Push notifications | V2: Outbid alerts |
| **Offline mode** | ❌ Not supported | ❌ Stay online-only | No plans for offline |
| **App wrapper** | ❌ Web only | ❌ Stay web | No native app planned |

## Community Features

| Feature | V1 | V2 | Notes |
|---------|----|----|-------|
| **Public auction history** | ❌ Not visible | ✅ Public leaderboard | V2: Show top bidders |
| **Item showcase** | ❌ Not included | ✅ Show recent wins | V2: Social engagement |
| **Guild auctions** | ❌ Not included | ✅ Private auctions | V2: Guild feature |
| **Gifting won items** | ❌ Not allowed | ❌ Stay restricted | Prevents RMT |
| **Auction chat** | ❌ Not included | ❌ Not planned | Too much spam |

## Special Events

| Event Type | V1 | V2 | Notes |
|-----------|----|----|-------|
| **Holiday auctions** | ❌ Not planned | ✅ Seasonal items | V2: Themed auctions |
| **Rare item events** | ❌ Not planned | ✅ Epic+ only auctions | V2: High-stakes |
| **Charity auctions** | ❌ Not planned | ❌ V3+ | Requires real money |
| **Time-limited auctions** | ❌ Not included | ✅ 1-hour flash auctions | V2: Excitement |

## Internationalization

| Aspect | V1 | V2 | Notes |
|--------|----|----|-------|
| **Multi-language support** | ❌ English only | ✅ Multi-language | V2: Localization |
| **Currency formatting** | Basic | Localized | V2: 1.000 vs 1,000 |
| **Timezone display** | UTC only | Player's timezone | V2: Better UX |
| **Date formats** | ISO 8601 | Localized | V2: MM/DD vs DD/MM |

## Monetization

| Feature | V1 | V2 | Notes |
|---------|----|----|-------|
| **Auction house tax** | 0% | 5% | V2: Economy sink |
| **Premium auctions** | ❌ Not included | ✅ Imperials required | V2: Premium items |
| **Listing fees** | 0 (system-generated) | Variable | V2: For player submissions |
| **Featured listings** | ❌ Not applicable | ✅ Imperials to highlight | V2: Pay for visibility |

---

## Summary: Why V1 is Minimal

### V1 Goal: **Ship Fast, Learn Fast**
- ✅ Core functionality works perfectly
- ✅ Economy is safe (no exploits)
- ✅ UX is clean and understandable
- ✅ Foundation is solid for V2 expansion

### What V1 Proves:
1. Players want auctions (measure participation rate)
2. Auto-bid is useful (track usage %)
3. Ducat economy is balanced (monitor sinks)
4. 16-hour duration is good (track engagement curve)
5. System can handle load (monitor performance)

### What V2 Adds:
1. **Player submissions** → Real economy emerges
2. **WebSocket updates** → Better UX, more engaging
3. **Advanced features** → Filters, watchlist, buy-it-now
4. **Anti-abuse tools** → Detect and punish bad actors
5. **Analytics dashboard** → Deep insights for balancing

---

## Migration Path: V1 → V2

### Phase 1: Data Collection (Weeks 1-4 post-launch)
- ✅ Monitor all V1 metrics
- ✅ Gather player feedback
- ✅ Identify pain points
- ✅ Determine V2 priorities based on data

### Phase 2: V2 Development (Months 2-3 post-launch)
- ✅ Build player item submission system
- ✅ Add WebSocket infrastructure
- ✅ Implement advanced UI features
- ✅ Add auction house tax
- ✅ Build admin/moderation tools

### Phase 3: V2 Beta (Month 4 post-launch)
- ✅ Test with subset of players
- ✅ Verify tax doesn't break economy
- ✅ Ensure WebSockets scale
- ✅ Validate player submissions moderation

### Phase 4: V2 Launch (Month 5 post-launch)
- ✅ Full rollout
- ✅ Migrate V1 data (if needed)
- ✅ Monitor closely for issues
- ✅ Iterate based on feedback

---

**Key Takeaway:** V1 is intentionally minimal to ship fast and learn. V2 is where the auction house becomes a core economy driver.
