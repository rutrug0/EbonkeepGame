# Passive Training and Ducat Scaling (Level 1-100)

## Purpose
Define:
- Passive stat training gains and ducat costs.
- Mission ducat reward growth by level.
- A consistent money sink target where passive training contributes ~20-25% of total stats.
- Fixed gain per train click (only price grows).

## Source Files
- Training coefficients: `docs/data/passive_training_coefficients.csv`
- Mission reward coefficients: `docs/data/mission_ducat_coefficients.csv`
- Generated training table: `docs/data/passive_training_scaling_level_1_100.csv`
- Generated reward table: `docs/data/mission_ducat_rewards_level_1_100.csv`
- Generator: `tools/generate_training_and_reward_tables.ps1`

## Training Model
For each level and stat group:

- `expected_total_stat = (expected_total_base + expected_total_per_level * level) * expected_total_growth_per_level^(level - 1)`
- `target_training_stat = expected_total_stat * target_share`
- `target_share = 0.225` (22.5% default)
- `gain_per_click` is fixed for the stat and does not scale with level.
- `target_training_clicks = ceil(target_training_stat / gain_per_click)`

Cost model (ducats):
- `cost_level_multiplier = growth_per_level^(level - 1)`
- `next_click_cost = base_click_cost * cost_level_multiplier * cost_growth_per_click^(current_click_count)`

Key behavior:
- Cost growth is exponential per click (`cost_growth_per_click > 1`).
- Early purchases stay cheap and spammable.
- Cost pressure increases as trained stats rise, preserving sink behavior.
- Trainable stats in this model: `strength`, `intelligence`, `agility`, `vitality`.
- Fixed gain is `0.5` per click.
- 1000 click cap is kept per stat.
- Fractional gain is supported. Backend should store training points in fixed-point units (for example, tenths) to avoid float drift.

## Mission Reward Model
- `base_reward(level) = round(base_reward_level_1 * 1.10^(level - 1))`
- This is fast percent scaling (10% per level).

Default reward outputs:
- Base mission reward.
- Min/max variance band (`+-15%`).
- Elite and boss variants (`x1.35`, `x1.85`).

## Baseline Calibration Check (Level 30)
From generated table:
- `strength`: expected total `290.23`, target training `65.3` (22.5%), `131` clicks at `0.5` each, next click cost `478`, mission base reward `476`.
- `intelligence`: expected total `290.23`, target training `65.3` (22.5%), `131` clicks at `0.5` each, next click cost `478`, mission base reward `476`.
- `agility`: expected total `290.23`, target training `65.3` (22.5%), `131` clicks at `0.5` each, next click cost `478`, mission base reward `476`.
- `vitality`: expected total `344.23`, target training `77.45` (22.5%), `155` clicks at `0.5` each, next click cost `496`, mission base reward `476`.

This meets the desired profile:
- noticeable sink
- low incremental gain
- affordable repeated spending
- 1000 click cap remains sufficient through level 100:
  - `strength/intelligence/agility`: `840` clicks needed at level 100 target share.
  - `vitality`: `978` clicks needed at level 100 target share.

## How To Tune
1. Edit `docs/data/passive_training_coefficients.csv`:
   - `target_share`
   - `expected_total_growth_per_level`
   - `gain_per_click`
   - `base_click_cost_ducats`
   - `cost_growth_per_click`
   - `cost_level_growth_per_level`
   - `max_click_cap`
   - expected stat line (`expected_total_base`, `expected_total_per_level`)
2. Edit `docs/data/mission_ducat_coefficients.csv`:
   - `base_reward_ducats`
   - `level_growth_per_level`
   - reward multipliers/variance
3. Regenerate:
   - `powershell -ExecutionPolicy Bypass -File .\tools\generate_training_and_reward_tables.ps1`
