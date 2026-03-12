import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { PlayerClass } from "@ebonkeep/shared/core";

import { CombatActorFrame } from "../combat";
import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type MissionDifficulty = "easy" | "medium" | "hard";
type MissionPhase = "lobby" | "travel" | "combat";
type MissionResolutionState = "playing" | "summarizing" | "awaiting_return";
type MissionView = "board" | "active" | "history";
type MemberClass = PlayerClass;

type MissionBattleActor = {
  id: string;
  side: "player" | "enemy";
  name: string;
  maxHp: number;
  power: number;
  combatStat: "strength" | "dexterity" | "intelligence";
  avatarPath?: string;
  usesSilhouetteFallback?: boolean;
};

type MissionMember = {
  playerId: string;
  name: string;
  isLeader: boolean;
  playerClass: MemberClass;
  power: number;
  level: number;
  joinedAt: number;
};

type MissionAutoJoiner = {
  member: MissionMember;
  willJoinAtMs: number;
};

type MissionEnemyTemplate = {
  id: string;
  name: string;
  maxHp: number;
  power: number;
  combatStat: "strength" | "dexterity" | "intelligence";
  monsterKey?: string;
};

type MissionTemplate = {
  id: string;
  name: string;
  difficulty: MissionDifficulty;
  description: string;
  locationName: string;
  familyId: string;
  enemies: MissionEnemyTemplate[];
  rewardExperience: { min: number; max: number };
  rewardDucats: { min: number; max: number };
};

// ── Combat event types ───────────────────────────────────────────────────────

type MissionCombatStartedEvent = {
  type: "MissionCombatStarted";
  eventId: string;
  encounterId: string;
};

type MissionActionEvent = {
  type: "MissionActionResolved";
  eventId: string;
  encounterId: string;
  turnIndex: number;
  actorId: string;
  targetId: string;
  actionType: "basic_attack";
  damage: number;
  targetHpAfter: number;
  attackerLungeDirection: "left-to-right" | "right-to-left";
  logLine: string;
};

type MissionCombatEndedEvent = {
  type: "MissionCombatEnded";
  eventId: string;
  encounterId: string;
  winnerSide: "players" | "enemies";
  summaryLine: string;
};

type MissionCombatEvent = MissionCombatStartedEvent | MissionActionEvent | MissionCombatEndedEvent;

// ── Active mission state ─────────────────────────────────────────────────────

type ActiveMissionState = {
  id: string;
  template: MissionTemplate;
  leader: MissionMember;
  members: MissionMember[];
  maxMembers: number;
  pendingJoiners: MissionAutoJoiner[];
  waitTimerMs: number;
  startsAt: number;
  phase: MissionPhase;
  // travel
  travelEndsAt: number | null;
  travelDescription: string;
  // combat actors (built when travel starts)
  travelImagePath?: string;
  combatBackgroundPath?: string;
  allPlayers: MissionBattleActor[];
  allEnemies: MissionBattleActor[];
  // playback
  timeline: MissionCombatEvent[];
  currentEventIndex: number;
  hpById: Record<string, number>;
  combatLog: string[];
  activeAction: MissionActionEvent | null;
  impactTargetId: string | null;
  resolutionState: MissionResolutionState;
  finalSummaryLine: string | null;
  typedSummaryLine: string;
  playbackRate: 1 | 5;
  segmentPlaybackRate: 1 | 5;
  playbackProgressMs: number;
  lastPlaybackTickAtMs: number | null;
};

type CompletedMission = {
  id: string;
  templateName: string;
  difficulty: MissionDifficulty;
  locationName: string;
  participants: { name: string; isLeader: boolean; playerClass: MemberClass }[];
  enemyNames: string[];
  outcome: "victory" | "defeat";
  turnCount: number;
  completedAt: number;
  summaryLine: string;
};

