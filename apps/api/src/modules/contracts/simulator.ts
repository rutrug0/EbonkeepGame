import {
  calculateCombatMitigation,
  combatActorSnapshotSchema,
  combatEventSchema,
  getPveLevelDeltaModifier,
  type CombatActorSnapshot,
  type CombatDamageKind,
  type CombatEvent
} from "@ebonkeep/shared/combat";
import { classToEquipmentGroup, type EquipmentSlotId, type PlayerClass } from "@ebonkeep/shared/core";
import type { PlayerState } from "@ebonkeep/shared/player";

import { allDefinedItemTemplates } from "../inventory/item-service.js";
import {
  clampInt,
  createSeededRng,
  getBiasMultiplier,
  getMonsterLevelCurve,
  getRoleProfile,
  randomChoice,
  randomInt,
  rollBps,
  type EncounterDefinition
} from "./data.js";

const ACTION_COST = 1000;
const MAX_CHAIN_STRIKES = 5;
const MAX_SIMULATION_ACTIONS = 10000;

export type StoredRewardSpec = {
  experience: number;
  ducats: number;
  itemDropChanceBps: number;
  item: null | {
    templateId: string;
    rarity: "common" | "uncommon" | "rare" | "epic";
    itemLevel: number;
    itemName: string;
  };
};

export type RewardItemRollSpec = NonNullable<StoredRewardSpec["item"]>;

type RuntimeActor = CombatActorSnapshot & {
  currentHp: number;
  nextActionAt: number;
  defeated: boolean;
  tieBreaker: number;
};

export function getWeaponDamageKind(playerState: PlayerState): CombatDamageKind {
  const weaponArchetype = playerState.equipment.weapon?.archetype.weaponArchetype;
  if (weaponArchetype === "arcane") return "spell";
  if (weaponArchetype === "ranged") return "ranged";
  return "melee";
}

export function buildPlayerActorSnapshot(args: {
  playerState: PlayerState;
  playerName: string;
}): CombatActorSnapshot {
  const weaponAverageDamage = Math.round(args.playerState.equipment.weapon?.damageRoll?.averageDamage ?? args.playerState.statSnapshot.total.damage);
  const flatDamage = Math.max(0, args.playerState.statSnapshot.total.damage - weaponAverageDamage);
  const weaponMin = args.playerState.equipment.weapon?.damageRoll?.rolledMin ?? args.playerState.statSnapshot.total.damage;
  const weaponMax = args.playerState.equipment.weapon?.damageRoll?.rolledMax ?? args.playerState.statSnapshot.total.damage;

  return combatActorSnapshotSchema.parse({
    id: `player:${args.playerState.playerId}`,
    side: "player",
    encounterOrder: 0,
    name: args.playerName,
    familyId: null,
    monsterRole: null,
    level: args.playerState.level,
    maxHp: Math.max(1, args.playerState.health.max),
    currentHp: Math.max(0, Math.min(args.playerState.health.current, args.playerState.health.max)),
    combatSpeed: Math.max(1, args.playerState.statSnapshot.total.initiative),
    accuracy: Math.max(0, args.playerState.statSnapshot.total.accuracy),
    dodgeChance: Math.max(0, args.playerState.statSnapshot.total.dodgeChance),
    critChance: Math.max(0, args.playerState.statSnapshot.total.critChance),
    critMultiplier: Math.max(15_000, args.playerState.statSnapshot.total.critMultiplier),
    extraAttackChance: Math.max(0, args.playerState.statSnapshot.total.extraAttackChance),
    armor: Math.max(0, args.playerState.statSnapshot.total.armor),
    spellShield: Math.max(0, args.playerState.statSnapshot.total.spellShield),
    missileResistance: Math.max(0, args.playerState.statSnapshot.total.missileResistance),
    physicalDefense: Math.max(0, args.playerState.statSnapshot.total.physicalDefense),
    magicDefense: Math.max(0, args.playerState.statSnapshot.total.magicDefense),
    minDamage: Math.max(0, weaponMin + flatDamage),
    maxDamage: Math.max(0, weaponMax + flatDamage),
    damageKind: getWeaponDamageKind(args.playerState)
  });
}

