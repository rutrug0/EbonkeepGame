import type {
  CombatPlaybackActionResolved,
  CombatPlaybackEncounter,
  CombatPlaybackEvent
} from "../combat/playback";

export type ArenaCombatResolutionState = "playing" | "summarizing" | "awaiting_return";

export type ActiveArenaEncounterState = {
  encounter: CombatPlaybackEncounter;
  timeline: CombatPlaybackEvent[];
  currentEventIndex: number;
  hpByActorId: Record<string, number>;
  combatLogEntries: string[];
  combatLogEventIds: string[];
  activeAction: CombatPlaybackActionResolved | null;
  impactTargetId: string | null;
  resolutionState: ArenaCombatResolutionState;
  finalSummaryLine: string | null;
  typedSummaryLine: string;
  playbackRate: 1 | 5;
  segmentPlaybackRate: 1 | 5;
  playbackProgressMs: number;
  lastPlaybackTickAtMs: number | null;
};

export const ARENA_COMBAT_PLAYBACK_START_DELAY_MS = 330;
export const ARENA_COMBAT_PLAYBACK_IMPACT_DELAY_MS = 760;
export const ARENA_COMBAT_PLAYBACK_BEAT_MS = 1470;
export const ARENA_COMBAT_SUMMARY_TYPE_DELAY_MS = 30;
export const ARENA_COMBAT_FAST_FORWARD_ANIMATION_RATE = 8;

export function resetArenaCombatPlayback(previousEncounter: ActiveArenaEncounterState): ActiveArenaEncounterState {
  return {
    ...previousEncounter,
    currentEventIndex: 0,
    hpByActorId: {
      [previousEncounter.encounter.player.id]: previousEncounter.encounter.player.maxHp,
      ...Object.fromEntries(
        previousEncounter.encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp] as const)
      )
    },
    combatLogEntries: [],
    combatLogEventIds: [],
    activeAction: null,
    impactTargetId: null,
    resolutionState: "playing",
    finalSummaryLine: null,
    typedSummaryLine: "",
    playbackRate: previousEncounter.playbackRate,
    segmentPlaybackRate: previousEncounter.playbackRate,
    playbackProgressMs: 0,
    lastPlaybackTickAtMs: null
  };
}

export function getArenaPlaybackProgress(encounter: ActiveArenaEncounterState, nowMs: number = Date.now()): number {
  if (encounter.lastPlaybackTickAtMs === null) {
    return encounter.playbackProgressMs;
  }

  return encounter.playbackProgressMs + Math.max(0, nowMs - encounter.lastPlaybackTickAtMs) * encounter.segmentPlaybackRate;
}

export function snapshotArenaPlayback(
  encounter: ActiveArenaEncounterState,
  nowMs: number = Date.now()
): ActiveArenaEncounterState {
  return {
    ...encounter,
    playbackProgressMs: getArenaPlaybackProgress(encounter, nowMs),
    lastPlaybackTickAtMs: nowMs
  };
}

export function getArenaAnimationRate(encounter: ActiveArenaEncounterState): number {
  if (encounter.segmentPlaybackRate === 5) {
    return ARENA_COMBAT_FAST_FORWARD_ANIMATION_RATE;
  }

  return encounter.segmentPlaybackRate;
}

export function getArenaPlaybackThresholdMs(baseMs: number, encounter: ActiveArenaEncounterState): number {
  return (baseMs * encounter.segmentPlaybackRate) / getArenaAnimationRate(encounter);
}
