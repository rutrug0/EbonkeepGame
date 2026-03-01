# V2 Appendix: PvP and Clans

## Appendix Purpose
This document reserves architectural and design direction for PvP/clan systems without committing v1 implementation scope.

## Proposed Clan Battle Format
- Two clans face each other with larger rosters.
- Active combat lane supports 6 vs 6 at once (left-to-right positional slots).
- Dead units are replaced by next available clan member from roster queue.
- Battle ends when one clan has no units left in active lane plus reserve.

## Turn and Input Model
- Reuse core synchronous turn-based server timer system.
- Turn actor order sorted by initiative.
- Players may pre-select skill and target.
- Missing input defaults to fallback policy.

## Positional Strategy Intent
- Slot position may provide class-dependent modifiers.
- Example future modifiers:
  - frontline durability bonus
  - backline ranged/magic accuracy bonus

## Readiness Requirements Before Implementation
- Team matchmaking model and anti-smurf policy.
- Clan progression/reward economy design.
- Anti-griefing and AFK replacement rules.
- Additional load testing profile for high-entity battles.

## Technical Considerations
- Combat session schema must support reserve roster state.
- Event stream should include reinforcement events:
  - `CombatUnitReinforced { side, slot, unitId }`
- UI must support lane + bench roster visibility.

## Out of Scope for v1
- Clan creation/management UX.
- Ranked PvP economy and rewards.
- Seasonal clan ladders.
- Clan social systems (chat moderation, diplomacy, etc).

