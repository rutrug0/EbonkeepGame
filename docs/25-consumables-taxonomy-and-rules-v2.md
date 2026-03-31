# Consumables Taxonomy and Rules v2

## Purpose
Define the v2 consumables foundation for Ebonkeep with:
- a single taxonomy of `potions`, `tonics`, and `elixirs`
- CSV-backed source data for catalog entries and crafting recipes
- a fixed distillation ladder for every consumable
- canonical names and codes that line up with the Refinery runtime catalog

This document supersedes the old naming split of drafts, distillates, phials, and standalone restorative lines for the runtime catalog introduced in phase 1.

## Core Taxonomy
- `Potion`: instant out-of-combat consumable with an immediate effect
- `Tonic`: encounter-based consumable that lasts for the next `3` encounters
- `Elixir`: time-based consumable that lasts for `8h`

Later runtime behavior should allow:
- up to `3` active tonics at once
- up to `3` active elixirs at once
- unique families within each active category

Potions are intentionally separate from those active-slot rules because they resolve immediately.

## Distillation Rules
- every consumable has a base version plus `Distilled I` and `Distilled II`
- distillation is exact-item only
- `3x base -> Distilled I`
- `3x Distilled I -> Distilled II`
- only potions gain stronger effects from distillation
- tonics and elixirs keep the same effect values when distilled
- distillation does not increase tonic encounter count
- distillation does not increase elixir duration
- distillation costs time only and no ducats

Potion distillation targets:
- `Healing Potion`: `5% -> 15% -> 50%` max HP restore
- `Second Wind Potion`: `5% -> 15% -> 50%` max stamina restore

Crafting pressure:
- `Distilled I` recipes should take at least `45m`
- `Distilled II` recipes should take at least `2h`

## Crafting Rules
- base crafts use exactly `2` Garden ingredients and `1` contract reagent
- easy items anchor on starter herbs plus `Binder Salts`
- medium items anchor on `Kingsfoil`, `Emberbud`, and `Ward Resin`
- hard items anchor on `Shadecap`, `Gravebloom`, `Sunspike`, `Black Ichor`, and `Aether Catalyst`

Access targets:
- easy: Healing Potion, Second Wind Potion, Warden's Tonic, Hunter's Tonic
- medium: Emberwake Tonic, Berserker's Tonic, Bulwark Tonic, Wardwash Tonic, Deadeye Elixir, Traveler's Elixir, Contractor's Resolve Elixir
- hard: Ravager's Tonic, Sunspike Elixir, Graveward Elixir, Hexcleanse Tonic, Chronicler's Elixir, Warcaller's Elixir

## Canonical Catalog

### Potions
- `Healing Potion`: restore `5%` max HP at base, then `15%` and `50%` across distillation
- `Second Wind Potion`: restore `5%` max stamina at base, then `15%` and `50%` across distillation

### Tonics
- `Warden's Tonic`: armor plus physical defense
- `Hunter's Tonic`: accuracy plus crit chance
- `Emberwake Tonic`: damage plus crit multiplier
- `Berserker's Tonic`: crit chance plus extra attack chance
- `Bulwark Tonic`: stronger defense plus max HP
- `Wardwash Tonic`: affliction resistance plus magic defense
- `Hexcleanse Tonic`: clear `1` affliction immediately plus stronger affliction resistance for the next `3` encounters
- `Ravager's Tonic`: damage plus initiative for hard-opening pressure

### Elixirs
- `Sunspike Elixir`: long-session offensive boost
- `Graveward Elixir`: long-session defensive boost
- `Deadeye Elixir`: long-session precision boost
- `Traveler's Elixir`: lower travel duration plus lower contract stamina cost
- `Contractor's Resolve Elixir`: higher ducats gain plus small contract item drop bonus
- `Chronicler's Elixir`: higher XP gain
- `Warcaller's Elixir`: long-session damage plus extra attack pressure

## Legacy Mapping

| Legacy item | V2 canonical target |
|---|---|
| Field Tonic | Healing Potion distillation ladder |
| Greater Healing Potion | Healing Potion distillation ladder |
| Vigorous Restorative | Healing Potion distillation ladder |
| Warden's Draft | Warden's Tonic |
| Hunter's Draft | Hunter's Tonic |
| Emberwake Draft | Emberwake Tonic |
| Bulwark Distillate | Bulwark Tonic |
| Wardwash Tonic | Wardwash Tonic |
| Hexcleanse Phial | Hexcleanse Tonic |
| Traveler's Distillate | Traveler's Elixir |
| Contractor's Resolve | Contractor's Resolve Elixir |
| Purge Philter | retired from the initial canonical catalog |
| Soulbound Draught | retired from the initial canonical catalog |

## Source Files
- `docs/data/consumables_catalog_v2.csv`: canonical catalog rows and base effects
- `docs/data/consumable_recipes_v2.csv`: base craft and distillation recipe rows
- `docs/data/garden_plants_v1.csv`: starter-plant recipe references aligned to the renamed catalog
