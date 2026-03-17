# Consumables and Apothecary Balance v1

## Purpose
Define a concrete v1 consumables design for Ebonkeep that:
- keeps early-game potion play simple
- expands herb and potion variety across level bands
- uses exactly `3` ingredients per recipe
- requires exactly `2` ingredients from the Apothecary Garden
- requires exactly `1` ingredient from contracts, missions, shops, or elite drops
- creates meaningful resource-allocation tension instead of linear "craft best potion" behavior

This document extends the Garden and Stillroom foundation in [16-non-combat-progression-systems.md](./16-non-combat-progression-systems.md).

## Core Assumptions
- Consumables are primarily potions, draughts, philters, and tonics.
- v1 consumption is out-of-combat or pre-run only.
- v1 contracts combat remains auto-battle with no manual in-fight potion button.
- `Prep` potions apply for the next `3` contracts unless otherwise stated.
- `Efficiency` potions use real-time duration in hours and are intentionally expensive.
- `Cleansing` may remove persistent afflictions that survive combat or provide short-run resistance to new afflictions.

## Families
Consumables are split into `4` families:
- `Recovery`: restores persistent health between contract runs.
- `Prep`: improves performance for the next `3` contracts.
- `Cleansing`: removes or resists persistent afflictions.
- `Efficiency`: improves session throughput for real-world time.

Design identity:
- `Recovery` is the default safety sink.
- `Prep` is the planned push option.
- `Cleansing` is the anti-friction answer to sticky penalties.
- `Efficiency` is a deliberate grind-window commitment.

## Recipe Structure
Every potion recipe uses:
- `2` Garden ingredients
- `1` Contract ingredient

This structure is locked for v1 to keep the Stillroom readable and to ensure contracts remain relevant to crafting.

## Scarcity Model
Use internal crafting-point values to tune recipe cost before final economy numbers:

| Ingredient class | Craft points |
|---|---:|
| common herb | `1.0` |
| uncommon herb | `1.5` |
| rare herb | `2.25` |
| common contract reagent | `1.25` |
| uncommon contract reagent | `2.0` |
| rare contract reagent | `3.25` |

Target total recipe budgets:

| Potion family | Target cost |
|---|---:|
| basic recovery | `3.25 - 4.25` |
| greater recovery | `5.0 - 6.0` |
| prep (`3` contracts) | `6.0 - 7.25` |
| cleansing | `5.25 - 7.0` |
| efficiency (`2h`) | `8.0 - 10.0` |

Balancing rule:
- a `3`-contract prep potion should cost more than `1` healing potion, but less than `3`
- an efficiency potion should feel expensive enough that players use it for a planned session, not as permanent upkeep

## Herb Progression
Keep early game simple, then widen the network.

### Level 1-14 Herbs

| Herb | Rarity | Role |
|---|---|---|
| Bloodleaf | common | primary recovery anchor |
| Fenroot | common | cheap early filler for recovery and utility |
| Ironbloom | common | basic prep and defense anchor |
| Duskmint | common | basic cleansing and control anchor |

Early-game rule:
- players should be able to understand the first 4 herbs without a wiki
- Bloodleaf should be the first obvious "healing herb"

### Level 15-29 Herbs

| Herb | Rarity | Role |
|---|---|---|
| Kingsfoil | uncommon | premium recovery and efficiency bridge |
| Emberbud | uncommon | offensive prep anchor |
| Shadecap | uncommon | advanced cleansing and anti-affliction herb |

### Level 30+ Herbs

| Herb | Rarity | Role |
|---|---|---|
| Gravebloom | rare | premium compound herb for cleansing and efficiency |
| Sunspike | rare | high-risk prep and rare efficiency herb |

## Contract Reagents

| Reagent | Rarity | Main use |
|---|---|---|
| Binder Salts | common | basic stillroom binding reagent |
| Ward Resin | uncommon | stable prep and greater recovery |
| Black Ichor | uncommon | cleansing and affliction-related brews |
| Aether Catalyst | rare | efficiency and top-end compounds |

Distribution intent:
- easy contracts: mostly `Binder Salts`
- medium contracts: `Binder Salts` plus regular `Ward Resin`
- hard contracts: `Ward Resin`, `Black Ichor`, and occasional `Aether Catalyst`
- elite/boss/event content: better odds for `Aether Catalyst`

## Persistent Afflictions
`Cleansing` becomes strategically important once contracts can leave behind persistent penalties.

Recommended v1 afflictions:

| Affliction | Effect | Default duration |
|---|---|---|
| Open Wound | `-15%` max HP until cleansed or rested | persistent |
| Cracked Guard | `-12%` total defense effectiveness | next `3` contracts |
| Battle Fatigue | `+1` stamina cost on next `3` contracts | next `3` contracts |
| Hex Mark | `-10%` accuracy and crit reliability | next `3` contracts |

Guardrails:
- only medium/hard contracts should apply afflictions regularly
- players should rarely carry more than `2` persistent afflictions
- resting should clear weaker afflictions for ducats, so cleansing is efficient rather than mandatory

## Potion Unlock Schedule
Add potion breadth gradually as herb breadth increases.

### Level 1-14 Potions

| Potion | Family | Ingredients | Effect |
|---|---|---|---|
| Field Tonic | recovery | Bloodleaf + Fenroot + Binder Salts | restore `22%` missing HP |
| Healing Potion | recovery | Bloodleaf + Duskmint + Binder Salts | restore `35%` missing HP |
| Warden's Draft | prep | Ironbloom + Bloodleaf + Binder Salts | `+defense` for next `3` contracts |
| Hunter's Draft | prep | Ironbloom + Duskmint + Binder Salts | `+accuracy / crit chance` for next `3` contracts |

