import { describe, expect, it } from "vitest";

import { generateMissionTimeline, type MissionBattleActor } from "../src/features/guild/GuildMissions";

function actor(overrides: Partial<MissionBattleActor>): MissionBattleActor {
  return {
    id: "actor",
    side: "player",
    encounterOrder: 0,
    name: "Actor",
    maxHp: 200,
    power: 100,
    threat: 50,
    combatStat: "strength",
    ...overrides
  };
}

function firstActorTarget(args: {
  encounterId: string;
  actorId: string;
  players: MissionBattleActor[];
  enemies: MissionBattleActor[];
  seed: number;
}): string | null {
  const timeline = generateMissionTimeline(args.encounterId, args.players, args.enemies, args.seed);
  const firstAction = timeline.events.find(
    (event) => event.type === "MissionActionResolved" && event.actorId === args.actorId
  );

  return firstAction?.type === "MissionActionResolved" ? firstAction.targetId : null;
}

describe("guild mission threat targeting", () => {
  it("selects from top-3 threat targets only", () => {
    const players = [actor({ id: "player-1", side: "player", power: 220, threat: 110 })];
    const enemies = [
      actor({ id: "enemy-1", side: "enemy", encounterOrder: 0, power: 80, threat: 500 }),
      actor({ id: "enemy-2", side: "enemy", encounterOrder: 1, power: 78, threat: 250 }),
      actor({ id: "enemy-3", side: "enemy", encounterOrder: 2, power: 76, threat: 250 }),
      actor({ id: "enemy-4", side: "enemy", encounterOrder: 3, power: 74, threat: 1 })
    ];

    const selectedTargets = new Set<string>();
    for (let index = 0; index < 150; index += 1) {
      const targetId = firstActorTarget({
        encounterId: `enc-top3-${index}`,
        actorId: "player-1",
        players,
        enemies,
        seed: index
      });
      if (targetId) {
        selectedTargets.add(targetId);
      }
    }

    expect(selectedTargets.has("enemy-4")).toBe(false);
    expect(selectedTargets.has("enemy-1")).toBe(true);
    expect(selectedTargets.has("enemy-2")).toBe(true);
    expect(selectedTargets.has("enemy-3")).toBe(true);
  });

  it("weights top-3 threat targeting around a 50/25/25 split", () => {
    const players = [actor({ id: "player-1", side: "player", power: 240, threat: 120 })];
    const enemies = [
      actor({ id: "enemy-1", side: "enemy", encounterOrder: 0, power: 80, threat: 500 }),
      actor({ id: "enemy-2", side: "enemy", encounterOrder: 1, power: 78, threat: 250 }),
      actor({ id: "enemy-3", side: "enemy", encounterOrder: 2, power: 76, threat: 250 }),
      actor({ id: "enemy-4", side: "enemy", encounterOrder: 3, power: 74, threat: 0 })
    ];

    const counts = {
      "enemy-1": 0,
      "enemy-2": 0,
      "enemy-3": 0,
      "enemy-4": 0
    };

    for (let index = 0; index < 300; index += 1) {
      const targetId = firstActorTarget({
        encounterId: `enc-weight-${index}`,
        actorId: "player-1",
        players,
        enemies,
        seed: index
      });
      if (targetId && targetId in counts) {
        counts[targetId as keyof typeof counts] += 1;
      }
    }

    expect(counts["enemy-4"]).toBe(0);
    expect(counts["enemy-1"]).toBeGreaterThan(120);
    expect(counts["enemy-1"]).toBeLessThan(180);
    expect(counts["enemy-2"]).toBeGreaterThan(45);
    expect(counts["enemy-2"]).toBeLessThan(105);
    expect(counts["enemy-3"]).toBeGreaterThan(45);
    expect(counts["enemy-3"]).toBeLessThan(105);
  });
});
