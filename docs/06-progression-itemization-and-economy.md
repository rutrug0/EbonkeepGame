# Progression, Itemization, and Economy

## Progression Model
- Primary axes: account level + gear score.
- Level grants baseline stat growth and feature unlock pacing.
- Gear score controls encounter viability and upgrade chase.

## Classes
- Warrior; Counters rangers (bonus damage vs. them)
- Mage; Counters warriors (bonus damage vs. them)
- Ranger; Counters mages (bonus damage vs. them)
- Class-restricted armor archetypes:
  - Heavy armor: warrior only
  - Light armor: ranger only
  - Robes: mage only
- Class-restricted weapon archetypes:
  - Melee (`sword`, `axe`): warrior only
  - Arcane (`wand`, `staff`): mage only
  - Ranged (`sling`, `bow`): ranger only
- Universal equipables:
  - Jewelry: all classes
  - Vestiges: all classes

## Core Stats
- `strength`, `intelligence`, `dexterity`, `vitality`, `initiative`, `luck`.
- Derived stats:
- From strength:
* Melee damage (so this is for warriors only)
* Armor (flat damage reduction from melee attacks)
- From intelligence:
* Spell damage (mages only)
* Spell shield (flat damage reduction from spell damage)
- From dexterity:
* Ranged attack damage (rangers only)
* Missile resistance (flat damage reduction from ranged attack damage)
- From luck:
* Crit chance
* Crit damage
- From initiative:
* combat speed
* chance to extra attack
- From vitality:
* Max hitpoints
- Global uncapped main-stat damage rule:
* flat bonus damage = main offensive stat * 0.10
* strength for melee, intelligence for spell, dexterity for ranged


## Inventory and Equipment
- Inventory grid baseline: 8 columns x 6 rows.
- Item sizes: 1x1 (rings, amulets, vestiges), 1x2, 2x2, 2x3 (staves, axes, swords, bows).
- Equip slots: weapon, offhand, helm, chest, gloves, boots, amulet, ring1, ring2, vestige1, vestige2, vestige3.
- Vestige equip rule: up to 3 vestiges equipped at once; duplicate vestige names cannot be equipped simultaneously.
- Stash tabs:
  - Base: 1 tab free.
  - Additional tabs: monetized convenience expansion.

## Itemization
- Rarity tiers: Common, Uncommon, Rare, Epic.
- Major equipable categories:
  - Armor (`heavy`, `light`, `robe`)
  - Weapons (`melee`, `arcane`, `ranged`) with families:
    - melee: sword, axe
    - arcane: wand, staff
    - ranged: sling, bow
  - Jewelry
  - Vestiges
- Item fields:
  - item type
  - level requirement (will be same as item level)
  - base stat line
  - affix pool roll
  - prefix pool roll
  - computed item power score
- Drop identity favors class-relevant items with mixed universal drops.
- Common has no prefix or affix.
- Uncommon has prefix or affix.
- Rare has prefix and affix.
- Epic has prefix and affix. (Higher chance of higher level prefixes/affixes)
- Each prefix/affix roll have 3 rarity types (T1 up to T3), higher rarity means stronger prefix/affix bonus. 60% chance on each roll it will be T1, 30% T2, 10% T3.
- Prefix pool rolls are uniform: each eligible prefix has equal chance.
- Suffix pool rolls are uniform: each eligible suffix has equal chance.
- Affix scaling key tables (level 1-100) are defined in [11-item-affix-scaling-table.md](./11-item-affix-scaling-table.md).
- Backend-ready generated table lives at `docs/data/affix_scaling_level_1_100.csv`.

### Item Power Score Formula (Level 1-100)
- Goal: a single quick-glance number should track real weapon strength from item level, base-level range identity, rarity, and affix/suffix quality.
- Current ownership:
  - Weapon power: API-authoritative, damage-index based.
  - Armor/jewelry power: legacy level/rarity/tier formula (unchanged in this pass).

Weapon power model (damage-index based):
- Build post-rarity expected damage from weapon roll windows after base-level influence:
  - `expected_post_rarity = avg(avg(min_low, min_high), avg(max_low, max_high))`
- For each present affix/suffix, convert the rolled value to a damage-equivalent percent using tier ranges:
  - T1: `4%-8%`
  - T2: `10%-14%`
  - T3: `16%-20%`
  - `progress = clamp01((roll_value - roll_min) / (roll_max - roll_min))`
  - `affix_pct = tier_min + progress * (tier_max - tier_min)`
  - `affix_damage_equivalent = expected_post_rarity * affix_pct`
- Direct damage affixes (`melee_damage`, `ranged_damage`, `spell_damage`) add their damage-equivalent to rolled min/max:
  - `direct_delta = round(sum(direct_affix_damage_equivalent))`
  - `rolled_min += direct_delta`
  - `rolled_max += direct_delta`
- Final expected damage index:
  - `expected_final_damage = expected_post_rarity + sum(all_affix_damage_equivalent)`
- Final weapon power:
  - `weapon_power = round(expected_final_damage * weapon_power_scale_factor)`

