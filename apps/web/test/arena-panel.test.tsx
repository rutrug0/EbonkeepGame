import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ArenaStateResponse } from "@ebonkeep/shared/arena";

import { __resetArenaPanelCacheForTests, ArenaPanel } from "../src/features/arena/ArenaPanel";

const arenaApiMocks = vi.hoisted(() => ({
  fetchArenaState: vi.fn(),
  findArenaOpponents: vi.fn(),
  fightArenaOffer: vi.fn()
}));

const arenaServerPlaybackMocks = vi.hoisted(() => ({
  buildArenaCombatState: vi.fn()
}));

const i18nMocks = vi.hoisted(() => ({
  t: (key: string, options?: Record<string, string | number>) => {
    if (options?.duration) {
      return `${key}:${options.duration}`;
    }
    if (options?.rank) {
      return `${key}:${options.rank}`;
    }
    if (options?.value) {
      return `${key}:${options.value}`;
    }
    if (options?.opponent && options?.delta) {
      return `${key}:${options.opponent}:${options.delta}`;
    }
    return key;
  }
}));

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {}
  },
  useTranslation: () => ({
    t: i18nMocks.t
  })
}));

vi.mock("../src/features/arena/api", () => ({
  fetchArenaState: arenaApiMocks.fetchArenaState,
  findArenaOpponents: arenaApiMocks.findArenaOpponents,
  fightArenaOffer: arenaApiMocks.fightArenaOffer
}));

vi.mock("../src/features/arena/serverPlayback", () => ({
  buildArenaCombatState: arenaServerPlaybackMocks.buildArenaCombatState
}));

vi.mock("../src/features/combat", () => ({
  CombatEncounterArenaPanel: () => <div>combat-arena-panel</div>,
  CombatEncounterLogPanel: () => <div>combat-log-panel</div>,
  CombatEncounterTurnTrackPanel: () => <div>combat-turn-track</div>
}));

function createArenaState(overrides?: Partial<ArenaStateResponse>): ArenaStateResponse {
  return {
    serverTime: new Date().toISOString(),
    profile: {
      entryId: "entry_1",
      rating: 1000,
      wins: 0,
      losses: 0,
      rank: 12,
      cooldownEndsAt: null
    },
    offers: [],
    ladder: {
      entries: [],
      currentPlayerRank: 12
    },
    recentMatches: [],
    canFindOpponents: true,
    ...overrides
  };
}

