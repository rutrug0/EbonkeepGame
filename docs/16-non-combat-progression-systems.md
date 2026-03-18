# Non-Combat Progression Systems

## Purpose
Define a player-input-driven non-combat layer that:
- fills downtime between contracts, missions, arena, and other timers
- creates additional economy sinks and sources
- supports consumable preparation and long-tail gear optimization
- adds strategic account planning without requiring direct combat

This document defines four connected systems:
- Apothecary Garden
- Stillroom
- Refinery Bench
- Tempering

## Design Intent
- These systems should feel like meaningful side progression, not idle filler.
- They should reward short check-ins and planning rather than long continuous sessions.
- They should create different decision textures from combat.
- They should support combat preparation without replacing combat as the primary reward engine.
- They must avoid strong pay-to-win optics and avoid casino-style failure punishment.

## System Relationship Summary
High-level flow:
1. Missions, contracts, shops, and events supply seeds, raw materials, reagents, and tempering inputs.
2. Apothecary Garden grows botanical ingredients over time.
3. Stillroom converts harvested ingredients into consumables instantly.
4. Refinery Bench processes raw materials through timed workshop orders into refined components.
5. Tempering consumes refined components and tempering materials to improve equipped items through a controlled-risk enhancement loop.

## Why These Four Systems Fit Together
- Apothecary Garden gives an active check-in loop.
- Stillroom provides immediate payoff after planning and harvesting.
- Refinery Bench provides timer-driven background progression.
- Tempering gives a high-tension optimization sink for the outputs of the other systems.

Together they add:
- downtime play
- prep-focused strategy
- account specialization decisions
- repeatable non-combat rewards

## Core Loop Placement
These systems sit beside the main combat loop rather than replacing it.

Example 5-minute session:
- claim workshop orders
- water or tend planted crops
- craft 1-2 consumables in the stillroom
- start a new refinery order
- run one contract or mission

Example 15-minute session:
- harvest mature plots
- craft a fresh batch of consumables
- queue new material refinement
- attempt one tempering action
- spend stamina in missions

## Unlock Philosophy
- Apothecary Garden unlocks early to teach check-in behavior.
- Stillroom unlocks immediately with or shortly after the garden.
- Refinery Bench unlocks after the player has enough mission/contract materials to understand resource conversion.
- Tempering unlocks later, after the player has stable equipment turnover and understands item rarity/value.

Suggested unlock pacing:
- Garden: early game
- Stillroom: early game, same feature band as garden
- Refinery Bench: early-mid game
- Tempering: mid game

## 1. Apothecary Garden

### Role
Grow biological ingredients used for consumables and selected refinement recipes.

### Fantasy
The player maintains a small cultivated plot of herbs, fungi, roots, and battlefield botanicals rather than a cheerful farm. The tone should remain semi-dark fantasy and practical rather than pastoral.

### Player Actions
- choose seeds to plant
- assign seeds to limited plots
- perform light upkeep actions while crops grow
- decide when to harvest
- decide whether to favor safe harvests or riskier growth outcomes

### Inputs
- seeds from missions
- seeds from contracts
- occasional shop stock
- event rewards
- rare seed drops from elite/boss content

### Outputs
- herbs
- fungi
- roots
- blossoms
- alchemical binders
- rare botanical reagents

### Plot Rules
- limited plot count at account baseline
- different plants have different growth times
- different plants have different care requirements
- some plants are low-yield but reliable
- some plants are higher-yield but more failure-prone

### Care Model
The care loop should be light, not a full farming simulator.

Recommended care actions:
- water
- prune
- turn soil
- apply nutrient mix
- protect from blight/pests

Rules:
- plants do not need constant babysitting
- missing a care window reduces yield or quality rather than deleting the crop outright
- rare plants may have stricter timing windows

### Strategic Layer
Player choices should include:
- fast-growth common herbs versus slow rare ingredients
- raw healing-focused crops versus buff-focused crops
- reliable volume versus risky premium ingredients
- immediate needs versus stockpiling for later stillroom use

### Failure / Friction
- crop neglect reduces output quality
- blight may convert a crop into lower-tier residue rather than full loss
- some plants can overgrow and become less efficient if left unharvested too long

### Progression Hooks
- more plots
- better soil beds
- reduced blight chance
- improved yield
- access to higher-tier seed families

### Garden v1 Runtime Baseline
The first implemented Garden slice is intentionally narrower than the long-term design above.

