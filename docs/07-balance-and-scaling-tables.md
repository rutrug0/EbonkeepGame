# Balance and Scaling Tables (Initial)

## Scale Targets
- MAU: 50,000
- DAU: 5,000
- Peak CCU: 500
- Avg session length target: 12-18 minutes
- Avg sessions/day target: 2.3

## Level Curve (Baseline)
Formula:
- `xp_to_next(level) = 100 * level^1.35`

Sample table:

| Level | XP to Next |
|---|---:|
| 1 | 100 |
| 5 | 884 |
| 10 | 2,239 |
| 15 | 3,871 |
| 20 | 5,701 |
| 25 | 7,680 |
| 30 | 9,784 |

## Base Class Stat Bias (Level 1)
| Class | HP | Attack | Spell | Armor | Initiative |
|---|---:|---:|---:|---:|---:|
| Warrior | 130 | 16 | 6 | 14 | 9 |
| Mage | 90 | 7 | 19 | 7 | 11 |
| Ranger | 105 | 14 | 9 | 10 | 14 |

## Per-Level Baseline Growth (Pre-gear)
| Stat | Growth/Level |
|---|---:|
| HP | +11 |
| Primary offense stat | +2.2 |
| Armor | +1.4 |
| Initiative | +0.9 |

## Gear Score Bands by Level Bracket
| Level Bracket | Low | Target | High |
|---|---:|---:|---:|
| 1-10 | 20 | 55 | 95 |
| 11-20 | 90 | 155 | 240 |
| 21-30 | 220 | 340 | 500 |
| 31-40 | 470 | 660 | 900 |

## Stamina Baseline
| Parameter | Value |
|---|---:|
| Max stamina | 120 |
| Regen interval | 1 per 6 min |
| PvE mission cost | 8-20 |
| Daily passive refill cap | 240 regained |

## Contracts Board (Timed Activities)
| Job Tier | Duration | Reward Profile |
|---|---|---|
| Short | 30 min | low gold + low XP |
| Medium | 2 h | moderate gold + XP |
| Long | 8 h | high gold + moderate XP + low item chance |

Contracts board defaults:
- Max available contracts at one time: `6`.
- Expired contracts are removed from available list.
- Replenish cooldown after expire/abandon: `1-2 hours`.

## Shop Refresh Cadence
| Shop Type | Refresh Interval | Manual Refresh |
|---|---|---|
| Common goods | 4 h | gold cost |
| Rare offers | 12 h | gems cost |
| Event store | event-defined | no manual (default) |

## Combat Timer Defaults
| Parameter | Value |
|---|---:|
| Player turn timer | 8 sec |
| Allowed range | 5-10 sec |
| Max initiative extra opportunities/cycle | +2 |

## Item Prefix/Affix Scaling (Level 1-100)
- Full table: `docs/data/affix_scaling_level_1_100.csv`
- Coefficients source: `docs/data/affix_scaling_coefficients.csv`
- Specification and caps: [11-item-affix-scaling-table.md](./11-item-affix-scaling-table.md)

## Item Power Score (Level 1-100)
- Canonical specification owner: [06-progression-itemization-and-economy.md](./06-progression-itemization-and-economy.md) (`Item Power Score Formula` section).
- Formula summary:
  - `base_power = item_level * 8`
  - `rarity_bonus = base_power * rarity_bonus_rate`
  - `roll_bonus = prefix_tier_bonus + suffix_tier_bonus`
  - `total_item_power = round_nearest((base_power + rarity_bonus + roll_bonus) * category_power_multiplier)`
- Base rarity bonus rates:
  - Common `0.00`, Uncommon `0.10`, Rare `0.20`, Epic `0.30`
- Category power multipliers:
  - Armor `1.0`, Jewelry `1.0`, Weapon `2.0`
- Roll-tier bonus formulas (per present roll):
  - T1 `item_level * 0.25`
  - T2 `item_level * 0.50`
  - T3 `item_level * 0.75`