export function buildMonsterActorSnapshots(args: {
  playerState: PlayerState;
  encounter: EncounterDefinition;
}): CombatActorSnapshot[] {
  const curve = getMonsterLevelCurve(args.encounter.encounterLevel);
  const enemyCount = args.encounter.members.length;
  const hpShare = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.88 : 0.7;
  const damageShare = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.93 : 0.82;
  const defenseShare = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.98 : 0.92;
  const speedShare = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.8 : 0.64;
  const chainShare = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.97 : 0.92;

  return args.encounter.members.map((member, index) => {
    const role = getRoleProfile(member.monsterRole, member.isBoss);
    const bossHpMultiplier = member.isBoss ? 1.8 : 1;
    const bossDamageMultiplier = member.isBoss ? 1.25 : 1;
    const bossDefenseMultiplier = member.isBoss ? 1.25 : 1;

    const maxHp = Math.max(
      1,
      Math.round(
        curve.maxHp *
          hpShare *
          role.hp *
          getBiasMultiplier(member.healthBias) *
          bossHpMultiplier
      )
    );
    const averageDamage = Math.max(
      1,
      Math.round(
        curve.averageDamage *
          damageShare *
          role.damage *
          getBiasMultiplier(member.damageBias) *
          bossDamageMultiplier
      )
    );
    const typedDefense = Math.max(
      0,
      Math.round(
        curve.typedDefense *
          defenseShare *
          role.defense *
          bossDefenseMultiplier
      )
    );
    const bonusDefense = Math.max(
      0,
      Math.round(curve.bonusDefense * defenseShare * role.defense * bossDefenseMultiplier)
    );

    return combatActorSnapshotSchema.parse({
      id: `enemy:${args.encounter.family.familyId}:${member.sequence}:${index}`,
      side: "enemy",
      encounterOrder: index,
      name: member.monsterName,
      familyId: args.encounter.family.familyId,
      monsterRole: member.monsterRole,
      level: Math.max(1, args.encounter.encounterLevel),
      maxHp,
      currentHp: maxHp,
      combatSpeed: Math.max(1, Math.round(curve.combatSpeed * speedShare * role.speed * getBiasMultiplier(member.initiativeBias))),
      accuracy: Math.max(0, Math.round(curve.accuracy * role.accuracy * getBiasMultiplier(member.accuracyBias))),
      dodgeChance: Math.max(0, Math.round(curve.dodgeChance * role.evasion * getBiasMultiplier(member.evasionBias))),
      critChance: Math.max(0, Math.round(curve.critChance * role.crit * getBiasMultiplier(member.critBias))),
      critMultiplier: Math.max(15_000, Math.round(curve.critMultiplier * role.crit * getBiasMultiplier(member.critBias))),
      extraAttackChance: clampInt(
        curve.extraAttackChance * chainShare * role.chain * getBiasMultiplier(member.initiativeBias),
        0,
        3_200
      ),
      armor: Math.max(0, Math.round(typedDefense * getBiasMultiplier(member.armorBias))),
      spellShield: Math.max(0, Math.round(typedDefense * getBiasMultiplier(member.spellShieldBias))),
      missileResistance: Math.max(0, Math.round(typedDefense * getBiasMultiplier(member.missileResistBias))),
      physicalDefense: bonusDefense,
      magicDefense: bonusDefense,
      minDamage: Math.max(1, Math.round(averageDamage * 0.85)),
      maxDamage: Math.max(1, Math.round(averageDamage * 1.15)),
      damageKind: member.damageKind
    });
  });
}

export function buildStoredRewards(args: {
  rng: () => number;
  encounter: EncounterDefinition;
  playerState: PlayerState;
}): StoredRewardSpec {
  const rewardPreview = args.encounter.rewardPreview;
  const experience = randomInt(args.rng, rewardPreview.experienceMin, rewardPreview.experienceMax);
  const ducats = randomInt(args.rng, rewardPreview.ducatsMin, rewardPreview.ducatsMax);
  const item = rollBps(args.rng, rewardPreview.itemDropChanceBps)
    ? rollRewardItemSpec({
        rng: args.rng,
        playerClass: args.playerState.class as PlayerClass,
        encounterLevel: args.encounter.encounterLevel
      })
    : null;

  return {
    experience,
    ducats,
    itemDropChanceBps: rewardPreview.itemDropChanceBps,
    item
  };
}

