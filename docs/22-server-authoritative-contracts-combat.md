# Server-Authoritative Contracts Combat

## Purpose
Define the v1 contracts combat runtime used by the API and frontend playback flow.

## Lifecycle
REST endpoints:
- `GET /v1/contracts/board`
- `POST /v1/contracts/slots/:slotId/start`
- `GET /v1/contracts/runs/:runId`
- `POST /v1/contracts/runs/:runId/claim-result`

Contract run states:
1. `traveling`
2. `ready_to_claim`
3. `claimed`

Flow:
1. Frontend loads the board from the API.
2. Starting a slot spends stamina immediately and creates a run with `travelEndsAt`.
3. The server pre-simulates the full fight and stores the final event log and reward outcome.
4. The frontend renders the authoritative travel timer.
5. After `travelEndsAt`, the frontend claims the result and receives the run snapshot, combat events, and any rewards.

## Board Defaults
- Slot count: `6`
- Availability windows:
  - `easy`: `35-90 min`
  - `medium`: `25-75 min`
  - `hard`: `20-60 min`
- Replenishment window after completion, expiry, or abandon:
  - level-based from `docs/data/contract_replenish_pacing_level_1_100.csv`
- Travel duration:
  - base duration from `docs/data/activity_pacing_level_1_100.csv`
  - tier adjusted by contract efficiency:
    - `low_cost = 0.7x`
    - `standard_cost = 1.0x`
    - `high_cost = 1.3x`

## Combat Model
Contracts combat is playback-only auto-battle.

Scope:
- basic attacks only
- one player vs one to three monsters
- no active skills
- no status effects
- no healing, buffs, debuffs, or reactive effects

### Turn Scheduling
- `initiative` is `combatSpeed`
- `actionCost = 1000`
- each actor tracks `nextActionAt`
- after every resolved action:
  - `nextActionAt += actionCost / combatSpeed`
- next actor is the alive actor with the smallest `nextActionAt`
- ties break by:
  1. higher `combatSpeed`
  2. stable actor id

### Targeting
- player and monsters use auto basic attack only
- focus target is the legal enemy with the lowest current HP
- ties break by encounter order, then actor id

### Extra Attack Chains
- one action always starts with one guaranteed strike
- after each strike, roll `extraAttackChance`
- continue while the chain roll succeeds, up to `5` total strikes
- if a strike kills the target, remaining strikes retarget using the same focus policy

### Hit, Crit, Damage
Chance values use basis points.

Per strike:
- `hitChanceBps = clamp(2500, 9750, attacker.accuracy * 100 - target.dodgeChance)`
- crit uses the actor's `critChance`
- raw damage uses the actor's `minDamage` and `maxDamage`
- on crit:
  - `critDamage = round(rawDamage * critMultiplier / 10000)`

Damage kinds:
- `melee`
- `ranged`
- `spell`

Mitigation:
- melee: `raw - armor - physicalDefense`
- ranged: `raw - missileResistance - physicalDefense`
- spell: `raw - spellShield - magicDefense`
- successful hits always deal at least `2%` of the attacker's rolled damage, rounded down with a minimum of `1`
- final damage is `max(minimumChipDamage, raw - mitigation)`

### Battle End
- battle ends when one side has no alive actors
- winning side is reported through `CombatEnded`

## Monster Generation
Content sources:
- `docs/data/monster_families_v1.csv`
- `docs/data/monster_family_members_v1.csv`

Difficulty encounter level offsets:
- `easy`: player level `-1..0`
- `medium`: player level `+1..+2`
- `hard`: player level `+3..+4`

Encounter size:
- `easy`: `1-2`
- `medium`: `2`
- `hard`: `2-3`

Bias multiplier defaults:
- `low = 0.85`
- `medium = 1.0`
- `high = 1.15`

Boss multipliers:
- HP `x1.75`
- damage `x1.2`
- defenses `x1.2`

The server derives monster combat stats from a reference player curve using:
- family `base_level`
- member `main_stat`
- member `damage_kind`
- member `health_bias`
- member `damage_bias`
- member `armor_bias`
- member `spell_shield_bias`
- member `missile_resist_bias`
- member `initiative_bias`
- member `accuracy_bias`
- member `crit_bias`
- member `evasion_bias`
- monster outgoing damage is globally reduced to `60%` of the prior baseline

## Rewards
- stamina is spent on start
- stamina cost is level-based and rolled from one of three efficiency tiers:
  - `low_cost`
  - `standard_cost`
  - `high_cost`
- rewards are applied on `claim-result`, not on start
- loss grants no XP, ducats, or loot
- win grants XP, ducats, and optional single item loot

## Event Model
Combat event union:
- `CombatStarted`
- `CombatTurnStarted`
- `CombatActionResolved`
- `CombatActorDefeated`
- `CombatEnded`

`CombatActionResolved` contains a `strikes[]` array and no UI-owned text or animation metadata.
