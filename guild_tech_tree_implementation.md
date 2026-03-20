You are a senior fullstack game developer working on a live browser RPG.

Your task is to analyze the existing game systems in this codebase and then design + implement a new **Guild Academy / Guild Tech Tree** system.

First, study the current architecture and core gameplay loops before making changes. In particular, understand:

- player stats and formulas, especially **STR / INT / DEX**
- combat and progression systems
- contract systems and how **attempts/tries are consumed**
- arena systems
- guild missions / guild progression
- PvE, solo/group content, and any guild-related progression
- stamina / energy / HP recovery systems
- crafting-related layers if they exist (materials, refinement, enchanting, farming, etc.)
- any existing seasonal systems and whether there is already a concept similar to **renown** or long-term guild progression

After understanding the current systems, implement a **Guild Academy** feature that works as a **tech tree** for guilds.

## Core design requirements

1. **Guild-wide bonuses**
   - When a guild unlocks a tech, the benefit applies to **all guild members**.
   - Bonuses should be meaningful, interesting, and “spicy”, but still **small / weak enough** to avoid breaking balance.
   - This should feel like long-term guild progression, not mandatory power creep.

2. **Tech tree structure**
   - The tree can be fairly deep and should support interesting unlock paths.
   - The unlocking itself can be a small metagame.
   - Support the idea that some nodes become stronger, unlockable, or conditionally available when other nodes are connected/unlocked.
   - Prefer a system that is extensible and data-driven.

3. **Possible branches**
   Use the current game systems to decide final structure, but consider something like:
   - **General branch**: stamina regen, small recovery boosts, slightly better guild utility, more contract/guild task efficiency, etc.
   - **STR branch**
   - **INT branch**
   - **DEX branch**

   Also consider whether specialized branches make sense based on existing systems, for example:
   - 1v1 arena
   - 5v5 / guild arena
   - guild PvE
   - solo PvE
   - farming / plant growing
   - material refinement
   - enchanting
   - other profession/economy systems already present in the codebase

   You do not have to force all branches if they do not fit the current architecture. Base the final implementation on the real systems that exist.

4. **Balance philosophy**
   - Bonuses must be **lightweight**, especially if any part of guild progression persists across seasons.
   - If there is a renown-like carryover into future seasons, make those persistent benefits especially conservative.
   - Avoid flat bonuses that trivialize current content or make one stat/class dominant.
   - Use the existing formulas and progression pace to tune values responsibly.

5. **Interesting node design**
   Some example categories of bonuses you may adapt to the real game:
   - minor stat bonuses
   - small stamina recovery improvements
   - small HP recovery improvements
   - reduced attempt consumption in selected guild-related activities, if appropriate
   - slight boosts to contract efficiency or reward quality
   - minor specialization bonuses for STR / INT / DEX-oriented builds
   - small boosts for arena, guild missions, PvE, or crafting-related layers
   - synergy nodes that require prerequisite combinations

   Keep everything subtle and well-balanced.

## Implementation requirements

Please do the following:

1. **Analyze first**
   - Inspect the codebase and summarize how the main game systems currently work.
   - Identify where guild data, player bonuses, progression systems, and formulas are stored.
   - Identify the safest integration points.

2. **Design the feature**
   - Propose a concrete Guild Academy structure that fits this game.
   - Define branches, node types, prerequisites, unlock rules, costs, and guild-wide effects.
   - Explain how it interacts with existing systems.
   - Explain how it is balanced.

3. **Implement it**
   - Add backend/domain logic, database/schema changes, services, and APIs as needed.
   - Add or update frontend/UI so guild members can view the academy tree and unlocked bonuses.
   - Ensure unlocked tech effects are actually applied to all guild members wherever relevant.
   - Make the system maintainable and data-driven rather than hardcoded where possible.

4. **Preserve code quality**
   - Follow the existing project style and architecture.
   - Reuse existing patterns wherever possible.
   - Avoid hacks and duplicated logic.
   - Add comments only where they genuinely help.

5. **Migration / compatibility**
   - Add any needed migrations or seed/config data.
   - Make sure the system is safe for existing guilds and existing player accounts.
   - If needed, initialize guild academy state for old guilds gracefully.

6. **Explain your work**
   At the end, provide:
   - a short summary of how the current relevant systems work
   - what you added
   - why you chose the final academy structure
   - balancing notes
   - files changed
   - any follow-up suggestions

## Preferred design direction

Aim for a system that feels like:
- a **guild academy / research tree**
- a meaningful long-term guild goal
- partially strategic in unlock order
- with some branches that are universally useful and some that are specialized
- with room for future expansion

Do not blindly invent bonuses without checking the real game systems first. Study the codebase, infer what fits, then implement the system in a way that feels native to this game.