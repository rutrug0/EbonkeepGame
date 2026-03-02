# Ebonkeep Planning Docs Index

## Purpose
This document set defines the high-level, implementation-ready blueprint for Ebonkeep's v1 (PvE-first) launch.

## Scope Baseline
- Web-first game client.
- Deployment wrappers: Steam (Electron), Android (Capacitor).
- Backend: TypeScript modular monolith.
- Datastores: PostgreSQL + Redis.
- Realtime: WebSocket primary, REST secondary.
- MVP focus: PvE progression/economy; PvP and clans in v2 appendix only.

## Document Map
1. [01-product-pillars-and-scope.md](./01-product-pillars-and-scope.md)
2. [02-technical-architecture.md](./02-technical-architecture.md)
3. [03-platform-wrappers-and-release.md](./03-platform-wrappers-and-release.md)
4. [04-gameplay-core-loop.md](./04-gameplay-core-loop.md)
5. [05-combat-system-spec-high-level.md](./05-combat-system-spec-high-level.md)
6. [06-progression-itemization-and-economy.md](./06-progression-itemization-and-economy.md)
7. [07-balance-and-scaling-tables.md](./07-balance-and-scaling-tables.md)
8. [08-ui-ux-and-art-direction.md](./08-ui-ux-and-art-direction.md)
9. [09-liveops-and-content-cadence.md](./09-liveops-and-content-cadence.md)
10. [10-v2-appendix-pvp-and-clans.md](./10-v2-appendix-pvp-and-clans.md)
11. [11-item-affix-scaling-table.md](./11-item-affix-scaling-table.md)
12. [12-passive-training-and-ducat-scaling.md](./12-passive-training-and-ducat-scaling.md)
13. [13-experience-requirements-scaling.md](./13-experience-requirements-scaling.md)
14. [14-warrior-melee-weapon-tables.md](./14-warrior-melee-weapon-tables.md)
15. [15-contracts-board-and-refresh-mechanics.md](./15-contracts-board-and-refresh-mechanics.md)
16. [17-armor-name-range-tables.md](./17-armor-name-range-tables.md)
17. [18-jewelry-name-range-tables.md](./18-jewelry-name-range-tables.md)
18. [dev-setup.md](./dev-setup.md)
19. [local-runtime.md](./local-runtime.md)

## Decision Log (Locked)
Date: 2026-02-28

- Product depth: strategic overview with implementation defaults.
- Monetization: cosmetic + convenience.
- Combat baseline: synchronous turn-based hybrid (optional manual actions with server fallback).
- MVP scope: PvE-first grind model; no campaign.
- Stack: TypeScript web stack.
- Wrappers: Electron + Capacitor.
- Backend shape: modular monolith.
- Scale target: 50k MAU, 5k DAU, 500 peak CCU.
- Theme: semi-dark broad-appeal fantasy (Elder Scrolls-adjacent).
- Art style: 2D painted UI/item art.
- UX priority: desktop-first responsive.
- Progression: level + gear score.
- Pacing gates: hybrid timers + stamina.
- Data layer: PostgreSQL + Redis.
- Realtime transport: WebSocket primary.
- Hosting baseline: cloud-agnostic containers with managed data services.
- Auth model: platform-first login.
- Live-ops cadence: biweekly events.
- PvP docs scope: v2 appendix only.

## Public Interface Baseline
- REST: account, inventory, economy, and setup endpoints.
- WebSocket: combat timers, turn events, state deltas.
- Shared type contracts for class, stats, items, and combat events.

## Glossary
- MAU: Monthly Active Users.
- DAU: Daily Active Users.
- CCU: Concurrent users online at the same moment.
- Gear Score: aggregate weighted power value derived from equipped items.
- Timed Activity: action with server-side duration and completion timestamp.

## Ownership Map (Initial)
- Product scope and loop tuning: Game Design.
- Backend and data contracts: Engineering.
- UI flows and readability rules: UX/UI Design.
- Art direction and asset pipelines: Art.
- Live-ops cadence and event configuration: Design + Ops.