function pickRewardItemTemplates(args: {
  playerClass: PlayerClass;
  encounterLevel: number;
  allowedSlotId?: EquipmentSlotId;
}) {
  const equipmentGroup = classToEquipmentGroup(args.playerClass);
  const matchesOwnership = (template: (typeof allDefinedItemTemplates)[number]) =>
    template.allowedClass === equipmentGroup || template.allowedClass === "all";
  const matchesSlot = (template: (typeof allDefinedItemTemplates)[number]) =>
    args.allowedSlotId ? template.allowedSlotIds.includes(args.allowedSlotId) : true;

  const exact = allDefinedItemTemplates.filter(
    (template) =>
      matchesOwnership(template) &&
      matchesSlot(template) &&
      template.dropMinLevel <= args.encounterLevel &&
      template.dropMaxLevel >= args.encounterLevel
  );

  if (exact.length > 0) {
    return exact;
  }

  const byBaseLevel = allDefinedItemTemplates.filter(
    (template) =>
      matchesOwnership(template) &&
      matchesSlot(template) &&
      template.baseLevel <= args.encounterLevel + 2 &&
      template.baseLevel >= Math.max(1, args.encounterLevel - 6)
  );

  if (byBaseLevel.length > 0) {
    return byBaseLevel;
  }

  return allDefinedItemTemplates.filter((template) => matchesOwnership(template) && matchesSlot(template));
}

export function rollRewardItemRarity(rng: () => number, encounterLevel: number): RewardItemRollSpec["rarity"] {
  const epicChanceBps = clampInt(100 + (encounterLevel * 10), 100, 1_400);
  const rareChanceBps = clampInt(850 + (encounterLevel * 18), 850, 3_200);
  const uncommonChanceBps = clampInt(2_400 + (encounterLevel * 10), 2_400, 4_000);

  return rollBps(rng, epicChanceBps)
    ? "epic"
    : rollBps(rng, rareChanceBps)
      ? "rare"
      : rollBps(rng, uncommonChanceBps)
        ? "uncommon"
        : "common";
}

export function rollRewardItemSpec(args: {
  rng: () => number;
  playerClass: PlayerClass;
  encounterLevel: number;
  allowedSlotId?: EquipmentSlotId;
}): RewardItemRollSpec | null {
  const templates = pickRewardItemTemplates({
    playerClass: args.playerClass,
    encounterLevel: args.encounterLevel,
    allowedSlotId: args.allowedSlotId
  });
  const template = randomChoice(args.rng, templates);
  if (!template) {
    return null;
  }

  return {
    templateId: template.id,
    rarity: rollRewardItemRarity(args.rng, args.encounterLevel),
    itemLevel: Math.max(1, args.encounterLevel),
    itemName: template.itemName
  };
}

function createRuntimeActor(snapshot: CombatActorSnapshot, rng: () => number): RuntimeActor {
  return {
    ...snapshot,
    currentHp: snapshot.currentHp,
    nextActionAt: ACTION_COST / snapshot.combatSpeed,
    defeated: false,
    tieBreaker: rng()
  };
}

function sortForTurn(left: RuntimeActor, right: RuntimeActor): number {
  if (left.nextActionAt !== right.nextActionAt) return left.nextActionAt - right.nextActionAt;
  if (left.combatSpeed !== right.combatSpeed) return right.combatSpeed - left.combatSpeed;
  if (left.tieBreaker !== right.tieBreaker) return left.tieBreaker - right.tieBreaker;
  if (left.encounterOrder !== right.encounterOrder) return left.encounterOrder - right.encounterOrder;
  return left.id.localeCompare(right.id);
}

function pickTarget(actor: RuntimeActor, actors: RuntimeActor[]): RuntimeActor | null {
  const targetSide = actor.side === "player" ? "enemy" : "player";
  return actors
    .filter((candidate) => candidate.side === targetSide && !candidate.defeated && candidate.currentHp > 0)
    .sort((left, right) => {
      if (left.currentHp !== right.currentHp) return left.currentHp - right.currentHp;
      if (left.encounterOrder !== right.encounterOrder) return left.encounterOrder - right.encounterOrder;
      return left.id.localeCompare(right.id);
    })[0] ?? null;
}

function applyMitigation(rawDamage: number, actor: RuntimeActor, target: RuntimeActor): number {
  return calculateCombatMitigation({
    rawDamage,
    damageKind: actor.damageKind,
    attacker: {
      minDamage: actor.minDamage,
      maxDamage: actor.maxDamage
    },
    defender: target
  }).finalDamage;
}

function snapshotActors(actors: RuntimeActor[]): CombatActorSnapshot[] {
  return actors.map((actor) => combatActorSnapshotSchema.parse({ ...actor, currentHp: actor.currentHp }));
}

