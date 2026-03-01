# Contracts Board and Refresh Mechanics

## Purpose
Define the v1 Contracts board loop used for timed activity selection, expiry pressure, and refill cadence.

## Terminology
- `contract`: a single available timed offer on the board.
- `contracts board`: the list of current available contracts.
- `replenishment`: cooldown period before a removed contract slot receives a new contract.

## Board Capacity and Availability
- Default maximum available contracts at one time: `6`.
- A contract remains available until its availability timer ends.
- When availability expires, the contract is removed from the board.

## Replenishment Rules
- When a contract expires, its slot starts a replenishment timer.
- Replenishment cooldown is random in the range `1-2 hours`.
- When cooldown ends, the slot receives a new contract and becomes available again.

## Early Abandon Rules
- Player may abandon an available contract at any time.
- Abandoning a contract removes it immediately.
- Abandon triggers replenishment immediately, using the same `1-2 hours` cooldown range.

## Contract Row Data Schema
Each available row must define:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name of the contract. |
| `difficulty` | enum | `easy`, `medium`, `hard`. |
| `experience_roll` | low/medium/high | Possible XP payout roll bands. |
| `ducats_roll` | low/medium/high | Possible ducats payout roll bands. |
| `materials_roll` | low/medium/high | Possible materials payout roll bands. |
| `item_drop_roll` | low/medium/high | Possible item drop chance roll bands. |
| `stamina_cost` | low/medium/high | Possible stamina spend roll bands. |
| `expires_at` | timestamp | End of availability window. |

## UI Requirements (v1 Web Stub)
- Contracts render as rows in a table-like list.
- Row must show all fields above, including low/medium/high values.
- Board should visibly show:
  - total available contracts,
  - slots currently replenishing,
  - time remaining until each replenishing slot returns.
- Expired and abandoned contracts should no longer appear in available rows.

## Design Intent
- Contracts create short-term decision pressure through expiry timers.
- Replenishment window enforces return cadence without forcing combat input.
- Stamina, timers, and board churn form a predictable planning loop for short sessions.
