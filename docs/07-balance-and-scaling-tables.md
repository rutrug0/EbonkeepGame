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
| Wizard | 90 | 7 | 19 | 7 | 11 |
| Archer | 105 | 14 | 9 | 10 | 14 |

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
- name/range table: `docs/data/warrior_melee_weapon_name_ranges_v2.csv`
- coefficients:
  - `docs/data/warrior_weapon_damage_coefficients_v2.csv`
  - `docs/data/weapon_damage_category_profiles.csv`
- specification: [14-warrior-melee-weapon-tables.md](./14-warrior-melee-weapon-tables.md)

## Economy Health Guardrails
- Target average soft currency sink ratio: 0.85-1.05 of sources.
- Target upgrade affordability: meaningful item purchase every 2-4 sessions.
- Target legendary drop rate (non-event): 0.5%-1.5% per eligible drop slot.

## Capacity Planning Baseline
- Concurrent active combat sessions at 500 CCU peak: 120-220.
- WebSocket fanout budget: <= 30 events/sec per hot combat shard.
- Redis p95 get/set budget: <= 5 ms under peak.
- Combat action resolution p95: <= 150 ms server-side.
