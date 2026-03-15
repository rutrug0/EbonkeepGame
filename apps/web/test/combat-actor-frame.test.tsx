import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) =>
      key === "player.level" ? `Level ${options?.value}` : key
  })
}));

import type { CombatPlaybackActor } from "@ebonkeep/shared/combat";

import { CombatActorFrame } from "../src/features/combat";

function createPlaybackActor(overrides: Partial<CombatPlaybackActor>): CombatPlaybackActor {
  return {
    id: "enemy_1",
    side: "enemy",
    name: "Bog Skirmisher",
    maxHp: 72,
    power: 88,
    combatStat: "dexterity",
    rollStats: {
      level: 12,
      damageKind: "ranged",
      minDamage: 11,
      maxDamage: 17,
      combatSpeed: 16,
      accuracy: 93,
      dodgeChance: 1125,
      critChance: 840,
      critMultiplier: 16120,
      extraAttackChance: 540,
      armor: 9,
      spellShield: 6,
      missileResistance: 13,
      physicalDefense: 7,
      magicDefense: 5
    },
    usesSilhouetteFallback: true,
    ...overrides
  };
}

describe("CombatActorFrame", () => {
  it("renders the monster stats tooltip for enemy cards", () => {
    render(
      <CombatActorFrame
        actor={createPlaybackActor({})}
        currentHp={64}
        label="Enemy"
        isAttacking={false}
        isHit={false}
        isReferenced={false}
        isDead={false}
      />
    );

    const enemyCard = screen.getByLabelText("Enemy: Bog Skirmisher, 64 of 72 HP");
    fireEvent.focus(enemyCard);

    expect(enemyCard.getAttribute("aria-describedby")).toContain("combat-actor-stats-enemy_1");
    expect(screen.getByText("profile.offensive")).not.toBeNull();
    expect(screen.getByText("profile.defensive")).not.toBeNull();
    expect(screen.getByText("11-17")).not.toBeNull();
    expect(screen.getByText("Level 12")).not.toBeNull();
  });

  it("does not render the monster stats tooltip for player cards", () => {
    render(
      <CombatActorFrame
        actor={createPlaybackActor({
          id: "player_1",
          side: "player",
          name: "Warden",
          maxHp: 100
        })}
        currentHp={100}
        label="Player"
        isAttacking={false}
        isHit={false}
        isReferenced={false}
        isDead={false}
      />
    );

    const playerCard = screen.getByLabelText("Player: Warden, 100 of 100 HP");
    expect(playerCard.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByText("profile.offensive")).toBeNull();
    expect(screen.queryByText("profile.defensive")).toBeNull();
  });
});