describe("arena panel", () => {
  beforeEach(() => {
    __resetArenaPanelCacheForTests();
    arenaApiMocks.fetchArenaState.mockReset();
    arenaApiMocks.findArenaOpponents.mockReset();
    arenaApiMocks.fightArenaOffer.mockReset();
    arenaServerPlaybackMocks.buildArenaCombatState.mockReset();
  });

  it("reuses the warm arena response on remount without flashing the loading shell", async () => {
    arenaApiMocks.fetchArenaState
      .mockResolvedValueOnce(createArenaState({
        offers: [
          {
            offerId: "offer_1",
            offeredAt: new Date().toISOString(),
            cooldownEndsAt: new Date(Date.now() + 600_000).toISOString(),
            opponent: {
              entryId: "mock_1",
              displayName: "Storm Harrier",
              class: "reaver",
              level: 58,
              gearScore: 1300,
              rating: 1012,
              wins: 5,
              losses: 3,
              source: "mock",
              weaponLabel: "Durnholde Axe",
              previewStats: {
                mainDamage: 700,
                maxHitpoints: 3900,
                combatSpeed: 140,
                armor: 200
              }
            }
          }
        ]
      }))
      .mockImplementationOnce(() => new Promise(() => {}));

    const firstRender = render(
      <ArenaPanel
        token="token"
        hasPlayerState
        playerName="Warden"
        playerAvatarPath="/portrait.png"
        formatDurationFromMs={() => "10m 00s"}
      />
    );

    expect(await screen.findByText("arena.chooseOpponent")).toBeTruthy();

    firstRender.unmount();

    render(
      <ArenaPanel
        token="token"
        hasPlayerState
        playerName="Warden"
        playerAvatarPath="/portrait.png"
        formatDurationFromMs={() => "10m 00s"}
      />
    );

    expect(screen.queryByText("arena.loading")).toBeNull();
    expect(screen.getByText("arena.chooseOpponent")).toBeTruthy();
  });

  it("renders the find-opponent empty state and shows offers after search", async () => {
    arenaApiMocks.fetchArenaState.mockResolvedValue(createArenaState());
    arenaApiMocks.findArenaOpponents.mockResolvedValueOnce(
      createArenaState({
        canFindOpponents: false,
        profile: {
          entryId: "entry_1",
          rating: 1000,
          wins: 0,
          losses: 0,
          rank: 12,
          cooldownEndsAt: new Date(Date.now() + 600_000).toISOString()
        },
        offers: [
          {
            offerId: "offer_1",
            offeredAt: new Date().toISOString(),
            cooldownEndsAt: new Date(Date.now() + 600_000).toISOString(),
            opponent: {
              entryId: "mock_1",
              displayName: "Storm Harrier",
              class: "reaver",
              level: 58,
              gearScore: 1300,
              rating: 1012,
              wins: 5,
              losses: 3,
              source: "mock",
              weaponLabel: "Durnholde Axe",
              previewStats: {
                mainDamage: 700,
                maxHitpoints: 3900,
                combatSpeed: 140,
                armor: 200
              }
            }
          }
        ]
      })
    );

    render(
      <ArenaPanel
        token="token"
        hasPlayerState
        playerName="Warden"
        playerAvatarPath="/portrait.png"
        formatDurationFromMs={() => "10m 00s"}
      />
    );

    expect(await screen.findByText("arena.findOpponent")).toBeTruthy();

    fireEvent.click(screen.getByText("arena.findOpponent"));

    await waitFor(() => {
      expect(arenaApiMocks.findArenaOpponents).toHaveBeenCalledWith("token");
    });

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Storm Harrier")).toBeTruthy();
    expect(screen.getByText("arena.fightNow")).toBeTruthy();
  });

  it("switches into replay mode after a duel is resolved", async () => {
    arenaApiMocks.fetchArenaState.mockResolvedValue(
      createArenaState({
        canFindOpponents: false,
        offers: [
          {
            offerId: "offer_2",
            offeredAt: new Date().toISOString(),
            cooldownEndsAt: new Date(Date.now() + 600_000).toISOString(),
            opponent: {
              entryId: "mock_2",
              displayName: "Ash Champion",
              class: "juggernaut",
              level: 60,
              gearScore: 1400,
              rating: 1008,
              wins: 6,
              losses: 4,
              source: "mock",
              weaponLabel: "Wardbreaker Maul",
              previewStats: {
                mainDamage: 720,
                maxHitpoints: 4100,
                combatSpeed: 120,
                armor: 260
              }
            }
          }
        ]
      })
    );
    arenaApiMocks.fightArenaOffer.mockResolvedValueOnce({
      matchId: "match_1",
      winnerSide: "player",
      ratingDelta: 16,
      profile: {
        entryId: "entry_1",
        rating: 1016,
        wins: 1,
        losses: 0,
        rank: 10,
        cooldownEndsAt: new Date(Date.now() + 600_000).toISOString()
      },
      ladder: {
        entries: [],
        currentPlayerRank: 10
      },
      recentMatches: [],
      encounter: {} as never,
      events: []
    });
    arenaServerPlaybackMocks.buildArenaCombatState.mockReturnValue({
      encounter: {
        encounterId: "encounter_1",
        contractInstanceId: "match_1",
        contractName: "Arena Duel",
        contractLevel: 60,
        levelBand: "on_level",
        locationName: "Ash Court Arena",
        travelImageMode: "silhouette",
        player: {
          id: "player",
          side: "player",
          name: "Warden",
          maxHp: 100,
          power: 100,
          combatStat: "strength",
          usesSilhouetteFallback: true
        },
        enemies: [
          {
            id: "enemy",
            side: "enemy",
            name: "Ash Champion",
            maxHp: 100,
            power: 100,
            combatStat: "strength",
            usesSilhouetteFallback: true
          }
        ]
      },
      timeline: [],
      currentEventIndex: 0,
      hpByActorId: { player: 100, enemy: 100 },
      combatLogEntries: [],
      combatLogEventIds: [],
      activeAction: null,
      impactTargetId: null,
      resolutionState: "awaiting_return",
      finalSummaryLine: null,
      typedSummaryLine: "",
      playbackRate: 1,
      segmentPlaybackRate: 1,
      playbackProgressMs: 0,
      lastPlaybackTickAtMs: null
    });

    render(
      <ArenaPanel
        token="token"
        hasPlayerState
        playerName="Warden"
        playerAvatarPath="/portrait.png"
        formatDurationFromMs={() => "10m 00s"}
      />
    );

    expect(await screen.findByRole("button", { name: "arena.chooseOpponent" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "arena.chooseOpponent" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Ash Champion")).toBeTruthy();

    fireEvent.click(screen.getByText("arena.fightNow"));

    await waitFor(() => {
      expect(arenaApiMocks.fightArenaOffer).toHaveBeenCalledWith("token", "offer_2");
    });

    expect(await screen.findByText("arena.combatReplayTitle")).toBeTruthy();
    expect(screen.getByText("combat-arena-panel")).toBeTruthy();
    expect(screen.getByText("combat-log-panel")).toBeTruthy();
  });
});
