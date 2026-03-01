# Technical Architecture

## Architecture Summary
- Frontend: TypeScript + React SPA.
- Realtime: WebSocket channel for combat and server timer updates.
- Request/response: REST for account/profile/economy operations.
- Backend: TypeScript modular monolith.
- Database: PostgreSQL (source of truth).
- Cache/state/queue: Redis (timers, transient combat/session state, short-lived queues).

## Backend Module Boundaries
1. `auth`: platform identity validation, token issuance, account linking.
2. `player`: profile, class selection, level/stats, derived power.
3. `inventory`: grid, stash, equipment, item movement constraints.
4. `economy`: currencies, shops, consumables, sinks/sources.
5. `combat`: encounter setup, initiative ordering, action resolution.
6. `scheduler`: timed jobs, refresh windows, deferred rewards.
7. `telemetry`: analytics events, balance observability hooks.

## High-Level Data Model
- PostgreSQL tables (initial):
  - `accounts`
  - `player_profiles`
  - `player_stats`
  - `inventory_items`
  - `inventory_layouts`
  - `equipment_slots`
  - `shop_instances`
  - `job_runs`
  - `combat_sessions`
  - `combat_actions`
  - `currencies`
  - `event_progress`
- Redis keys/patterns:
  - `combat:session:{id}:state`
  - `combat:session:{id}:timer`
  - `shop:refresh:{player_id}`
  - `job:complete:{player_id}:{job_id}`
  - `ws:player:{player_id}:presence`

## Realtime and Timer Authority
- Server is the source of truth for all turn timers and action resolution.
- Clients may render local countdown but must reconcile to server tick payloads.
- If a player does not provide an input before deadline, server applies fallback action policy.

## Public Interfaces (High-Level)
REST:
- `POST /v1/combat/sessions`
- `POST /v1/combat/actions`
- `GET /v1/player/state`
- `POST /v1/inventory/move-item`
- `POST /v1/jobs/start`
- `POST /v1/shop/purchase`

WebSocket events:
- `CombatTurnStarted`
- `CombatActionCommitted`
- `CombatActionResolved`
- `CombatRoundEnded`
- `CombatUnitReinforced`
- `InventoryItemMoved`
- `ShopStockRefreshed`

## Deployment Topology (Baseline)
- Reverse proxy/API gateway.
- App container replicas (monolith service).
- Managed PostgreSQL.
- Managed Redis.
- Object storage (art assets, static files).
- CDN for frontend build and media.

## Hosting Recommendation
Recommended for production: cloud-agnostic container deployment with managed Postgres/Redis.

Why this is preferred over self-hosted VPS at target scale:
- Easier horizontal scaling for combat bursts.
- Better managed backups and failover for data stores.
- Lower operational risk for patching, monitoring, and incident response.
- Faster environment cloning (staging/test/prod).
- Cleaner security posture via managed networking and secret tooling.

Where VPS can still be used:
- Early dev/staging prototypes.
- Cost-constrained pre-alpha environments.
- Non-critical tooling environments.

## Observability Baseline
- Structured logs with request and player correlation IDs.
- Metrics: active sessions, turn latency, websocket fanout, Redis hit ratio.
- Alerts: timer drift, combat resolution lag, DB saturation.

## Security Baseline
- Signed auth tokens with short TTL and refresh flow.
- Rate limiting on action submission endpoints.
- Server-side validation for all inventory/combat/economy actions.
- No trust in client-provided cooldowns or timer values.