Garden v1 uses:
- `5` fixed plots available immediately
- `5` starter plants: Bloodleaf, Fenroot, Ironbloom, Duskmint, Kingsfoil
- seed-only Garden inventory with starter bootstrap on first load
- server-authored phase timers for `growing`, `pre_bloom`, `bloom`, `post_bloom`, and `wilted`
- harvest timing where bloom grants double yield and wilted crops must be cleared

Garden v1 does not yet include:
- care actions such as watering, pruning, or blight response
- plot unlock progression
- contracts/jobs seed sourcing
- apothecary seed conversion recipes

See [24-garden-growth-and-starter-catalog-v1.md](./24-garden-growth-and-starter-catalog-v1.md) for the concrete starter timing and catalog defaults that match the current implementation slice.

## 2. Stillroom

### Role
Craft consumables instantly from prepared botanical ingredients and selected refined materials.

### Fantasy
The stillroom is the player's preparation station for draughts, tonics, salves, catalysts, and battlefield mixtures.

### Why Instant Crafting Works
The Garden already provides time tension. The Stillroom should feel like payoff, not another timer wall.

### Player Actions
- choose a recipe
- spend harvested ingredients
- craft immediately
- decide whether to consume ingredients now or save for rarer recipes

### Inputs
- garden harvests
- selected refined outputs from the refinery bench
- mission-dropped reagents
- monster parts for advanced recipes

### Outputs
Suggested categories:
- healing draughts
- stamina tonics
- offensive buffs
- defensive buffs
- cleansing / antidote consumables
- contract efficiency consumables
- mission prep consumables

### Recipe Design Rules
- keep recipe count curated
- recipes should be understandable at a glance
- higher-tier consumables should compete for overlapping ingredients
- avoid allowing players to mass-produce too many categories at once

### Good Strategic Tension
- craft broadly useful common items now
- save rare reagents for higher-impact mission runs
- convert rare harvests into fewer strong consumables or more weak consumables

### Progression Hooks
- more recipe unlocks
- improved output quantity on selected recipes
- reduced ingredient cost on lower-tier consumables
- unlocks for advanced compound consumables

## 3. Refinery Bench

### Role
Process raw materials through timed workshop orders into refined components used by crafting, tempering, and future support systems.

### Interaction Model
The player does not craft every item manually. Instead, they place orders that complete after a fixed timer.

This keeps the system:
- strategic
- timer-friendly
- distinct from the instant Stillroom

### Fantasy
The refinery bench is a practical workshop station for processing battlefield spoils and gathered materials into usable refined goods.

### Player Actions
- select a recipe/order
- allocate raw materials
- choose which limited order slot to occupy
- decide whether to spend slots on fast utility outputs or long premium outputs
- claim completed orders

### Inputs
- ore
- wood
- hides
- cloth
- monster remains
- resin
- salts
- botanical byproducts

### Outputs
Recommended refinement families:
- metal ingots
- treated leather
- prepared timber
- powders
- extracts
- catalysts
- stabilizers
- binding agents

### Timer Model
- each order consumes a slot
- each order has a completion timer
- better recipes take longer
- order slots are limited

This creates useful tradeoffs:
- one long rare refinement
- several fast common refinements

### Recipe Rules
- recipes should be clear one-step or two-step conversions
- the bench should focus on refinement, not full end-item crafting
- some stillroom recipes should require refinery outputs
- tempering should require selected refinery outputs

### Strategic Layer
Player choices should include:
- refining for immediate consumable support
- refining for future tempering attempts
- refining scarce rare materials now versus waiting for better gear

### Progression Hooks
- more order slots
- faster order completion
- lower input waste
- chance for bonus output
- access to advanced stabilizers and catalysts

## 4. Tempering

### Role
Optional item enhancement system for players who want controlled-risk progression on chosen equipment pieces.

### Positioning
Tempering should be:
- exciting
- high-tension
- materially expensive
- optional for optimization

It should not be:
- mandatory for baseline progression
- item-destructive
- directly monetized as raw power

### Fantasy
The player reinforces or tempers favored gear through controlled enhancement attempts using refined materials and stabilizing agents.

### Enhancement Model
Recommended structure:
- enhancement tiers from `+0` upward in a short bounded range
- low tiers are safe or nearly safe
- higher tiers introduce meaningful risk
- gains remain meaningful but not runaway

Suggested pacing model:
- `+1` to `+3`: safe or highly reliable
- `+4` to `+5`: risky, recoverable, aspirational

### Stability Control
This is the key twist that makes the system feel strategic rather than pure gambling.

