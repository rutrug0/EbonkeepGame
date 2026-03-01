# Combat System Spec (High Level)

## Design Intent
Combat is synchronous turn-based with optional manual input. Players can pre-select actions and targets, but the server guarantees continuity via fallback behavior when input is missing.

## Combat Modes (v1 and v2 readiness)
- v1 primary: solo PvE (player vs monsters).
- v2 extension-ready: team lane combat with reinforcements (documented in appendix).

## Authority Model
- Server-authoritative combat state and timer.
- Client renders predictions only for UX and reconciles on every server event.

## Turn Model
- Default turn timer: 8 seconds (configurable range 5-10 seconds).
- Each action resolves as a single server simulation step.
- For human-controlled actors: action executes when timer expires.
- For monster AI actors: action resolves immediately when their turn is due (no wait timer).

## Initiative and Action Frequency
Initiative defines order and potential extra action frequency.

High-level rule set:
1. Build sorted initiative queue from all alive units.
2. Each alive unit receives at least one action opportunity per round cycle.

## Action Selection
Player may submit before timer expiry:
- Target ID.
- Action type (`basic_attack` or selected skill).

If no submission before deadline:
- Server fallback policy:
  1. If previous valid action exists, reuse it if still legal.
  2. Else pick legal enemy target using deterministic random seed.
  3. Execute `basic_attack`.

## Resolution Order Per Action
1. Validate actor is alive and not crowd-controlled from acting.
2. Validate target legality; if invalid, retarget by fallback policy.
3. Compute hit/avoidance/crit and modifiers.
4. Apply damage/healing/status effects.
5. Emit authoritative event payload.
6. Check deaths and trigger post-action effects.

## Round and Battle End Conditions
- Round ends when all scheduled action opportunities for that cycle are consumed.
- Battle ends when one side has no alive units.

## Failure and Recovery
- Client disconnect: server continues combat with fallback actions.
- Late action packets: ignored if turn already resolved.
- Timer drift: clients are corrected by `server_time` and `turn_deadline` payload on each turn event.

## Event Contracts (High-Level)
- `CombatTurnStarted { sessionId, actorId, turnIndex, deadlineTs }`
- `CombatActionCommitted { sessionId, actorId, actionType, targetId }`
- `CombatActionResolved { sessionId, actorId, targetId, result, hpAfter }`
- `CombatRoundEnded { sessionId, roundIndex, survivorsBySide }`
- `CombatEnded { sessionId, winnerSide, rewards }`

## Testing Scenarios
- Initiative ties resolve deterministically.
- Actor dies before queued turn; turn is skipped safely.
- Missing input fallback remains legal and deterministic.
- High-initiative actor gets extra turns within cap.
- Reconnect during active turn receives full state snapshot.