export function simulateCombat(args: {
  player: CombatActorSnapshot;
  enemies: CombatActorSnapshot[];
  seed: string;
  playerInvincible?: boolean;
}): CombatEvent[] {
  const rng = createSeededRng(args.seed);
  const actors = [createRuntimeActor(args.player, rng), ...args.enemies.map((enemy) => createRuntimeActor(enemy, rng))];
  const events: CombatEvent[] = [];
  let sequence = 1;

  events.push(combatEventSchema.parse({
    type: "CombatStarted",
    sequence: sequence++,
    timelineTime: 0,
    actors: snapshotActors(actors)
  }));

  for (let actionIndex = 0; actionIndex < MAX_SIMULATION_ACTIONS; actionIndex += 1) {
    const livingPlayers = actors.filter((actor) => actor.side === "player" && !actor.defeated && actor.currentHp > 0);
    const livingEnemies = actors.filter((actor) => actor.side === "enemy" && !actor.defeated && actor.currentHp > 0);
    if (livingPlayers.length === 0 || livingEnemies.length === 0) {
      events.push(combatEventSchema.parse({
        type: "CombatEnded",
        sequence: sequence++,
        timelineTime: Math.max(...actors.map((actor) => actor.nextActionAt), 0),
        winnerSide: livingPlayers.length > 0 ? "player" : "enemy"
      }));
      return events;
    }

    const actor = [...livingPlayers, ...livingEnemies].sort(sortForTurn)[0];
    if (!actor) {
      break;
    }

    const timelineTime = Number(actor.nextActionAt.toFixed(6));
    let target = pickTarget(actor, actors);
    events.push(combatEventSchema.parse({
      type: "CombatTurnStarted",
      sequence: sequence++,
      timelineTime,
      actorId: actor.id,
      targetId: target?.id ?? null
    }));

    if (!target) {
      actor.nextActionAt += ACTION_COST / actor.combatSpeed;
      continue;
    }

    const strikes: Array<{
      strikeIndex: number;
      targetId: string;
      hit: boolean;
      crit: boolean;
      rawDamage: number;
      mitigatedDamage: number;
      targetHpAfter: number;
      killed: boolean;
    }> = [];
    const defeatedActorIds: string[] = [];

    for (let strikeIndex = 1; strikeIndex <= MAX_CHAIN_STRIKES; strikeIndex += 1) {
      if (target.defeated || target.currentHp <= 0) {
        target = pickTarget(actor, actors);
        if (!target) break;
      }

      const levelDeltaModifier = getPveLevelDeltaModifier(actor.level, target.level);
      const adjustedAccuracy = Math.max(
        0,
        Math.round((actor.accuracy * levelDeltaModifier.accuracyMultiplierBps) / 10_000)
      );
      const hitChanceBps = clampInt(adjustedAccuracy * 100 - target.dodgeChance, 2500, 9750);
      const hit = rollBps(rng, hitChanceBps);
      const crit = hit ? rollBps(rng, actor.critChance) : false;
      const rawBaseDamage = hit ? randomInt(rng, actor.minDamage, actor.maxDamage) : 0;
      const critAdjustedDamage = crit
        ? Math.max(0, Math.round((rawBaseDamage * actor.critMultiplier) / 10_000))
        : rawBaseDamage;
      const rawDamage = Math.max(
        0,
        Math.round((critAdjustedDamage * levelDeltaModifier.damageMultiplierBps) / 10_000)
      );
      const mitigatedDamage = hit
        ? args.playerInvincible && actor.side === "enemy" && target.side === "player"
          ? 0
          : applyMitigation(rawDamage, actor, target)
        : 0;

      target.currentHp = Math.max(0, target.currentHp - mitigatedDamage);
      const killed = hit && target.currentHp === 0 && !target.defeated;
      if (killed) {
        target.defeated = true;
        defeatedActorIds.push(target.id);
      }

      strikes.push({
        strikeIndex,
        targetId: target.id,
        hit,
        crit,
        rawDamage,
        mitigatedDamage,
        targetHpAfter: target.currentHp,
        killed
      });

      const noTargetsRemain = actors.filter((candidate) => candidate.side !== actor.side && !candidate.defeated && candidate.currentHp > 0).length === 0;
      if (noTargetsRemain || strikeIndex === MAX_CHAIN_STRIKES || !rollBps(rng, actor.extraAttackChance)) {
        break;
      }
    }

    events.push(combatEventSchema.parse({
      type: "CombatActionResolved",
      sequence: sequence++,
      timelineTime,
      actorId: actor.id,
      actionType: "basic_attack",
      strikes
    }));

    for (const actorId of defeatedActorIds) {
      events.push(combatEventSchema.parse({
        type: "CombatActorDefeated",
        sequence: sequence++,
        timelineTime,
        actorId
      }));
    }

    actor.nextActionAt += ACTION_COST / actor.combatSpeed;
  }

  // ── Action-limit fallback ─────────────────────────────────────────────────
  // Neither side was fully eliminated within MAX_SIMULATION_ACTIONS turns.
  // Determine the winner by average remaining HP percentage, then force-kill
  // the losing side with a synthetic finishing strike so the playback always
  // ends with a conclusive death event rather than everyone appearing alive.
  const livingPlayers = actors.filter((a) => a.side === "player" && !a.defeated && a.currentHp > 0);
  const livingEnemies = actors.filter((a) => a.side === "enemy" && !a.defeated && a.currentHp > 0);

  let timeoutWinnerSide: "player" | "enemy";
  if (livingPlayers.length === 0) {
    timeoutWinnerSide = "enemy";
  } else if (livingEnemies.length === 0) {
    timeoutWinnerSide = "player";
  } else {
    const playerHpPct = livingPlayers.reduce((s, a) => s + a.currentHp / a.maxHp, 0) / livingPlayers.length;
    const enemyHpPct  = livingEnemies.reduce((s, a) => s + a.currentHp / a.maxHp, 0) / livingEnemies.length;
    timeoutWinnerSide = playerHpPct >= enemyHpPct ? "player" : "enemy";
  }

  const timeoutTime = Math.max(...actors.map((a) => a.nextActionAt), 0);
  const losingActors = timeoutWinnerSide === "player" ? livingEnemies : livingPlayers;
  const winningActors = timeoutWinnerSide === "player" ? livingPlayers : livingEnemies;
  const finisherActor = winningActors.sort((a, b) => b.currentHp - a.currentHp)[0];

  for (const loser of losingActors) {
    const killDamage = loser.currentHp;
    events.push(combatEventSchema.parse({
      type: "CombatActionResolved",
      sequence: sequence++,
      timelineTime: timeoutTime,
      actorId: finisherActor?.id ?? loser.id,
      actionType: "basic_attack",
      strikes: [{
        strikeIndex: 1,
        targetId: loser.id,
        hit: true,
        crit: false,
        rawDamage: killDamage,
        mitigatedDamage: killDamage,
        targetHpAfter: 0,
        killed: true
      }]
    }));
    events.push(combatEventSchema.parse({
      type: "CombatActorDefeated",
      sequence: sequence++,
      timelineTime: timeoutTime,
      actorId: loser.id
    }));
    loser.currentHp = 0;
    loser.defeated = true;
  }

  events.push(combatEventSchema.parse({
    type: "CombatEnded",
    sequence: sequence++,
    timelineTime: timeoutTime,
    winnerSide: timeoutWinnerSide
  }));
  return events;
}

export function simulateEncounter(args: {
  playerState: PlayerState;
  playerName: string;
  encounter: EncounterDefinition;
  runId: string;
}) {
  const player = buildPlayerActorSnapshot({
    playerState: args.playerState,
    playerName: args.playerName
  });
  const enemies = buildMonsterActorSnapshots({
    playerState: args.playerState,
    encounter: args.encounter
  });
  const events = simulateCombat({
    player,
    enemies,
    seed: args.runId,
    playerInvincible: args.playerState.cheatSettings.invincibilityEnabled
  });
  const rewardRng = createSeededRng(`${args.runId}:rewards`);
  const rewards = (events[events.length - 1] as Extract<CombatEvent, { type: "CombatEnded" }>).winnerSide === "player"
    ? buildStoredRewards({
        rng: rewardRng,
        encounter: args.encounter,
        playerState: args.playerState
      })
    : {
        experience: 0,
        ducats: 0,
        itemDropChanceBps: args.encounter.rewardPreview.itemDropChanceBps,
        item: null
      };

  return {
    player,
    enemies,
    events,
    rewards,
    winnerSide: (events[events.length - 1] as Extract<CombatEvent, { type: "CombatEnded" }>).winnerSide
  };
}