Each tempering attempt asks the player to choose a control mode:
- `Steady Temper`
- `Balanced Temper`
- `Volatile Temper`

Recommended behavior:

`Steady Temper`
- highest success chance
- smallest improvement outcome profile
- lightest failure penalty

`Balanced Temper`
- medium success chance
- standard outcome profile
- moderate failure penalty

`Volatile Temper`
- lowest success chance
- highest upside or strongest advancement profile
- harshest recoverable failure penalty

This gives agency instead of a single blind roll.

### Failure Rules
Avoid item destruction.

Recommended failure results:
- materials consumed
- stability reduced
- temporary instability added
- chance to drop one enhancement step at higher levels

Recommended non-results:
- no permanent deletion of the item
- no full reset to zero by default

### Stability Resource
Each item should track a stability state or instability meter.

Possible model:
- every item has a hidden or visible stability value
- failed attempts lower stability
- low stability worsens future odds or blocks volatile modes
- stabilizers from the refinery bench restore or protect stability

This creates a secondary planning layer:
- raw push for power now
- or spend more materials to preserve item integrity

### Inputs
- base equipment
- tempering stones or similar core material from missions/contracts
- stabilizers from refinery bench
- rare catalysts from harder content
- gold/ducat sink

### Outputs
- small stat increases
- visible prestige state on favored gear
- item attachment and long-tail chase value

### Guardrails
- cap the system at a modest tier range
- keep item rarity and affix quality more important than tempering alone
- ensure a well-rolled rare or epic item matters before tempering
- do not let tempering fully replace item hunt excitement

### Anti-Frustration Rules
- never destroy the item
- clearly surface odds and penalties
- allow players to farm stabilizers through gameplay
- keep low-tier tempering accessible

## Resource Ecosystem

### Missions
- seeds
- raw materials
- monster reagents
- tempering stones
- rare catalysts
- cache rewards

### Contracts
- steady lower-tier seeds
- common raw materials
- refinement support materials
- utility consumable ingredients

### Shops
- selected seed stock
- selected low-tier materials
- emergency consumable ingredients
- occasional refinement helpers

### Events
- unique seeds
- rare crafting ingredients
- advanced stabilizers
- cosmetic or prestige variants later

## Session Value
These systems should create valid activity when the player is:
- low on stamina
- waiting on contracts
- between PvP windows
- not in the mood for combat

They should also reinforce return behavior:
- check crop state
- claim finished orders
- craft supplies
- attempt one tempering action

## Economy Role

### New Sources
- seeds
- raw crafting materials
- refinement materials
- tempering materials

### New Sinks
- ducats for recipes, orders, and tempering attempts
- raw material consumption
- rare reagent consumption
- stabilizer consumption

### Why This Helps
- broadens the utility of mission rewards
- creates more reasons to value non-gear drops
- gives inventory and economy more texture than "combat then sell loot"

## Monetization Guardrails
- no premium-only enhancement success boosts for combat power
- no premium-only access to exclusive tempering tiers
- no premium skip that invalidates the gameplay loop
- convenience acceleration may exist later only if capped and non-mandatory

Acceptable future convenience examples:
- extra garden plot unlocks within a cap
- extra refinery order slot within a cap
- cosmetic skins for the garden/stillroom/workshop

## Recommended First Iteration Scope
Keep v1 focused.

### Apothecary Garden v1
- 3-4 plot types
- small seed pool
- simple care actions
- low to moderate recipe complexity

### Stillroom v1
- 8-12 consumable recipes
- instant crafting
- no recipe minigame

### Refinery Bench v1
- 2-3 order slots
- 10-15 refinement recipes
- single-timer completion model

### Tempering v1
- bounded enhancement range
- 3 stability modes
- recoverable failures only
- no item destruction

## Open Questions
- Should the garden use individual plot care or account-wide daily care actions?
- Should stillroom crafting remain always instant or gain a short batching option later?
- How much overlap should exist between refinement outputs and future gear crafting systems?
- Should tempering apply only to weapons and armor, or also jewelry later?
- Should cache rewards feed seeds and tempering materials directly?

## Recommendation
Adopt all four systems as one connected non-combat progression layer:
- Apothecary Garden for cultivation
- Stillroom for instant consumable crafting
- Refinery Bench for timed refinement orders
- Tempering for controlled-risk gear optimization

This gives Ebonkeep:
- a strong downtime activity loop
- better consumable identity
- a richer material economy
- a high-tension optimization system with player agency

Most importantly, it adds meaningful play between combat actions without turning the game into a pure idle timer stack or a pure combat treadmill.