Early-game goals:
- `Healing Potion` is the first obvious staple
- only `2` prep variants exist at first
- cleansing and efficiency are not front-loaded on new players

### Level 15-29 Potions

| Potion | Family | Ingredients | Effect |
|---|---|---|---|
| Greater Healing Potion | recovery | Bloodleaf + Kingsfoil + Ward Resin | restore `60%` missing HP |
| Emberwake Draft | prep | Ironbloom + Emberbud + Ward Resin | `+damage / crit damage` for next `3` contracts |
| Bulwark Distillate | prep | Ironbloom + Kingsfoil + Ward Resin | stronger defensive prep for next `3` contracts |
| Purge Philter | cleansing | Duskmint + Shadecap + Black Ichor | remove `1` affliction immediately |
| Wardwash Tonic | cleansing | Duskmint + Kingsfoil + Ward Resin | resist next affliction for `3` contracts |

Mid-game goals:
- introduce the first real resource conflict between recovery, prep, and cleansing
- Kingsfoil should feel painful to spend because it serves more than one family

### Level 30+ Potions

| Potion | Family | Ingredients | Effect |
|---|---|---|---|
| Vigorous Restorative | recovery | Bloodleaf + Gravebloom + Aether Catalyst | restore `85%` missing HP and clear `Open Wound` |
| Sunspike Elixir | prep | Emberbud + Sunspike + Ward Resin | strongest offensive prep for next `3` contracts |
| Graveward Elixir | prep | Ironbloom + Gravebloom + Black Ichor | hybrid defense and affliction resistance for next `3` contracts |
| Hexcleanse Phial | cleansing | Shadecap + Gravebloom + Black Ichor | remove all non-boss afflictions |
| Traveler's Distillate | efficiency | Kingsfoil + Gravebloom + Aether Catalyst | `2h` travel reduction + small contract stamina efficiency |
| Contractor's Resolve | efficiency | Emberbud + Sunspike + Aether Catalyst | `2h` reward efficiency for long sessions |

Late-game goals:
- efficiency becomes a meaningful investment
- premium recovery competes directly with premium efficiency
- prep variety increases without making early game noisy

## Prep Potion Variance
Prep should not be one generic "battle potion" line.

Recommended prep subtypes:
- `defensive prep`: armor, shield, resistance, survivability
- `precision prep`: hit rate, crit chance, crit damage
- `tempo prep`: initiative, extra attack chance, turn pacing
- `hybrid prep`: moderate defense plus affliction resistance

Important rule:
- each account may have only `1` active prep potion at a time
- prep effects do not stack by subtype
- consuming a new prep potion replaces the current one

## Efficiency Design
Efficiency potions should feel different from normal prep.

Rules:
- duration is real-time, default `2h`
- effect persists offline and online
- only `1` efficiency potion may be active at a time
- efficiency effects do not stack

Recommended efficiency effects:
- reduced travel duration
- small stamina efficiency on contracts
- small boost to contract ducats or materials
- no direct XP bonus in v1

Reasoning:
- XP potions quickly become mandatory-feeling
- contract-focused efficiency better fits the project’s timer-and-session identity

## Resource-Allocation Tension Map
The potion economy should be intentionally overlapping.

Key bottlenecks:
- Bloodleaf is shared by early recovery and early defense prep
- Duskmint is shared by Healing Potion and cleansing
- Kingsfoil is shared by Greater Healing, Bulwark Distillate, and Traveler's Distillate
- Gravebloom is shared by premium recovery, premium cleansing, and efficiency
- Aether Catalyst is reserved for the most expensive late-game choices

If the player wants:
- safe survival, they spend Bloodleaf
- hard push contracts, they spend Bloodleaf and Ironbloom instead of healing
- affliction protection, they spend Duskmint and Shadecap instead of throughput
- long grind sessions, they burn Kingsfoil and Gravebloom that could have become premium recovery

That overlap is the actual strategy game.

## Starting Economy Targets
First-pass targets for tuning:
- a fresh early player should craft `3-5` basic recovery potions from one strong harvest cycle or `1-2` prep batches, but not both
- a mid-game player should choose between steady Greater Healing stock and occasional cleansing / prep specialization
- a late-game player should not sustain permanent efficiency uptime without deliberate farming

Suggested pressure ratios:
- `1` Greater Healing Potion should feel roughly equal to `1.5` Healing Potions in raw survival value
- `1` prep potion with `3` charges should feel worth about `2` Healing Potions if the player can win cleanly
- `1` efficiency potion should cost roughly the same as `2` premium recovery crafts

## Anti-Degenerate Rules
- healing potions must not fully replace resting as a ducat sink
- prep should feel efficient, but not mandatory baseline upkeep
- cleansing should answer spikes of bad luck, not become a tax on every run
- efficiency should be expensive enough that casual check-ins usually skip it
- no potion family should be craftable in unlimited volume from one dominant herb

## Recommended First Implementation Cut
Implement in this order:
1. Recovery potions
2. Prep potions with `3` charges
3. Persistent afflictions plus cleansing
4. Efficiency potions

This preserves early-game clarity while keeping the full system direction intact.

## Defaults Chosen
- `3` ingredients per recipe, locked
- `2` herbs from Garden + `1` contract reagent, locked
- `4` potion families, locked
- prep duration: next `3` contracts
- efficiency duration: `2h`
- no in-combat manual potion use in v1
- more herbs and recipes unlock as level bands rise
