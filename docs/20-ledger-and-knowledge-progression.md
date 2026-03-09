# Ledger And Knowledge Progression

## Purpose
Define `Ledger` as a long-tail discovery and knowledge-progression system.

In v1, Ledger focuses on monsters:
- discovering zones and the enemies that inhabit them
- tracking encounter and kill history
- surfacing lore and battlefield knowledge
- granting modest passive bonuses against known threats

The name is intentionally broad so the system can later expand beyond monsters to other domains such as equipment.

## Design Intent
- Ledger should reward encounter history and repeated play without feeling mandatory in the early game.
- It should make the world feel more discovered over time.
- It should combine collection, flavor, and light power progression in one readable system.
- It should support both individual monster identity and broader family knowledge.

## Scope v1
- Monster-only
- Grouped by location/zone
- Hidden until discovered through normal play
- Tracks slain counts
- Shows per-entry passive bonus information

## Naming
System name:
- `Ledger`

Rationale:
- simple
- broad enough for later expansion
- works for recorded kills, discovered knowledge, and categorized entries

## Core Fantasy
The player maintains a growing account record of known threats and accumulated battlefield knowledge. It is not just a bestiary for reading; it is a practical record of what the player has seen, fought, and learned to counter.

## Visibility Rules

### Zones
- Undiscovered locations/zones are not shown in the Ledger at all.
- A zone appears in the Ledger only after the player first accesses or encounters content from that zone.

### Monsters
- Undiscovered monsters are not shown inside a zone.
- A monster entry is added only after the player first encounters that monster in gameplay.
- Once added, the entry remains visible permanently for that account.

This structure makes the Ledger feel like earned discovery rather than a spoiled encyclopedia.

## Organization
Ledger should be organized:
1. by discovered zone
2. then by monsters discovered within that zone

Possible future extension:
- secondary grouping by monster family
- filtering by family, rarity, or boss status

## Entry Creation Rules

### On First Encounter
When a player first encounters a monster:
- add the monster to the Ledger
- reveal its portrait
- reveal its name
- reveal its flavor text
- initialize slain count
- show current bonus against that monster or its family

### On Kill
When the player defeats a monster:
- increment slain count
- evaluate kill-count milestones
- update associated passive bonus progression if applicable

## Ledger Entry Content
Each v1 monster entry should show:
- monster portrait
- monster name
- flavor text
- number slain
- current passive bonus versus that monster type or family

Recommended optional future fields:
- family
- zone
- elite/boss marker
- discovered traits or combat notes
- drop hints

## Bonus Structure
The Ledger should grant modest passive bonuses based on knowledge depth.

### Recommended Rule
Use family-based bonuses as the primary backend progression, even if the UI also shows the individual monster entry.

Why:
- easier to balance
- easier to maintain
- reduces excessive fragmentation
- makes repeated encounters across related monsters feel cumulative

### Example Model
- each monster kill contributes to its family record
- family milestones unlock small passive bonuses
- individual monster pages display the currently active family bonus

Possible bonuses:
- bonus damage versus that monster family
- slight accuracy or crit improvement versus that family
- minor damage reduction versus that family

Recommended v1 choice:
- bonus damage versus that family only

This keeps the system clear and easy to explain.

## Power Guardrails
- Ledger bonuses should remain modest.
- Ledger should feel rewarding over months of play, not required in the first week.
- Ledger should not create large gaps between new and veteran accounts.
- Bonuses should complement gear and stats, not replace them.

## Discovery Loop
High-level loop:
1. unlock or enter a new zone
2. encounter a new monster
3. monster is added to Ledger
4. defeat monsters repeatedly
5. increase slain counts
6. unlock small family-based combat bonuses
7. continue filling out the account record over time

## Why This Works
- gives long-tail value to repeat monster kills
- makes zones feel discoverable instead of static lists
- adds collection motivation without requiring rare-drop obsession only
- creates light metaprogression tied directly to played content

Discovery quality depends on roster contrast:
- zones work better when their monster lists mix clearly different silhouettes, postures, and behaviors rather than mostly minor variants of one creature body plan
- good zone composition usually includes:
  - core inhabitants
  - local fauna, vermin, or parasites
  - one apex or setpiece threat that changes the visual fantasy of the zone
- this keeps new Ledger entries readable, memorable, and worth uncovering

## UI Principles
- hidden content should remain hidden until discovered
- once revealed, the entry should feel clean and information-dense
- zone grouping should make the world feel geographically grounded
- slain count and active bonus should be immediately readable

Recommended entry layout:
- portrait at top or left
- name and flavor text beside or below portrait
- slain count as a clearly labeled stat line
- current bonus line beneath it

## Future Expansion
Ledger is intentionally broader than a bestiary.

Future expansions could include:
- equipment records
- material records
- boss trophy pages
- drop history notes
- regional completion tracks

## Recommendation
Implement Ledger in v1 as:
- a hidden-until-discovered monster compendium
- grouped by discovered zones
- populated by first encounter
- advanced by kill counts
- granting modest family-based passive bonus damage

This gives the game:
- a discovery loop
- a collection loop
- a readable long-tail progression layer
- a reason to revisit and fully clear monster families over time
