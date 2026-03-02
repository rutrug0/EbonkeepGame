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
- Goal: item power should be driven mostly by item level, with smaller contributions from base rarity and prefix/suffix tier quality.
- Canonical formula:
  - `base_power = item_level * 8`
  - `rarity_bonus = base_power * rarity_bonus_rate`
  - `roll_bonus = prefix_tier_bonus + suffix_tier_bonus`
  - `total_item_power = round_nearest((base_power + rarity_bonus + roll_bonus) * category_power_multiplier)`
- Rounding rule:
  - round once at the final total only (not per component), using nearest integer.

Category multipliers:

| Item Major Category | category_power_multiplier |
|---|---:|
| Armor | `1.0` |
| Jewelry | `1.0` |
| Weapon | `2.0` |

Base-item rarity bonus rates:

| Base Item Rarity | rarity_bonus_rate |
|---|---:|
| Common | 0.00 |
| Uncommon | 0.10 |
| Rare | 0.20 |
| Epic | 0.30 |

Prefix/suffix tier bonus formulas:

| Roll Tier | Per-roll bonus formula |
|---|---|
| T1 | `item_level * 0.25` |
| T2 | `item_level * 0.50` |
| T3 | `item_level * 0.75` |

Roll presence by item rarity:
- Common: no prefix/suffix roll
- Uncommon: one roll (prefix or suffix)
- Rare: two rolls (prefix and suffix)
- Epic: two rolls (prefix and suffix)

Worked examples:

| Case | Computation | Result |
|---|---|---:|
| Level 100 Common Armor (no rolls) | `(800 + 0 + 0) * 1.0` | `800` |
| Level 100 Uncommon Jewelry + T1 roll | `(800 + 80 + 25) * 1.0` | `905` |
| Level 100 Rare Weapon + T3 prefix + T3 suffix | `(800 + 160 + 75 + 75) * 2.0` | `2220` |
| Level 57 Rare Weapon + T1 prefix + T2 suffix | `(456 + 91.2 + 14.25 + 28.5) * 2.0 = 1179.9`, then round | `1180` |

Data contract (documentation-level, for backend/frontend alignment):
- `item_level`: integer in `[1, 100]`
- `rarity`: `common | uncommon | rare | epic`
- `prefix_tier`: `null | T1 | T2 | T3`
- `suffix_tier`: `null | T1 | T2 | T3`
- `category_power_multiplier`: number (`1.0` armor/jewelry, `2.0` weapon)
- `item_power`: integer computed from the formula above

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