Weapon power coefficients:
- Source: `docs/data/weapon_power_coefficients_v1.csv`
- Fields:
  - `weapon_power_scale_factor`
  - `t1_pct_min`, `t1_pct_max`
  - `t2_pct_min`, `t2_pct_max`
  - `t3_pct_min`, `t3_pct_max`

Affix cap semantics (weapon power and weapon roll contribution):
- Cap anchor: post-rarity expected damage baseline.
- Cap scope: per affix roll.
- T3 per-affix contribution maximum: `20%` of post-rarity expected damage.

Data contract (documentation-level, for backend/frontend alignment):
- `item_level`: integer in `[1, 100]`
- `weapon_base_level`: integer in `[0, 100]`
- `rarity`: `common | uncommon | rare | epic`
- `min_damage`: integer `>= 0` (after direct-damage affix injection)
- `max_damage`: integer `>= min_damage` (after direct-damage affix injection)
- `power`: integer `>= 0`, API-authoritative quick-glance score
- `affixes[]`: includes rolled `tier`, `stat`, `value`, and `unit`

## Vestiges
- Vestiges are equipable by all classes.
- Players can equip up to 3 vestiges at once.
- Current vestige names:
  - Vestige of the Ashen Sovereign
  - Vestige of the Hollow Star
  - Vestige of Silent Judgement
  - Vestige of the Gilded Seraph
  - Vestige of the Drowned Oracle
  - Vestige of Emberwake
  - Vestige of the Veiled Matron
  - Vestige of Black Meridian
  - Vestige of the Iron Revenant
  - Vestige of Pale Dominion
  - Vestige of the Umbral Thorn
  - Vestige of First Light
- Vestige bonuses are TBD.
- Planned extension: vestige enchanting to strengthen bonuses later.

## Prefixes / affixes:

STRENGTH-DERIVED
Melee Damage (Warriors)

Prefixes

I: Forceful
II: Brutal
III: Worldrend

Suffixes

I: of Striking
II: of Cleaving
III: of the Warbringer

Armor (Flat Melee Reduction)

Prefixes

I: Reinforced
II: Ironbound
III: Bastionforged

Suffixes

I: of Guarding
II: of the Bulwark
III: of Unyielding Stone

INTELLIGENCE-DERIVED
Spell Damage (Mages)

Prefixes

I: Imbued
II: Arcane
III: Void-touched

Suffixes

I: of Sparks
II: of Sorcery
III: of Cataclysm

Spell Shield (Flat Spell Reduction)

Prefixes

I: Warded
II: Runed
III: Nullbound

Suffixes

I: of Warding
II: of the Barrier
III: of Arcane Silence

DEXTERITY-DERIVED
Ranged Attack Damage (Rangers)

Prefixes

I: Keen
II: Deadeye
III: Windpiercer

Suffixes

I: of Aim
II: of Piercing
III: of the Ballista

Missile Resistance (Flat Ranged Reduction)

Prefixes

I: Deflecting
II: Arrowproof
III: Stormguard

Suffixes

I: of Deflection
II: of the Iron Screen
III: of the Unerring Wall

LUCK-DERIVED
Critical Chance

Prefixes

I: Fortunate
II: Lucky
III: Fatebound

Suffixes

I: of Fortune
II: of the Gambler
III: of Twisted Fate

Critical Damage

Prefixes

I: Punishing
II: Devastating
III: Doom-marked

Suffixes

I: of Impact
II: of Ruin
III: of Final Judgment

INITIATIVE-DERIVED
Combat Speed

Prefixes

I: Swift
II: Quickened
III: Lightning-borne

Suffixes

I: of Haste
II: of the Tempest
III: of Relentless Motion

Chance to Extra Attack

Prefixes

I: Opportunistic
II: Relentless
III: Frenzied

Suffixes

I: of Momentum
II: of the Second Strike
III: of Endless Assault

Max Hitpoints

Prefixes

I: Stout
II: Vigorous
III: Colossal

Suffixes

I: of Endurance
II: of Deep Reserves
III: of the Undying

## Consumables
- Temporary stat boosts with fixed duration.
- Non-stack rule by effect category to prevent runaway boosts.
- Typical categories:
  - attack boost
  - defense boost
  - XP gain boost
  - gold gain boost

## Economy Structure
Currencies:
- `ducats` (soft currency).
- `imperials` (premium currency, convenience/cosmetics).

Sources:
- mission rewards
- contracts board completions
- event objectives
- item selling/salvage outputs

Sinks:
- shop purchases
- consumables
- reroll/refresh options
- stat training
- stash expansion (imperials)

## Pacing Gates: Hybrid Timers + Stamina
- Missions consume stamina.
- Stamina regenerates over time.
- Contracts board and shop stocks use independent timers.
- Combined system controls burst and return cadence.

## Monetization Guardrails
- No direct premium purchase of exclusive combat power stats in v1.
- Premium spend focuses on cosmetics, inventory convenience, optional accelerators with capped competitive impact.
- Every monetized convenience must preserve non-paying progression path.
