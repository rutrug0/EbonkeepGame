# Experience Requirements Scaling (Level 1-100)

## Goal
Build an XP curve that matches:
- Level `1 -> 2` takes `5` quests.
- Average quest duration is `10` minutes.
- Daily play cap is `3` hours.
- Total grind from level `1 -> 100` is about `1` year.

## Source Files
- Coefficients: `docs/data/experience_curve_coefficients.csv`
- Generated table: `docs/data/experience_requirements_level_1_100.csv`
- Generator: `tools/generate_experience_requirements_table.ps1`

## Model
- Quests per day at cap:
  - `quests_per_day = (daily_playtime_hours * 60) / avg_quest_minutes`
  - Default: `18 quests/day`
- Total target quests for one-year cap:
  - `target_total_quests = quests_per_day * target_days_to_cap`
  - Default: `6570 quests`

Quest requirement per level-up uses geometric growth:
- `quests_to_next(level) = first_levelup_quests * r^(level - 1)`
- `r` is solved so the sum from level `1 -> 99` equals `target_total_quests`.

With current coefficients:
- `r = 1.04137957`
- Total quests to reach level `100` = `6570`

XP requirement:
- `xp_to_next = quests_to_next * xp_per_quest`
- Default `xp_per_quest = 100`

## Sample Milestones
- Level `1 -> 2`: `5` quests (`~0.83h`)
- Level `30 -> 31`: `16.2` quests (`~2.7h`)
- Level `50 -> 51`: `36.46` quests (`~6.08h`)
- Level `75 -> 76`: `100.47` quests (`~16.75h`)
- Level `99 -> 100`: `265.86` quests (`~44.31h`)

## Tuning Notes
- Increase `target_days_to_cap` to slow global progression.
- Increase `first_levelup_quests` to make early game slower.
- Increase `xp_per_quest` only changes display-scale XP numbers, not time-to-level by itself.
- If quest duration changes, update `avg_quest_minutes` and regenerate.

## Regenerate
`powershell -ExecutionPolicy Bypass -File .\tools\generate_experience_requirements_table.ps1`
