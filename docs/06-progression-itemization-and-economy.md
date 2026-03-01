# Progression, Itemization, and Economy

## Progression Model
- Primary axes: account level + gear score.
- Level grants baseline stat growth and feature unlock pacing.
- Gear score controls encounter viability and upgrade chase.

## Classes
- Warrior; Counters archers (bonus damage vs. them)
- Wizard; Counters warriros (bonus damage vs. them)
- Archer; Counters wizards (bonus damage vs. them)
- Each class can wear only items for it's class - armor and weapons

## Core Stats
- `strength`, `intelligence`, `dexterity`, `vitality`, `initiative`, `luck`.
- Derived stats:
- From strength:
* Melee damage (so this is for warriors only)
* Armor (flat damage reduction from melee attacks)
- From intelligence:
* Spell damage (wizards only)
* Spell shield (flat damage reduction from spell damage)
- From dexterity:
* Ranged attack damage (archers only)
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
- Item sizes: 1x1 (rings, amulets), 1x2, 2x2, 2x3 (staffs, axes, swords, bows).
- Equip slots: weapon, offhand, helm, chest, gloves, boots, amulet, ring1, ring2.
- Stash tabs:
  - Base: 1 tab free.
  - Additional tabs: monetized convenience expansion.

## Itemization
- Rarity tiers: Common, Uncommon, Rare, Epic.
- Item fields:
  - item type
  - level requirement (will be same as item level)
  - base stat line
  - affix pool roll
  - prefix pool roll
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
Spell Damage (Wizards)

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
Ranged Attack Damage (Archers)

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
- jobs
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
- Jobs and shop stocks use independent timers.
- Combined system controls burst and return cadence.

## Monetization Guardrails
- No direct premium purchase of exclusive combat power stats in v1.
- Premium spend focuses on cosmetics, inventory convenience, optional accelerators with capped competitive impact.
- Every monetized convenience must preserve non-paying progression path.
