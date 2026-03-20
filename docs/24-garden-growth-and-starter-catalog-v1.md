# Garden Growth and Starter Catalog v1

## Purpose
Define the first implemented Garden slice for Estate:
- `18` total plots
- `7` unlocked at start in a deterministic center-out pattern
- `5` starter plant families
- server-authoritative growth timers
- seed-only Garden inventory
- harvest timing that rewards bloom windows without adding care actions yet

This document intentionally describes the narrow runtime slice that exists before contracts seed rewards, slot unlocks, and refinery seed conversion are implemented.

## Scope
Included in Garden v1:
- `18` total plots with `7` visible and usable at start
- starter seed bootstrap on first Garden load
- planting, harvesting, and clearing wilted crops
- countdown and progress display for each phase
- ingredient persistence for future refinery use

Explicitly deferred:
- watering, pruning, blight, or other care actions
- seed rewards from contracts or jobs
- refinery recipes that turn plants back into seeds
- a dedicated harvested-ingredient inventory panel

## Lifecycle
Each planted crop moves through the same server-authored sequence:
1. `growing`
2. `pre_bloom`
3. `bloom`
4. `post_bloom`
5. `wilted`

Rules:
- planting stamps all phase timestamps up front
- `pre_bloom` and `post_bloom` award base yield
- `bloom` awards double yield
- `wilted` awards nothing and must be cleared before the plot can be reused
- the client may show local countdowns, but the API remains the source of truth

## Plot Baseline
- fixed slot count: `18`
- `7` slots unlocked at start
- initial unlocked shape is `2` center-top, `3` center-middle, `2` center-bottom
- additional unlocks expand from the middle outward in a deterministic order
- empty plots can be selected, then seeded from the Garden inventory panel
- Garden inventory contains seed stacks only

## Starter Catalog

| Plant | Rarity | Seed item code | Ingredient item code | Growth | Pre-bloom | Bloom | Post-bloom | Base yield | Bloom yield | Refinery recipe references |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| Bloodleaf | common | `seed_bloodleaf` | `ingredient_bloodleaf` | `90s` | `30s` | `60s` | `60s` | `2` | `4` | Field Tonic, Healing Potion, Warden's Draft |
| Fenroot | common | `seed_fenroot` | `ingredient_fenroot` | `120s` | `30s` | `60s` | `60s` | `2` | `4` | Field Tonic |
| Ironbloom | common | `seed_ironbloom` | `ingredient_ironbloom` | `150s` | `30s` | `60s` | `60s` | `2` | `4` | Warden's Draft, Hunter's Draft, Bulwark Distillate |
| Duskmint | common | `seed_duskmint` | `ingredient_duskmint` | `180s` | `30s` | `60s` | `60s` | `2` | `4` | Healing Potion, Hunter's Draft, Purge Philter |
| Kingsfoil | uncommon | `seed_kingsfoil` | `ingredient_kingsfoil` | `240s` | `30s` | `60s` | `60s` | `1` | `2` | Greater Healing Potion, Bulwark Distillate, Wardwash Tonic, Traveler's Distillate |

## Bootstrap Rules
On first Garden state load, the player receives:
- `18` garden plots, with `7` unlocked for immediate use
- `999` seeds of each starter plant

This is a development-friendly bootstrap and not the final acquisition model.

## UI Baseline
The Estate -> Garden panel is split into two sections:
- left: the live plot grid with phase, progress, and next milestone countdown
- right: the seed inventory, styled after the existing inventory panel but limited to seeds

Each plot card should show:
- slot label
- plant name or empty-state label
- current phase badge
- progress bar
- next transition countdown
- bloom double-yield callout when relevant
- `Harvest` or `Clear` action when relevant

## Data Source
`docs/data/garden_plants_v1.csv` is the Garden v1 source of truth.

It is converted by `tools/generate_garden_catalog.mjs` into the shared runtime catalog consumed by API and web.

## Follow-Up Work
- replace starter bootstrap with contract/job seed sources
- introduce seed conversion recipes in the Refinery
- add additional herbs beyond the starter five
- add plot progression and care actions
- decide whether harvested ingredients need a dedicated Estate inventory surface
