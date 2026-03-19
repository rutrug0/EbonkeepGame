# Non-Combat Progression Systems

## Purpose
Define a player-input-driven non-combat layer that:
- fills downtime between contracts, missions, arena, and other timers
- creates additional economy sinks and sources
- supports consumable preparation, refinement, and long-tail gear optimization
- adds strategic account planning without requiring direct combat

This document defines three connected systems:
- Garden
- Refinery
- Forge

## Design Intent
- These systems should feel like meaningful side progression, not idle filler.
- They should reward short check-ins and planning rather than long continuous sessions.
- They should create different decision textures from combat.
- They should support combat preparation without replacing combat as the primary reward engine.
- They must avoid strong pay-to-win optics and avoid casino-style failure punishment.

## System Relationship Summary
High-level flow:
1. Missions, contracts, shops, and events supply seeds, raw materials, reagents, and tempering inputs.
2. Garden grows botanical ingredients over time.
3. Refinery consumes garden harvests, raw materials, monster reagents, and item-focused materials through recipes. Some recipes are instant; others run as timed jobs.
4. Forge consumes refined components and tempering materials to improve equipped items through tempering and future item-improvement actions.

## Why These Three Systems Fit Together
- Garden gives an active check-in loop.
- Refinery provides one readable place for consumable crafting and material processing.
- Forge gives a high-tension optimization sink for the outputs of the other systems.

Together they add:
- downtime play
- prep-focused strategy
- account specialization decisions
- repeatable non-combat rewards

## Core Loop Placement
These systems sit beside the main combat loop rather than replacing it.

Example 5-minute session:
- claim finished refinery jobs
- check or harvest planted crops
- craft 1-2 consumables in the refinery
- queue one new timed recipe
- run one contract or mission

Example 15-minute session:
- harvest mature plots
- craft a fresh batch of consumables
- queue new material refinement
- attempt one forge action
- spend stamina in missions

## Unlock Philosophy
- Garden unlocks early to teach check-in behavior.
- Refinery unlocks immediately with or shortly after the garden so harvested plants have a clear first use.
- Forge unlocks later, after the player has stable equipment turnover and understands item rarity and value.

Suggested unlock pacing:
- Garden: early game
- Refinery: early game, same feature band as garden
- Forge: mid game

## 1. Garden

### Role
Grow biological ingredients used by Refinery recipes for consumables, catalysts, and future gear-support formulas.

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
- immediate needs versus stockpiling for later refinery use

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
- refinery seed conversion recipes

See [24-garden-growth-and-starter-catalog-v1.md](./24-garden-growth-and-starter-catalog-v1.md) for the concrete starter timing and catalog defaults that match the current implementation slice.

## 2. Refinery

### Role
Operate the single recipe station for turning plants, raw materials, monster reagents, and item-focused materials into consumables, refined components, and gear-support items.

### Interaction Model
The Refinery is one panel with recipe families rather than multiple specialized stations.

Recipe modes:
- `Instant recipes`: direct consumables and simple compounds crafted immediately.
- `Timed recipes`: bulk processing and premium support materials that resolve through limited job slots.

This keeps the system:
- readable as one place for refinement
- flexible enough for both fast consumable prep and background progression
- easier to teach than splitting the loop across multiple surfaces

### Fantasy
The refinery is a practical preparation and processing station with presses, trays, stills, and work surfaces for turning gathered materials into usable goods.

### Player Actions
- choose a recipe family such as consumables, materials, or gear support
- spend harvested ingredients, raw materials, or reagents
- craft instant recipes or queue timed recipes
- choose which limited timed slots to occupy
- decide whether to spend scarce inputs on immediate consumables or long-tail item support
- claim completed timed jobs

### Inputs
- garden harvests
- ore
- wood
- hides
- cloth
- mission-dropped reagents
- monster remains
- resin
- salts
- botanical byproducts
- tempering support materials

### Outputs
Suggested recipe families:
- healing draughts
- stamina tonics
- offensive buffs
- defensive buffs
- cleansing / antidote consumables
- contract efficiency consumables
- metal ingots
- treated leather
- prepared timber
- powders
- extracts
- catalysts
- stabilizers
- binding agents
- polishing oils, quenching salts, and future reforging aids

### Timer Model
- only timed recipes consume a slot
- each timed recipe has a completion timer
- instant recipes resolve immediately
- better timed recipes take longer
- timed slots are limited

This creates useful tradeoffs:
- one long rare refinement
- several fast common refinements
- immediate consumable prep now versus better item support later

### Recipe Rules
- recipes should be clear one-step or two-step conversions
- consumable recipes should stay curated and understandable at a glance
- material recipes should focus on refinement, not full equipment crafting
- some recipes should feed tempering directly
- some recipes should prepare components for future reforge-style item systems

### Strategic Layer
Player choices should include:
- spending garden harvests on immediate consumables or on higher-tier compounds
- refining for immediate consumable support
- refining for future tempering attempts
- refining scarce rare materials now versus waiting for better gear

### Progression Hooks
- more recipe unlocks
- more timed recipe slots
- faster timed completion
- lower input waste
- chance for bonus output
- access to advanced stabilizers, catalysts, and future reforging aids

## 3. Forge

### Role
Equipment-improvement building for players who want controlled-risk progression on chosen equipment pieces.

### Positioning
The Forge should be:
- exciting
- high-tension
- materially expensive
- optional for optimization

It should not be:
- mandatory for baseline progression
- item-destructive
- directly monetized as raw power

### Fantasy
The player brings favored gear to the forge for controlled enhancement using refined materials and stabilizing agents.

### Core Actions
The Forge should begin with:
- tempering
- stabilization

The Forge may later expand into:
- reforging
- socketing or rune-setting
- affix-directed refinement

### Tempering
Tempering is the Forge's primary v1 mechanic.

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
- stabilizers from the refinery restore or protect stability

This creates a secondary planning layer:
- raw push for power now
- or spend more materials to preserve item integrity

### Inputs
- base equipment
- tempering stones or similar core material from missions/contracts
- stabilizers from the refinery
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
- claim finished jobs
- craft supplies
- attempt one forge action

## Economy Role

### New Sources
- seeds
- raw crafting materials
- refinement materials
- tempering materials

### New Sinks
- ducats for recipes, jobs, and tempering attempts
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
- extra refinery timed slot within a cap
- cosmetic skins for the garden and refinery

## Recommended First Iteration Scope
Keep v1 focused.

### Garden v1
- `5` fixed plots
- `5` starter plant families
- no care actions yet
- low to moderate recipe complexity downstream

### Refinery v1
- `8-12` consumable recipes
- `10-15` material and support recipes
- mixed instant and timed recipe model
- `2-3` timed job slots
- no recipe minigame

### Tempering v1
- bounded enhancement range
- `3` stability modes
- recoverable failures only
- no item destruction

## Open Questions
- Should the garden use individual plot care or account-wide daily care actions?
- How much of the Refinery should be instant versus timed in the first live version?
- How much overlap should exist between Refinery outputs and future gear crafting or reforging systems?
- Should tempering apply only to weapons and armor, or also jewelry later?
- Should cache rewards feed seeds and tempering materials directly?

## Recommendation
Adopt these three systems as one connected non-combat progression layer:
- Garden for cultivation
- Refinery for consumables and material recipes
- Forge for controlled-risk gear optimization

This gives Ebonkeep:
- a strong downtime activity loop
- better consumable identity
- a richer material economy
- a high-tension optimization system with player agency

Most importantly, it adds meaningful play between combat actions without turning the game into a pure idle timer stack or a pure combat treadmill.