Sanity-check examples:

| Case | Expected item power |
|---|---:|
| Level 100 Common Armor (no rolls) | 800 |
| Level 100 Rare Weapon + T3 prefix + T3 suffix | 2220 |
| Level 57 Rare Weapon + T1 prefix + T2 suffix | 1180 |

## Passive Training and Ducat Rewards (Level 1-100)
- Passive training table: `docs/data/passive_training_scaling_level_1_100.csv`
- Mission reward table: `docs/data/mission_ducat_rewards_level_1_100.csv`
- Coefficients:
  - `docs/data/passive_training_coefficients.csv`
  - `docs/data/mission_ducat_coefficients.csv`
- Specification: [12-passive-training-and-ducat-scaling.md](./12-passive-training-and-ducat-scaling.md)

## Experience Requirements (Level 1-100)
- XP table: `docs/data/experience_requirements_level_1_100.csv`
- Coefficients: `docs/data/experience_curve_coefficients.csv`
- Specification: [13-experience-requirements-scaling.md](./13-experience-requirements-scaling.md)

## Warrior Melee Weapon Tables
- ilvl scaling table: `docs/data/warrior_melee_weapon_ilvl_scaling_v2.csv`
- name/range table: `docs/data/warrior_melee_weapon_name_ranges_v4.csv`
- coefficients:
  - `docs/data/warrior_weapon_damage_coefficients_v2.csv`
  - `docs/data/weapon_damage_category_profiles.csv`
- specification: [14-warrior-melee-weapon-tables.md](./14-warrior-melee-weapon-tables.md)

## Ranger Ranged Weapon Tables
- ilvl scaling table: `docs/data/ranger_ranged_weapon_ilvl_scaling_v1.csv`
- name/range table: `docs/data/ranger_ranged_weapon_name_ranges_v3.csv`
- coefficients:
  - `docs/data/warrior_weapon_damage_coefficients_v2.csv`
  - `docs/data/weapon_damage_category_profiles.csv`
- specification: [15-ranger-ranged-weapon-tables.md](./15-ranger-ranged-weapon-tables.md)

## Mage Arcane Weapon Tables
- ilvl scaling table: `docs/data/mage_arcane_weapon_ilvl_scaling_v1.csv`
- name/range table: `docs/data/mage_arcane_weapon_name_ranges_v3.csv`
- coefficients:
  - `docs/data/warrior_weapon_damage_coefficients_v2.csv`
  - `docs/data/weapon_damage_category_profiles.csv`
- specification: [16-mage-arcane-weapon-tables.md](./16-mage-arcane-weapon-tables.md)

## Armor Name-Range Tables
- heavy table: `docs/data/heavy_armor_name_ranges_v1.csv`
- light table: `docs/data/light_armor_name_ranges_v1.csv`
- robe table: `docs/data/robe_armor_name_ranges_v1.csv`
- specification: [17-armor-name-range-tables.md](./17-armor-name-range-tables.md)

## Jewelry Name-Range Tables
- ring table: `docs/data/jewelry_ring_name_ranges_v1.csv`
- necklace table: `docs/data/jewelry_necklace_name_ranges_v1.csv`
- specification: [18-jewelry-name-range-tables.md](./18-jewelry-name-range-tables.md)

## Economy Health Guardrails
- Target average soft currency sink ratio: 0.85-1.05 of sources.
- Target upgrade affordability: meaningful item purchase every 2-4 sessions.
- Target legendary drop rate (non-event): 0.5%-1.5% per eligible drop slot.

## Capacity Planning Baseline
- Concurrent active combat sessions at 500 CCU peak: 120-220.
- WebSocket fanout budget: <= 30 events/sec per hot combat shard.
- Redis p95 get/set budget: <= 5 ms under peak.
- Combat action resolution p95: <= 150 ms server-side.