export type GuildMissionsProps = {
  playerName: string;
  playerClass: MemberClass;
  playerPower: number;
  playerLevel: number;
  onActiveMissionChange?: (active: boolean) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MISSION_TRAVEL_DURATION_MS = 10_000;
const COMBAT_START_DELAY_MS = 330;
const COMBAT_IMPACT_DELAY_MS = 760;
const COMBAT_BEAT_MS = 1_470;
const COMBAT_SUMMARY_TYPE_DELAY_MS = 30;
const COMBAT_FAST_FORWARD_RATE = 8;

const CLASS_BASE_HP: Record<MemberClass, number> = {
  juggernaut: 97,
  sentinel: 92,
  reaver: 90,
  shade: 83,
  arbalist: 82,
  disciple: 80,
  runecaster: 78,
  chronomancer: 75,
  arcanist: 73,
};

const CLASS_COMBAT_STAT: Record<MemberClass, "strength" | "dexterity" | "intelligence"> = {
  // Weapon stat drives combat damage (secondary stat, not primary archetype)
  juggernaut:   "strength",     // Maul → STR
  arbalist:     "strength",     // Crossbow → STR
  runecaster:   "strength",     // Rune Stone → STR
  sentinel:     "dexterity",    // Spear → DEX
  disciple:     "dexterity",    // Chakrams → DEX
  chronomancer: "dexterity",    // Orb → DEX
  reaver:       "intelligence", // Cleaver → INT
  shade:        "intelligence", // Twin Daggers → INT
  arcanist:     "intelligence", // Grimoire → INT
};

// ─────────────────────────────────────────────────────────────────────────────
// Mission templates  (2 easy · 2 medium · 2 hard)
// ─────────────────────────────────────────────────────────────────────────────

const MISSION_TEMPLATES: MissionTemplate[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  {
    id: "goblin-warband",
    name: "Goblin Warband",
    difficulty: "easy",
    description:
      "A scattered pack of goblins has been raiding outlying farmsteads. Drive them back before the harvest is ruined.",
    locationName: "Snagtooth Hollow",
    familyId: "snagtooth_hollow_00",
    enemies: [
      { id: "e-goblin-warchief", name: "Goblin Warchief", maxHp: 98, power: 62, combatStat: "strength", monsterKey: "monster:snagtooth_hollow_00:snagtooth boss" },
      { id: "e-goblin-raider",   name: "Goblin Raider",   maxHp: 82, power: 54, combatStat: "dexterity", monsterKey: "monster:snagtooth_hollow_00:sling scab" },
    ],
    rewardExperience: { min: 350, max: 540 },
    rewardDucats:     { min: 200, max: 320 },
  },
  {
    id: "feral-scout-nest",
    name: "Feral Scout Nest",
    difficulty: "easy",
    description:
      "Feral scouts have established a nest near the eastern watchtower. Clear it before their numbers grow.",
    locationName: "Bogwatch Flats",
    familyId: "snagtooth_hollow_00",
    enemies: [
      { id: "e-scout-alpha", name: "Scout Alpha", maxHp: 118, power: 70, combatStat: "dexterity", monsterKey: "monster:snagtooth_hollow_00:scrap sneak" },
    ],
    rewardExperience: { min: 280, max: 430 },
    rewardDucats:     { min: 160, max: 260 },
  },
  // ── Medium ────────────────────────────────────────────────────────────────
  {
    id: "swamp-mire-patrol",
    name: "Swamp Mire Patrol",
    difficulty: "medium",
    description:
      "Three bog stalkers guard the mire crossing used by the merchant guild's supply chain. Remove them.",
    locationName: "Mirepool Grotto",
    familyId: "mirepool_boglings_04",
    enemies: [
      { id: "e-bog-stalker-1", name: "Bog Stalker",   maxHp: 128, power: 88, combatStat: "strength", monsterKey: "monster:mirepool_boglings_04:nettletoad" },
      { id: "e-bog-stalker-2", name: "Bog Stalker",   maxHp: 120, power: 84, combatStat: "strength", monsterKey: "monster:mirepool_boglings_04:mireshell terrapin" },
      { id: "e-mire-warden",   name: "Mire Warden",   maxHp: 148, power: 98, combatStat: "strength", monsterKey: "monster:mirepool_boglings_04:the mire croaker" },
    ],
    rewardExperience: { min: 480, max: 720 },
    rewardDucats:     { min: 290, max: 450 },
  },
  {
    id: "mercenary-siege-camp",
    name: "Mercenary Siege Camp",
    difficulty: "medium",
    description:
      "Rogue mercenaries have fortified the hillfort. Their siege captain directs the assault from the wall.",
    locationName: "Cinderhold Ridge",
    familyId: "ternfield_hobgoblins_08",
    enemies: [
      { id: "e-merc-footman-1", name: "Merc Footman",  maxHp: 118, power: 82, combatStat: "strength", monsterKey: "monster:ternfield_hobgoblins_08:camp hook" },
      { id: "e-merc-footman-2", name: "Merc Footman",  maxHp: 112, power: 79, combatStat: "strength", monsterKey: "monster:ternfield_hobgoblins_08:cartpole lurker" },
      { id: "e-siege-captain",  name: "Siege Captain", maxHp: 172, power: 108, combatStat: "strength", monsterKey: "monster:ternfield_hobgoblins_08:the camp reeve" },
    ],
    rewardExperience: { min: 520, max: 790 },
    rewardDucats:     { min: 320, max: 490 },
  },
  // ── Hard ──────────────────────────────────────────────────────────────────
  {
    id: "gnoll-war-party",
    name: "Gnoll War Party",
    difficulty: "hard",
    description:
      "A coordinated gnoll warband is pushing toward the keep. Four veterans with a warchief lead the charge.",
    locationName: "Thornkeep Approach",
    familyId: "ternfield_hobgoblins_08",
    enemies: [
      { id: "e-gnoll-warrior-1",    name: "Gnoll Warrior",    maxHp: 132, power: 108, combatStat: "strength", monsterKey: "monster:ternfield_hobgoblins_08:mudwall ram" },
      { id: "e-gnoll-warrior-2",    name: "Gnoll Warrior",    maxHp: 128, power: 105, combatStat: "strength", monsterKey: "monster:ternfield_hobgoblins_08:banner gnawer" },
      { id: "e-gnoll-skirmisher-1", name: "Gnoll Skirmisher", maxHp: 118, power: 112, combatStat: "dexterity", monsterKey: "monster:ternfield_hobgoblins_08:fence cutter" },
      { id: "e-gnoll-berserker",    name: "Gnoll Berserker",  maxHp: 122, power: 118, combatStat: "strength", monsterKey: "monster:ternfield_hobgoblins_08:old tusk" },
    ],
    rewardExperience: { min: 750, max: 1100 },
    rewardDucats:     { min: 450, max: 690 },
  },
  {
    id: "cultist-conclave",
    name: "Cultist Conclave",
    difficulty: "hard",
    description:
      "Five cultists have converged at the ritual stones. Their grimoire keeper must not complete the binding rite.",
    locationName: "Ashfel Ritual Stones",
    familyId: "saltwake_reavers_12",
    enemies: [
      { id: "e-cultist-acolyte-1", name: "Cultist Acolyte",  maxHp: 110, power:  94, combatStat: "intelligence", monsterKey: "monster:saltwake_reavers_12:spray curse caller" },
      { id: "e-cultist-acolyte-2", name: "Cultist Acolyte",  maxHp: 106, power:  91, combatStat: "intelligence", monsterKey: "monster:saltwake_reavers_12:tideknife lurker" },
      { id: "e-cultist-hexer-1",   name: "Cultist Hexer",    maxHp: 124, power: 108, combatStat: "intelligence", monsterKey: "monster:saltwake_reavers_12:beacon snuffer" },
      { id: "e-cultist-hexer-2",   name: "Cultist Hexer",    maxHp: 118, power: 104, combatStat: "intelligence", monsterKey: "monster:saltwake_reavers_12:needle eel" },
      { id: "e-grimoire-keeper",   name: "Grimoire Keeper",  maxHp: 150, power: 130, combatStat: "intelligence", monsterKey: "monster:saltwake_reavers_12:the tidehorn" },
    ],
    rewardExperience: { min: 820, max: 1260 },
    rewardDucats:     { min: 500, max: 760 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock guild member pool (auto-joiners)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_GUILD_POOL: { name: string; playerClass: MemberClass; power: number; level: number }[] = [
  { name: "Alaric Voss",  playerClass: "juggernaut", power: 104, level: 18 },
  { name: "Syrveth",      playerClass: "arcanist",   power: 89,  level: 15 },
  { name: "Tornas Iron",  playerClass: "sentinel",   power: 107, level: 20 },
  { name: "Ellara Swift", playerClass: "shade",      power: 93,  level: 17 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seeded PRNG  (mulberry32)
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Varied log-line generators
// ─────────────────────────────────────────────────────────────────────────────

function pickPlayerAttackLine(rng: () => number, a: string, d: string, dmg: number): string {
  const lines = [
    `${a} strikes ${d} for ${dmg} damage.`,
    `${a} drives forward hitting ${d} for ${dmg}.`,
    `${a} presses ${d} — ${dmg} damage dealt.`,
    `${a} catches ${d} off-guard for ${dmg}.`,
    `${a} lands a solid blow on ${d} dealing ${dmg}.`,
  ];
  return lines[Math.floor(rng() * lines.length)];
}

function pickEnemyAttackLine(rng: () => number, a: string, d: string, dmg: number): string {
  const lines = [
    `${a} swings at ${d} for ${dmg} damage.`,
    `${a} slashes ${d} dealing ${dmg}.`,
    `${a} hits ${d} hard — ${dmg} damage.`,
    `${a} assaults ${d} for ${dmg}.`,
    `${a} bashes ${d} for ${dmg} damage.`,
  ];
  return lines[Math.floor(rng() * lines.length)];
}

function pickKillLine(rng: () => number, killer: string, target: string): string {
  const lines = [
    `${killer} defeats ${target}!`,
    `${killer} brings down ${target}!`,
    `${killer} finishes ${target} with a decisive blow!`,
    `${target} falls to ${killer}!`,
  ];
  return lines[Math.floor(rng() * lines.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat simulation engine
//
// Turn order: each round, all alive actors are sorted by power (desc) and act
// in that order. Players focus-fire the lowest-HP enemy; enemies hit a random
// alive player.  Max 200 global actions to prevent infinite loops.
// ─────────────────────────────────────────────────────────────────────────────

function generateMissionTimeline(
  encounterId: string,
  players: MissionBattleActor[],
  enemies: MissionBattleActor[],
  seed: number
): { events: MissionCombatEvent[]; winnerSide: "players" | "enemies" } {
  const rng = mulberry32(seed);
  const hp: Record<string, number> = {};
  [...players, ...enemies].forEach((a) => { hp[a.id] = a.maxHp; });

  const actorMap = new Map<string, MissionBattleActor>(
    [...players, ...enemies].map((a) => [a.id, a])
  );

  const events: MissionCombatEvent[] = [
    { type: "MissionCombatStarted", eventId: `${encounterId}-start`, encounterId },
  ];

  let globalTurn = 0;
  const MAX_TURNS = 200;

  while (globalTurn < MAX_TURNS) {
    const alivePlayers = players.filter((p) => hp[p.id] > 0);
    const aliveEnemies = enemies.filter((e) => hp[e.id] > 0);

    if (alivePlayers.length === 0 || aliveEnemies.length === 0) break;

    // Interleaved round: sort all alive actors by power desc then act in order
    const roundOrder = [...alivePlayers, ...aliveEnemies].sort((a, b) => b.power - a.power);

    let roundEndedEarly = false;
    for (const actor of roundOrder) {
      if (hp[actor.id] <= 0) continue; // killed earlier in this round

      const curAlivePlayers = players.filter((p) => hp[p.id] > 0);
      const curAliveEnemies = enemies.filter((e) => hp[e.id] > 0);

      if (curAlivePlayers.length === 0 || curAliveEnemies.length === 0) {
        roundEndedEarly = true;
        break;
      }

      let targetId: string;
      let direction: "left-to-right" | "right-to-left";

      if (actor.side === "player") {
        // Focus lowest-HP enemy (smart play)
        const target = curAliveEnemies.reduce((min, e) => (hp[e.id] < hp[min.id] ? e : min));
        targetId = target.id;
        direction = "left-to-right";
      } else {
        // Enemies attack a random alive player (spread damage)
        targetId = curAlivePlayers[Math.floor(rng() * curAlivePlayers.length)].id;
        direction = "right-to-left";
      }

      const dmg = Math.max(1, Math.round(actor.power * (0.10 + rng() * 0.08)));
      const prevHp = hp[targetId];
      hp[targetId] = Math.max(0, prevHp - dmg);
      globalTurn++;

      const targetActor = actorMap.get(targetId)!;
      const killed = prevHp > 0 && hp[targetId] === 0;
      const logLine = killed
        ? pickKillLine(rng, actor.name, targetActor.name)
        : actor.side === "player"
          ? pickPlayerAttackLine(rng, actor.name, targetActor.name, dmg)
          : pickEnemyAttackLine(rng, actor.name, targetActor.name, dmg);

      events.push({
        type: "MissionActionResolved",
        eventId: `${encounterId}-t${globalTurn}`,
        encounterId,
        turnIndex: globalTurn,
        actorId: actor.id,
        targetId,
        actionType: "basic_attack",
        damage: dmg,
        targetHpAfter: hp[targetId],
        attackerLungeDirection: direction,
        logLine,
      });
    }

    if (roundEndedEarly) break;
  }

  const alivePlayers = players.filter((p) => hp[p.id] > 0);
  const winnerSide: "players" | "enemies" = alivePlayers.length > 0 ? "players" : "enemies";

  const summaryLine =
    winnerSide === "players"
      ? `The party emerges victorious after ${globalTurn} turns of combat!`
      : `The party was overwhelmed and driven back after ${globalTurn} turns.`;

  events.push({
    type: "MissionCombatEnded",
    eventId: `${encounterId}-end`,
    encounterId,
    winnerSide,
    summaryLine,
  });

  return { events, winnerSide };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildInitialHpMap(
  players: MissionBattleActor[],
  enemies: MissionBattleActor[]
): Record<string, number> {
  const map: Record<string, number> = {};
  [...players, ...enemies].forEach((a) => { map[a.id] = a.maxHp; });
  return map;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function classLabel(cls: MemberClass): string {
  const labels: Record<MemberClass, string> = {
    juggernaut: "Juggernaut",
    sentinel: "Sentinel",
    reaver: "Reaver",
    shade: "Shade",
    arbalist: "Arbalist",
    disciple: "Disciple",
    runecaster: "Runecaster",
    chronomancer: "Chronomancer",
    arcanist: "Arcanist",
  };
  return labels[cls];
}

function difficultyLabel(d: MissionDifficulty): string {
  switch (d) {
    case "easy":   return "Easy";
    case "medium": return "Medium";
    case "hard":   return "Hard";
  }
}

function difficultyClass(d: MissionDifficulty): string {
  return `missionDiffBadge missionDiff${d.charAt(0).toUpperCase()}${d.slice(1)}`;
}

function getMissionTravelDesc(difficulty: MissionDifficulty): string {
  switch (difficulty) {
    case "easy":
      return "The path winds through familiar ground. The party moves with confidence toward the target.";
    case "medium":
      return "Mirewater pools collect between sedge and root. Something in the hollow is already aware of your approach.";
    case "hard":
      return "The ground opens into a contested field. Your scouts report multiple hostiles massing ahead.";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Playback helpers  (mirror contracts logic)
// ─────────────────────────────────────────────────────────────────────────────

function getMissionPlaybackProgress(m: ActiveMissionState, nowMs: number): number {
  if (m.lastPlaybackTickAtMs === null) return m.playbackProgressMs;
  return m.playbackProgressMs + Math.max(0, nowMs - m.lastPlaybackTickAtMs) * m.segmentPlaybackRate;
}

function snapshotMission(m: ActiveMissionState, nowMs = Date.now()): ActiveMissionState {
  return {
    ...m,
    playbackProgressMs: getMissionPlaybackProgress(m, nowMs),
    lastPlaybackTickAtMs: nowMs,
  };
}

function playbackThresholdMs(baseMs: number, m: ActiveMissionState): number {
  const animRate = m.segmentPlaybackRate === 5 ? COMBAT_FAST_FORWARD_RATE : m.segmentPlaybackRate;
  return (baseMs * m.segmentPlaybackRate) / animRate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builds the travel state from a lobby state (used on Start Now & auto-start)
// ─────────────────────────────────────────────────────────────────────────────

function getMissionStageAssetPath(type: "travel_stage" | "combat_stage", familyId: string): string | undefined {
  const prefix = `${type}:${familyId}:`;
  const entry = Object.entries(GENERATED_ITEM_ICON_PATHS).find(([key]) => key.startsWith(prefix));
  return entry?.[1];
}

function buildTravelState(prev: ActiveMissionState, now: number): ActiveMissionState {
  // Include any pending joiners who arrived by now
  const arrivedPending = prev.pendingJoiners.filter((j) => j.willJoinAtMs <= now);
  const allMembers: MissionMember[] = [
    ...prev.members,
    ...arrivedPending.map((j) => ({ ...j.member, joinedAt: j.willJoinAtMs })),
  ];

  const { familyId } = prev.template;
  const travelImagePath = getMissionStageAssetPath("travel_stage", familyId);
  const combatBackgroundPath = getMissionStageAssetPath("combat_stage", familyId);

  const allPlayers: MissionBattleActor[] = allMembers.map((m) => ({
    id: `player-${m.playerId}`,
    side: "player" as const,
    name: m.name,
    maxHp: CLASS_BASE_HP[m.playerClass],
    power: m.power,
    combatStat: CLASS_COMBAT_STAT[m.playerClass],
    usesSilhouetteFallback: true,
  }));

  const allEnemies: MissionBattleActor[] = prev.template.enemies.map((e) => {
    const avatarPath = e.monsterKey ? GENERATED_ITEM_ICON_PATHS[e.monsterKey] : undefined;
    return {
      id: `enemy-${e.id}`,
      side: "enemy" as const,
      name: e.name,
      maxHp: e.maxHp,
      power: e.power,
      combatStat: e.combatStat,
      avatarPath,
      usesSilhouetteFallback: !avatarPath,
    };
  });

  const encounterId = `${prev.id}-encounter`;
  const seed = now % 999983;
  const { events } = generateMissionTimeline(encounterId, allPlayers, allEnemies, seed);

  return {
    ...prev,
    phase: "travel",
    travelEndsAt: now + MISSION_TRAVEL_DURATION_MS,
    travelImagePath,
    combatBackgroundPath,
    allPlayers,
    allEnemies,
    timeline: events,
    hpById: buildInitialHpMap(allPlayers, allEnemies),
    currentEventIndex: 0,
    combatLog: [],
    activeAction: null,
    impactTargetId: null,
    resolutionState: "playing",
    finalSummaryLine: null,
    typedSummaryLine: "",
    playbackProgressMs: 0,
    lastPlaybackTickAtMs: null,
    pendingJoiners: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Small icon helpers
// ─────────────────────────────────────────────────────────────────────────────

function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L3 7v6c0 4.97 3.84 9.63 9 11 5.16-1.37 9-6.03 9-11V7L12 2z" />
    </svg>
  );
}

function SwordsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m14.5 17.5 3 3" /><path d="m16.5 15.5 2 2" />
      <path d="m20 2-8 8L4 18l2 2 8-8 8-8-2-2Z" />
      <path d="m6.5 17.5-3 3" /><path d="m4.5 15.5-2 2" />
    </svg>
  );
}

function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
}

function UsersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SkullIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
      <path d="M8 20v2h8v-2" /><path d="m12.5 17-.5-1-.5 1h1z" />
      <path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission Board View
// ─────────────────────────────────────────────────────────────────────────────

type MissionBoardViewProps = {
  templates: MissionTemplate[];
  onCreateMission: (template: MissionTemplate, maxMembers: number, waitTimerMin: number) => void;
  completedCount: number;
  onShowHistory: () => void;
};

function MissionBoardView({
  templates,
  onCreateMission,
  completedCount,
  onShowHistory,
}: MissionBoardViewProps) {
  const { t } = useTranslation("common");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [maxMembers, setMaxMembers] = useState(5);
  const [timerMin, setTimerMin] = useState(10);

  const selectStyle: React.CSSProperties = {
    background: "var(--bg-iron, #1b232d)",
    color: "var(--text-main)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "0.2rem 0.4rem",
    fontSize: "0.82rem",
  };

  return (
    <section className="contentShell">
      <section className="contentStack">
        <article className="contentCard" style={{ padding: "1.25rem 1.4rem" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldIcon size={20} />
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>
                {t("missions.board.title")}
              </h2>
            </div>
            <button
              type="button"
              className="combatLogActionButton"
              style={{ fontSize: "0.78rem", padding: "0.3rem 0.75rem" }}
              onClick={onShowHistory}
              disabled={completedCount === 0}
            >
              {t("missions.board.history")}{completedCount > 0 ? ` (${completedCount})` : ""}
            </button>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: "0.83rem", margin: "0 0 1rem 0" }}>
            {t("missions.board.description")}
          </p>

          {/* Lobby settings */}
          <div style={{ display: "flex", gap: "1.25rem", marginBottom: "1.1rem", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              <UsersIcon size={13} />
              {t("missions.board.maxPlayers")}
              <select value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} style={selectStyle}>
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              <ClockIcon size={13} />
              {t("missions.board.waitTimer")}
              <select value={timerMin} onChange={(e) => setTimerMin(Number(e.target.value))} style={selectStyle}>
                {[5, 10, 15].map((n) => (
                  <option key={n} value={n}>{n} {t("missions.board.minutes")}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Mission list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {templates.map((tpl) => {
              const isExpanded = expandedId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "var(--bg-stone)" }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem 0.85rem", cursor: "pointer" }}
                    onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.18rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{tpl.name}</span>
                        <span className={difficultyClass(tpl.difficulty)}>{difficultyLabel(tpl.difficulty)}</span>
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                        {tpl.locationName} · {tpl.enemies.length}&nbsp;
                        {tpl.enemies.length === 1 ? t("missions.board.enemy") : t("missions.board.enemies")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                      <span className="ducatsAmount" style={{ fontSize: "0.76rem", whiteSpace: "nowrap" }}>
                        {tpl.rewardDucats.min}–{tpl.rewardDucats.max} ◎
                      </span>
                      <button
                        type="button"
                        className="combatLogActionButton"
                        style={{ fontSize: "0.76rem", padding: "0.28rem 0.65rem", whiteSpace: "nowrap" }}
                        onClick={(e) => { e.stopPropagation(); onCreateMission(tpl, maxMembers, timerMin); }}
                      >
                        {t("missions.board.create")}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: "0 0.85rem 0.75rem 0.85rem", borderTop: "1px solid var(--border-soft, var(--border))" }}>
                      <p style={{ margin: "0.55rem 0 0.55rem 0", fontSize: "0.82rem", color: "var(--text-soft)" }}>
                        {tpl.description}
                      </p>
                      <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
                        <span className="ducatsAmount" style={{ fontSize: "0.76rem" }}>
                          {t("missions.board.exp")}: {tpl.rewardExperience.min}–{tpl.rewardExperience.max}
                        </span>
                        <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                          {t("missions.board.ducats")}: {tpl.rewardDucats.min}–{tpl.rewardDucats.max} ◎
                        </span>
                        <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                          {t("missions.board.enemyList")}: {tpl.enemies.map((e) => e.name).join(", ")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission Lobby View
// ─────────────────────────────────────────────────────────────────────────────

type MissionLobbyViewProps = {
  mission: ActiveMissionState;
  nowMs: number;
  onStartNow: () => void;
  onAbandon: () => void;
  onAddMember: (poolMember: { name: string; playerClass: MemberClass; power: number; level: number }) => void;
  onRemoveMember: (playerId: string) => void;
};

function MissionLobbyView({ mission, nowMs, onStartNow, onAbandon, onAddMember, onRemoveMember }: MissionLobbyViewProps) {
  const { t } = useTranslation("common");
  const timeRemaining = Math.max(0, mission.startsAt - nowMs);
  const timerPct = Math.max(0, Math.min(100, ((mission.waitTimerMs - timeRemaining) / mission.waitTimerMs) * 100));
  const emptySlots = mission.maxMembers - mission.members.length;

  return (
    <section className="contentShell">
      <section className="contentStack">
        <article className="contentCard" style={{ padding: "1.25rem 1.4rem" }}>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.85rem" }}>
            <SwordsIcon size={20} />
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>
              {mission.template.name}
            </h2>
            <span className={difficultyClass(mission.template.difficulty)}>
              {difficultyLabel(mission.template.difficulty)}
            </span>
          </div>

          <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "var(--text-soft)" }}>
            {mission.template.description}
          </p>
          <p style={{ margin: "0 0 1rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {t("missions.lobby.location")}: <strong>{mission.template.locationName}</strong>
            &nbsp;·&nbsp;{mission.template.enemies.length} {t("missions.lobby.opponents")}
          </p>

          {/* Countdown timer */}
          <div style={{ marginBottom: "1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <ClockIcon size={13} />
                {t("missions.lobby.startsIn")}
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {formatDuration(timeRemaining)}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--bg-slate)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${timerPct}%`,
                  background: "var(--accent-focus)",
                  borderRadius: 3,
                  transition: "width 0.8s linear",
                }}
              />
            </div>
          </div>

          {/* Party roster */}
          <div style={{ marginBottom: "1.1rem" }}>
            <div className="missionSectionLabel">
              {t("missions.lobby.party")} ({mission.members.length}/{mission.maxMembers})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem" }}>
              {mission.members.map((m) => (
                <div key={m.playerId} className={`missionMemberCard${m.isLeader ? " isLeader" : ""}`}>
                  <div className="missionMemberAvatar">{m.name.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {m.name}
                      {m.isLeader && (
                        <span className="missionLeaderBadge">{t("missions.lobby.leader")}</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      {classLabel(m.playerClass)} · Lv{m.level} · ⚔ {m.power}
                    </div>
                  </div>
                </div>
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`empty-${i}`} className="missionMemberCard isEmpty">
                  <div className="missionMemberAvatar isEmpty" />
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {t("missions.lobby.openSlot")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Enemy preview */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div className="missionSectionLabel">{t("missions.lobby.enemies")}</div>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              {mission.template.enemies.map((e) => (
                <div key={e.id} className="missionEnemyChip">
                  <SkullIcon size={11} />&nbsp;{e.name}
                  <span style={{ color: "var(--text-muted)", marginLeft: "0.3rem" }}>
                    hp {e.maxHp} · ⚔ {e.power}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Available guildmates for testing */}
          <div style={{ marginBottom: "1.1rem" }}>
            <div className="missionSectionLabel">
              {t("missions.lobby.availableMates")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem" }}>
              {MOCK_GUILD_POOL.map((poolMember) => {
                const memberId = `mock-${poolMember.name.toLowerCase().replace(/\s+/g, "-")}`;
                const isInParty = mission.members.some((m) => m.playerId === memberId);
                const partyFull = mission.members.length >= mission.maxMembers;
                return (
                  <div key={memberId} className="missionMemberCard" style={{ opacity: isInParty ? 0.55 : 1 }}>
                    <div className="missionMemberAvatar">{poolMember.name.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{poolMember.name}</div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        {classLabel(poolMember.playerClass)} · Lv{poolMember.level} · ⚔ {poolMember.power}
                      </div>
                    </div>
                    {isInParty ? (
                      <button
                        type="button"
                        className="combatLogActionButton"
                        style={{ fontSize: "0.72rem", padding: "0.22rem 0.6rem", opacity: 0.7 }}
                        onClick={() => onRemoveMember(memberId)}
                      >
                        {t("missions.lobby.remove")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="combatLogActionButton"
                        style={{ fontSize: "0.72rem", padding: "0.22rem 0.6rem" }}
                        onClick={() => onAddMember(poolMember)}
                        disabled={partyFull}
                      >
                        {t("missions.lobby.addMember")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button type="button" className="combatLogActionButton" style={{ flex: 1 }} onClick={onStartNow}>
              {t("missions.lobby.startNow")}
            </button>
            <button type="button" className="combatLogActionButton" style={{ opacity: 0.65 }} onClick={onAbandon}>
              {t("missions.lobby.abandon")}
            </button>
          </div>
        </article>
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission Travel View
// ─────────────────────────────────────────────────────────────────────────────

function MissionTravelView({ mission, nowMs }: { mission: ActiveMissionState; nowMs: number }) {
  const { t } = useTranslation("common");
  const remaining = mission.travelEndsAt !== null ? Math.max(0, mission.travelEndsAt - nowMs) : 0;
  const progressPct =
    mission.travelEndsAt !== null
      ? Math.max(0, Math.min(100, ((MISSION_TRAVEL_DURATION_MS - remaining) / MISSION_TRAVEL_DURATION_MS) * 100))
      : 100;

  return (
    <section className="contentShell travelEncounterShell">
      <section className="contentStack">
        <article className="contentCard travelEncounterCard">
          <div className="travelEncounterStage">
            <div className="travelEncounterArt">
              {mission.travelImagePath ? (
                <img src={mission.travelImagePath} alt="" draggable={false} />
              ) : (
                <div className="travelEncounterSilhouette" aria-hidden="true" />
              )}
            </div>
            <div className="travelEncounterOverlay">
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", marginBottom: "0.75rem" }}>
                {mission.travelDescription}
              </p>
              <div className="travelEncounterProgressCluster">
                <p className="travelEncounterTimer">{formatDuration(remaining)}</p>
                <div className="travelEncounterCountdownBar" aria-hidden="true">
                  <div className="travelEncounterCountdownFill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.55rem" }}>
                {t("missions.travel.travelingTo", { location: mission.template.locationName })}
              </p>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission Battle Arena  (5v5 — reuses CombatActorFrame)
// ─────────────────────────────────────────────────────────────────────────────

type MissionArenaProps = {
  mission: ActiveMissionState;
  hoveredActorId: string | null;
  onToggleFastForward: () => void;
  onHoverActor: (id: string | null) => void;
};

function MissionBattleArenaView({ mission, hoveredActorId, onToggleFastForward, onHoverActor }: MissionArenaProps) {
  const { t } = useTranslation("common");
  const isFastForward = mission.playbackRate === 5;
  const animStyle: CSSProperties = {
    "--combat-animation-duration": `${1470 / mission.playbackRate}ms`,
    "--combat-hit-duration": `${540 / mission.playbackRate}ms`,
    "--combat-summary-cursor-duration": `${900 / mission.playbackRate}ms`,
  } as CSSProperties;

  const hasBg = !!mission.combatBackgroundPath;
  return (
    <section className="contentShell combatEncounterShell">
      <section className="contentStack combatEncounterStackSingle" style={animStyle}>
        <article className="contentCard combatEncounterCard">
          {/* missionsBattlefield adds sizing for >2 actors per lane */}
          <div className={`combatBattlefield missionsBattlefield${hasBg ? " hasBackdrop" : ""}`}>
            {hasBg && (
              <div className="combatBattlefieldBackdrop" aria-hidden="true">
                <img src={mission.combatBackgroundPath} alt="" draggable={false} />
              </div>
            )}
            <button
              type="button"
              className={`combatSpeedToggle combatSpeedToggleOverlay${isFastForward ? " isActive" : ""}`}
              aria-pressed={isFastForward}
              aria-label={t("contracts.fastForward")}
              title={t("contracts.fastForward")}
              onClick={onToggleFastForward}
            >
              &raquo;&raquo;
            </button>

            {/* Enemy lane */}
            <div className="combatLane combatLane-enemy">
              {mission.allEnemies.map((enemy) => (
                <CombatActorFrame
                  key={enemy.id}
                  actor={enemy}
                  currentHp={mission.hpById[enemy.id] ?? enemy.maxHp}
                  label={t("contracts.enemyLabel")}
                  isAttacking={mission.activeAction?.actorId === enemy.id}
                  isHit={mission.impactTargetId === enemy.id}
                  isReferenced={hoveredActorId === enemy.id}
                  isDead={(mission.hpById[enemy.id] ?? enemy.maxHp) <= 0}
                />
              ))}
            </div>

            <div className="combatBattlefieldCenter" aria-hidden="true" />

            {/* Player lane */}
            <div className="combatLane combatLane-player">
              {mission.allPlayers.map((player) => (
                <CombatActorFrame
                  key={player.id}
                  actor={player}
                  currentHp={mission.hpById[player.id] ?? player.maxHp}
                  label={t("contracts.playerLabel")}
                  isAttacking={mission.activeAction?.actorId === player.id}
                  isHit={mission.impactTargetId === player.id}
                  isReferenced={hoveredActorId === player.id}
                  isDead={(mission.hpById[player.id] ?? player.maxHp) <= 0}
                />
              ))}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission Combat Log
// ─────────────────────────────────────────────────────────────────────────────

type MissionLogProps = {
  mission: ActiveMissionState;
  onCloseLog: () => void;
  onReplayCombat: () => void;
  onBackToBoard: () => void;
};

function MissionCombatLogView({ mission, onCloseLog, onReplayCombat, onBackToBoard }: MissionLogProps) {
  const { t } = useTranslation("common");
  const logBodyRef = useRef<HTMLDivElement>(null);
  const isSummaryVisible = mission.resolutionState !== "playing";
  const showSummaryCursor = mission.resolutionState === "summarizing";

  const allActorMap = new Map<string, MissionBattleActor>([
    ...mission.allPlayers.map((p) => [p.id, p] as const),
    ...mission.allEnemies.map((e) => [e.id, e] as const),
  ]);
  const actionEvents = mission.timeline.filter(
    (ev): ev is MissionActionEvent => ev.type === "MissionActionResolved"
  );

  useEffect(() => {
    if (logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
    }
  }, [mission.combatLog.length]);

  return (
    <section className="contentShell combatLogShell">
      <section className="contentStack">
        <article className="contentCard combatLogCard">
          <div className="combatLogToolbar">
            {mission.resolutionState === "awaiting_return" ? (
              <div className="combatLogActionsBar">
                <button type="button" className="combatLogActionButton" onClick={onReplayCombat}>
                  {t("missions.combat.replay")}
                </button>
                <button type="button" className="combatLogActionButton" onClick={onBackToBoard}>
                  {t("missions.combat.backToBoard")}
                </button>
              </div>
            ) : (
              <div />
            )}
            <button
              type="button"
              className="combatLogCloseButton"
              onClick={onCloseLog}
              aria-label={t("chat.close")}
              title={t("chat.close")}
            >
              ×
            </button>
          </div>

          <div className="combatLogBody" ref={logBodyRef}>
            {mission.combatLog.length > 0 ? (
              <ol className="combatLogList">
                {mission.combatLog.map((entry, index) => {
                  const actionEvent = actionEvents[index] ?? null;
                  const attacker = actionEvent ? allActorMap.get(actionEvent.actorId) ?? null : null;
                  const defender = actionEvent ? allActorMap.get(actionEvent.targetId) ?? null : null;
                  return (
                    <li key={actionEvent?.eventId ?? `log-${index}`} className="combatLogMessage">
                      <div className="combatLogPortrait combatLogPortrait-attacker" aria-hidden="true">
                        {attacker?.avatarPath && !attacker.usesSilhouetteFallback ? (
                          <img src={attacker.avatarPath} alt="" className="combatLogPortraitImage" draggable={false} />
                        ) : (
                          <div className="combatActorSilhouette combatLogPortraitFallback" />
                        )}
                      </div>
                      <div className="combatLogMessageText">{entry}</div>
                      <div className="combatLogPortrait combatLogPortrait-defender" aria-hidden="true">
                        {defender?.avatarPath && !defender.usesSilhouetteFallback ? (
                          <img src={defender.avatarPath} alt="" className="combatLogPortraitImage" draggable={false} />
                        ) : (
                          <div className="combatActorSilhouette combatLogPortraitFallback" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="combatLogEmpty">{t("missions.combat.combatBegins")}</p>
            )}

            {isSummaryVisible && (
              <div className="combatSummaryBlock">
                <p className="combatSummaryText">
                  {mission.typedSummaryLine}
                  {showSummaryCursor && <span className="combatSummaryCursor" aria-hidden="true" />}
                </p>
              </div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission History View
// ─────────────────────────────────────────────────────────────────────────────

function MissionHistoryView({
  completed,
  onBack,
}: { completed: CompletedMission[]; onBack: () => void }) {
  const { t } = useTranslation("common");

  return (
    <section className="contentShell">
      <section className="contentStack">
        <article className="contentCard" style={{ padding: "1.25rem 1.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>
              {t("missions.history.title")}
            </h2>
            <button
              type="button"
              className="combatLogActionButton"
              style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
              onClick={onBack}
            >
              {t("missions.history.back")}
            </button>
          </div>

          {completed.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{t("missions.history.empty")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[...completed].reverse().map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: "0.75rem 0.9rem",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background:
                      entry.outcome === "victory"
                        ? "rgba(111,141,95,0.07)"
                        : "rgba(151,80,74,0.07)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{entry.templateName}</span>
                      <span className={difficultyClass(entry.difficulty)} style={{ marginLeft: "0.4rem" }}>
                        {difficultyLabel(entry.difficulty)}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        color: entry.outcome === "victory" ? "var(--accent-success)" : "var(--accent-danger)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.outcome === "victory" ? t("missions.history.victory") : t("missions.history.defeat")}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 0.38rem", fontSize: "0.78rem", color: "var(--text-soft)", fontStyle: "italic" }}>
                    {entry.summaryLine}
                  </p>
                  <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    <span>{t("missions.history.location")}: {entry.locationName}</span>
                    <span>{t("missions.history.turns")}: {entry.turnCount}</span>
                    <span>{t("missions.history.time")}: {formatTimestamp(entry.completedAt)}</span>
                  </div>
                  <div style={{ marginTop: "0.28rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    {t("missions.history.party")}: {entry.participants.map((p) => p.name).join(", ")}
                  </div>
                  <div style={{ marginTop: "0.18rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    {t("missions.history.enemies")}: {entry.enemyNames.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main GuildMissions component
// ─────────────────────────────────────────────────────────────────────────────

export function GuildMissions({ playerName, playerClass, playerPower, playerLevel, onActiveMissionChange }: GuildMissionsProps) {
  const [view, setView] = useState<MissionView>("board");
  const [activeMission, setActiveMission] = useState<ActiveMissionState | null>(null);
  const [completedMissions, setCompletedMissions] = useState<CompletedMission[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isCombatLogVisible, setIsCombatLogVisible] = useState(true);
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);

  // ── 500 ms global tick ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // ── Notify parent when travel/combat phase starts or ends ─────────────
  useEffect(() => {
    const isActive = activeMission !== null &&
      (activeMission.phase === "travel" || activeMission.phase === "combat");
    onActiveMissionChange?.(isActive);
  }, [activeMission?.phase]);

  // ── Auto-join simulation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeMission || activeMission.phase !== "lobby") return;
    const arrived = activeMission.pendingJoiners.filter((j) => nowMs >= j.willJoinAtMs);
    if (arrived.length === 0) return;
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "lobby") return prev;
      const arrivedIds = new Set(arrived.map((j) => j.member.playerId));
      return {
        ...prev,
        members: [
          ...prev.members,
          ...arrived.map((j) => ({ ...j.member, joinedAt: j.willJoinAtMs })),
        ],
        pendingJoiners: prev.pendingJoiners.filter((j) => !arrivedIds.has(j.member.playerId)),
      };
    });
  }, [nowMs, activeMission?.phase, activeMission?.pendingJoiners.length]);

  // ── Auto-start when lobby timer expires ──────────────────────────────────
  useEffect(() => {
    if (!activeMission || activeMission.phase !== "lobby") return;
    if (nowMs < activeMission.startsAt) return;
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "lobby") return prev;
      return buildTravelState(prev, Date.now());
    });
  }, [nowMs, activeMission?.phase, activeMission?.startsAt]);

  // ── Travel → Combat transition ───────────────────────────────────────────
  useEffect(() => {
    if (!activeMission || activeMission.phase !== "travel") return;
    if (!activeMission.travelEndsAt || nowMs < activeMission.travelEndsAt) return;
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "travel") return prev;
      return {
        ...prev,
        phase: "combat",
        travelEndsAt: null,
        segmentPlaybackRate: prev.playbackRate,
        playbackProgressMs: 0,
        lastPlaybackTickAtMs: null,
      };
    });
  }, [nowMs, activeMission?.phase, activeMission?.travelEndsAt]);

  // ── Save history when combat ends ────────────────────────────────────────
  useEffect(() => {
    if (
      !activeMission ||
      activeMission.phase !== "combat" ||
      activeMission.resolutionState !== "summarizing" ||
      !activeMission.finalSummaryLine
    )
      return;

    setCompletedMissions((prev) => {
      if (prev.some((r) => r.id === activeMission.id)) return prev;
      const allEnemiesDead = activeMission.allEnemies.every(
        (e) => (activeMission.hpById[e.id] ?? e.maxHp) <= 0
      );
      const record: CompletedMission = {
        id: activeMission.id,
        templateName: activeMission.template.name,
        difficulty: activeMission.template.difficulty,
        locationName: activeMission.template.locationName,
        participants: activeMission.members.map((m) => ({
          name: m.name,
          isLeader: m.isLeader,
          playerClass: m.playerClass,
        })),
        enemyNames: activeMission.allEnemies.map((e) => e.name),
        outcome: allEnemiesDead ? "victory" : "defeat",
        turnCount: activeMission.timeline.filter((ev) => ev.type === "MissionActionResolved").length,
        completedAt: Date.now(),
        summaryLine: activeMission.finalSummaryLine!,
      };
      return [...prev, record];
    });
  }, [activeMission?.id, activeMission?.resolutionState, activeMission?.finalSummaryLine]);

  // ── Combat playback engine ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeMission || activeMission.phase !== "combat") return;
    if (activeMission.resolutionState === "awaiting_return") return;

    const now = Date.now();

    if (activeMission.lastPlaybackTickAtMs === null) {
      setActiveMission((prev) => {
        if (!prev || prev.phase !== "combat" || prev.lastPlaybackTickAtMs !== null) return prev;
        return { ...prev, segmentPlaybackRate: prev.playbackRate, lastPlaybackTickAtMs: now };
      });
      return;
    }

    const effectiveMs = getMissionPlaybackProgress(activeMission, now);

    // ── Summarizing ──────────────────────────────────────────────────────
    if (activeMission.resolutionState === "summarizing") {
      if (!activeMission.finalSummaryLine) return;
      const typedLen = Math.min(
        activeMission.finalSummaryLine.length,
        Math.floor(effectiveMs / COMBAT_SUMMARY_TYPE_DELAY_MS)
      );
      const nextTyped = activeMission.finalSummaryLine.slice(0, typedLen);

      if (nextTyped !== activeMission.typedSummaryLine) {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.resolutionState !== "summarizing" || !prev.finalSummaryLine) return prev;
          const snap = snapshotMission(prev);
          const tl = Math.min(snap.finalSummaryLine!.length, Math.floor(snap.playbackProgressMs / COMBAT_SUMMARY_TYPE_DELAY_MS));
          return { ...snap, typedSummaryLine: snap.finalSummaryLine!.slice(0, tl) };
        });
        return;
      }

      if (typedLen >= activeMission.finalSummaryLine.length) {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.resolutionState !== "summarizing") return prev;
          return { ...snapshotMission(prev), resolutionState: "awaiting_return" };
        });
        return;
      }

      const nextCharMs = (typedLen + 1) * COMBAT_SUMMARY_TYPE_DELAY_MS;
      const remainRealMs = Math.max(0, (nextCharMs - effectiveMs) / activeMission.segmentPlaybackRate);
      const timer = window.setTimeout(() => {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.resolutionState !== "summarizing") return prev;
          return snapshotMission(prev);
        });
      }, remainRealMs);
      return () => window.clearTimeout(timer);
    }

    const currentEvent = activeMission.timeline[activeMission.currentEventIndex] ?? null;
    if (!currentEvent) return;

    // ── CombatStarted ────────────────────────────────────────────────────
    if (currentEvent.type === "MissionCombatStarted") {
      if (effectiveMs >= COMBAT_START_DELAY_MS) {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.type !== "MissionCombatStarted") return prev;
          return { ...prev, currentEventIndex: prev.currentEventIndex + 1, playbackProgressMs: 0, lastPlaybackTickAtMs: null };
        });
        return;
      }
      const t = window.setTimeout(() => {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.type !== "MissionCombatStarted") return prev;
          return snapshotMission(prev);
        });
      }, Math.max(0, (COMBAT_START_DELAY_MS - effectiveMs) / activeMission.segmentPlaybackRate));
      return () => window.clearTimeout(t);
    }

    // ── ActionResolved ───────────────────────────────────────────────────
    if (currentEvent.type === "MissionActionResolved") {
      const impactMs = playbackThresholdMs(COMBAT_IMPACT_DELAY_MS, activeMission);
      const beatMs   = playbackThresholdMs(COMBAT_BEAT_MS, activeMission);

      if (activeMission.activeAction?.eventId !== currentEvent.eventId) {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.eventId !== currentEvent.eventId) return prev;
          return { ...snapshotMission(prev), segmentPlaybackRate: prev.playbackRate, activeAction: currentEvent, impactTargetId: null };
        });
        return;
      }

      const impactApplied =
        activeMission.impactTargetId === currentEvent.targetId &&
        activeMission.hpById[currentEvent.targetId] === currentEvent.targetHpAfter &&
        activeMission.combatLog.includes(currentEvent.logLine);

      if (!impactApplied && effectiveMs >= impactMs) {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.eventId !== currentEvent.eventId) return prev;
          const snap = snapshotMission(prev);
          return {
            ...snap,
            hpById: { ...snap.hpById, [currentEvent.targetId]: currentEvent.targetHpAfter },
            combatLog: snap.combatLog.includes(currentEvent.logLine)
              ? snap.combatLog
              : [...snap.combatLog, currentEvent.logLine],
            impactTargetId: currentEvent.targetId,
          };
        });
        return;
      }

      if (effectiveMs >= beatMs) {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.eventId !== currentEvent.eventId) return prev;
          return { ...prev, activeAction: null, impactTargetId: null, currentEventIndex: prev.currentEventIndex + 1, playbackProgressMs: 0, lastPlaybackTickAtMs: null };
        });
        return;
      }

      const nextMs = impactApplied ? beatMs : impactMs;
      const actionTimer = window.setTimeout(() => {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.eventId !== currentEvent.eventId) return prev;
          return snapshotMission(prev);
        });
      }, Math.max(0, (nextMs - effectiveMs) / activeMission.segmentPlaybackRate));
      return () => window.clearTimeout(actionTimer);
    }

    // ── CombatEnded ──────────────────────────────────────────────────────
    if (currentEvent.type === "MissionCombatEnded") {
      if (effectiveMs >= COMBAT_START_DELAY_MS) {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.type !== "MissionCombatEnded") return prev;
          return {
            ...prev,
            activeAction: null,
            impactTargetId: null,
            currentEventIndex: prev.currentEventIndex + 1,
            segmentPlaybackRate: prev.playbackRate,
            resolutionState: "summarizing",
            finalSummaryLine: currentEvent.summaryLine,
            typedSummaryLine: "",
            playbackProgressMs: 0,
            lastPlaybackTickAtMs: null,
          };
        });
        return;
      }
      const endTimer = window.setTimeout(() => {
        setActiveMission((prev) => {
          if (!prev || prev.phase !== "combat" || prev.timeline[prev.currentEventIndex]?.type !== "MissionCombatEnded") return prev;
          return snapshotMission(prev);
        });
      }, Math.max(0, (COMBAT_START_DELAY_MS - effectiveMs) / activeMission.segmentPlaybackRate));
      return () => window.clearTimeout(endTimer);
    }
  }, [
    activeMission?.activeAction?.eventId,
    activeMission?.combatLog.length,
    activeMission?.currentEventIndex,
    activeMission?.impactTargetId,
    activeMission?.lastPlaybackTickAtMs,
    activeMission?.phase,
    activeMission?.playbackProgressMs,
    activeMission?.playbackRate,
    activeMission?.resolutionState,
    activeMission?.typedSummaryLine,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleCreateMission(template: MissionTemplate, maxMembers: number, waitTimerMin: number) {
    const now = Date.now();
    const waitMs = waitTimerMin * 60 * 1000;

    const leaderMember: MissionMember = {
      playerId: "player-self",
      name: playerName,
      isLeader: true,
      playerClass,
      power: playerPower > 0 ? playerPower : 80,
      level: playerLevel > 0 ? playerLevel : 1,
      joinedAt: now,
    };

    const poolSize = Math.min(4, maxMembers - 1);
    const rng = mulberry32((now % 999983) ^ 0xdeadbeef);
    const pendingJoiners: MissionAutoJoiner[] = MOCK_GUILD_POOL.slice(0, poolSize).map((m, i) => {
      // Distribute joins across 10%–70% of the wait time
      const fraction = 0.10 + i * 0.18 + rng() * 0.10;
      return {
        member: {
          playerId: `mock-${m.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: m.name,
          isLeader: false,
          playerClass: m.playerClass,
          power: m.power,
          level: m.level,
          joinedAt: 0,
        },
        willJoinAtMs: now + Math.round(waitMs * fraction),
      };
    });

    setActiveMission({
      id: `mission-${now}`,
      template,
      leader: leaderMember,
      members: [leaderMember],
      maxMembers,
      pendingJoiners,
      waitTimerMs: waitMs,
      startsAt: now + waitMs,
      phase: "lobby",
      travelEndsAt: null,
      travelDescription: getMissionTravelDesc(template.difficulty),
      allPlayers: [],
      allEnemies: [],
      timeline: [],
      currentEventIndex: 0,
      hpById: {},
      combatLog: [],
      activeAction: null,
      impactTargetId: null,
      resolutionState: "playing",
      finalSummaryLine: null,
      typedSummaryLine: "",
      playbackRate: 1,
      segmentPlaybackRate: 1,
      playbackProgressMs: 0,
      lastPlaybackTickAtMs: null,
    });
    setView("active");
    setIsCombatLogVisible(true);
    setHoveredActorId(null);
  }

  function handleAddMember(poolMember: { name: string; playerClass: MemberClass; power: number; level: number }) {
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "lobby" || prev.members.length >= prev.maxMembers) return prev;
      const memberId = `mock-${poolMember.name.toLowerCase().replace(/\s+/g, "-")}`;
      if (prev.members.some((m) => m.playerId === memberId)) return prev;
      const newMember: MissionMember = {
        playerId: memberId,
        name: poolMember.name,
        isLeader: false,
        playerClass: poolMember.playerClass,
        power: poolMember.power,
        level: poolMember.level,
        joinedAt: Date.now(),
      };
      return {
        ...prev,
        members: [...prev.members, newMember],
        pendingJoiners: prev.pendingJoiners.filter((j) => j.member.playerId !== memberId),
      };
    });
  }

  function handleRemoveMember(playerId: string) {
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "lobby") return prev;
      const member = prev.members.find((m) => m.playerId === playerId);
      if (!member || member.isLeader) return prev;
      return { ...prev, members: prev.members.filter((m) => m.playerId !== playerId) };
    });
  }

  function handleStartNow() {
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "lobby") return prev;
      return buildTravelState(prev, Date.now());
    });
  }

  function handleAbandonLobby() {
    setActiveMission(null);
    setView("board");
  }

  function handleToggleFastForward() {
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "combat") return prev;
      const nextRate: 1 | 5 = prev.playbackRate === 1 ? 5 : 1;
      return { ...snapshotMission(prev), playbackRate: nextRate, segmentPlaybackRate: nextRate };
    });
  }

  function handleBackToBoard() {
    setActiveMission(null);
    setView("board");
    setHoveredActorId(null);
  }

  function handleReplayCombat() {
    setActiveMission((prev) => {
      if (!prev || prev.phase !== "combat") return prev;
      return {
        ...prev,
        currentEventIndex: 0,
        hpById: buildInitialHpMap(prev.allPlayers, prev.allEnemies),
        combatLog: [],
        activeAction: null,
        impactTargetId: null,
        resolutionState: "playing",
        finalSummaryLine: null,
        typedSummaryLine: "",
        playbackProgressMs: 0,
        lastPlaybackTickAtMs: null,
      };
    });
    setHoveredActorId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (view === "history") {
    return <MissionHistoryView completed={completedMissions} onBack={() => setView("board")} />;
  }

  if (view === "active" && activeMission) {
    if (activeMission.phase === "lobby") {
      return (
        <MissionLobbyView
          mission={activeMission}
          nowMs={nowMs}
          onStartNow={handleStartNow}
          onAbandon={handleAbandonLobby}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      );
    }

    if (activeMission.phase === "travel") {
      return <MissionTravelView mission={activeMission} nowMs={nowMs} />;
    }

    // Combat phase — side-by-side layout (arena left, log right)
    return (
      <div className="missionsCombatLayout">
        <MissionBattleArenaView
          mission={activeMission}
          hoveredActorId={hoveredActorId}
          onToggleFastForward={handleToggleFastForward}
          onHoverActor={setHoveredActorId}
        />
        {isCombatLogVisible && (
          <MissionCombatLogView
            mission={activeMission}
            onCloseLog={() => setIsCombatLogVisible(false)}
            onReplayCombat={handleReplayCombat}
            onBackToBoard={handleBackToBoard}
          />
        )}
      </div>
    );
  }

  return (
    <MissionBoardView
      templates={MISSION_TEMPLATES}
      onCreateMission={handleCreateMission}
      completedCount={completedMissions.length}
      onShowHistory={() => setView("history")}
    />
  );
}
