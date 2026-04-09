import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerState } from "@ebonkeep/shared/player";

import { MessagesPanel } from "../src/features/messages/MessagesPanel";

const translationMock = vi.hoisted(() => {
  const labels: Record<string, string> = {
    "messages.eyebrow": "Mailbox",
    "messages.title": "Messages",
    "messages.composeDirect": "Direct Mail",
    "messages.source.contracts": "Contracts",
    "messages.badges.claimable": "Claimable",
    "messages.openReplay": "Replay Combat",
    "messages.claimRewards": "Claim Rewards",
    "messages.detailLoading": "Loading message...",
    "messages.backToMessage": "Back to message",
    "messages.replayAgain": "Replay combat",
    "messages.rewardsTitle": "Rewards",
    "messages.rewards.renown": "Renown",
    "messages.rewards.ducats": "Ducats",
    "messages.claimSuccess": "Rewards claimed.",
    "currencies.ducats": "Ducats",
    "currencies.imperials": "Imperials"
  };

  return {
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "messages.unreadCount") {
        return `${String(options?.count ?? 0)} unread`;
      }
      return labels[key] ?? key;
    }
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => translationMock
}));

const mailboxApiMocks = vi.hoisted(() => ({
  fetchMailbox: vi.fn(),
  fetchMailboxMessage: vi.fn(),
  markMailboxMessageRead: vi.fn(),
  claimMailboxMessage: vi.fn(),
  fetchMailboxReplay: vi.fn(),
  sendDirectMailboxMessage: vi.fn(),
  sendGuildMailboxMessage: vi.fn()
}));

const combatComponentMocks = vi.hoisted(() => ({
  CombatEncounterArenaPanel: vi.fn(() => <div data-testid="combat-arena" />),
  CombatEncounterLogPanel: vi.fn(() => <div data-testid="combat-log" />),
  CombatEncounterTurnTrackPanel: vi.fn(() => <div data-testid="combat-turn-track" />)
}));

vi.mock("../src/features/messages/api", () => ({
  fetchMailbox: mailboxApiMocks.fetchMailbox,
  fetchMailboxMessage: mailboxApiMocks.fetchMailboxMessage,
  markMailboxMessageRead: mailboxApiMocks.markMailboxMessageRead,
  claimMailboxMessage: mailboxApiMocks.claimMailboxMessage,
  fetchMailboxReplay: mailboxApiMocks.fetchMailboxReplay,
  sendDirectMailboxMessage: mailboxApiMocks.sendDirectMailboxMessage,
  sendGuildMailboxMessage: mailboxApiMocks.sendGuildMailboxMessage
}));

vi.mock("../src/features/combat", () => ({
  CombatEncounterArenaPanel: combatComponentMocks.CombatEncounterArenaPanel,
  CombatEncounterLogPanel: combatComponentMocks.CombatEncounterLogPanel,
  CombatEncounterTurnTrackPanel: combatComponentMocks.CombatEncounterTurnTrackPanel,
  combatPlaybackActionResolvedSchema: {
    parse: <T,>(value: T) => value
  }
}));

vi.mock("../src/features/contracts", () => ({
  COMBAT_PLAYBACK_BEAT_MS: 400,
  COMBAT_PLAYBACK_IMPACT_DELAY_MS: 200,
  COMBAT_PLAYBACK_START_DELAY_MS: 300,
  COMBAT_SUMMARY_TYPE_DELAY_MS: 40,
  getEncounterAnimationRate: () => 1,
  getEncounterPlaybackProgress: () => 0,
  getEncounterPlaybackThresholdMs: (value: number) => value,
  hydratePlaybackEncounterAssets: ({ encounter, playerAvatarPath }: { encounter: { player: Record<string, unknown> }; playerAvatarPath?: string | null }) => ({
    ...encounter,
    player: {
      ...encounter.player,
      avatarPath: encounter.player.avatarPath ?? playerAvatarPath ?? undefined,
      usesSilhouetteFallback: !(encounter.player.avatarPath ?? playerAvatarPath)
    }
  }),
  resetCombatEncounterPlayback: <T,>(value: T) => value,
  skipToEndCombatPlayback: <T,>(value: T) => value,
  snapshotEncounterPlayback: <T,>(value: T) => value
}));

vi.mock("../src/features/guild/GuildRaidBattlefield", () => ({
  GuildRaidBattlefield: () => <div data-testid="guild-raid-battlefield" />
}));

const inboxResponse = {
  entries: [
    {
      messageId: "msg_1",
      kind: "system_reward" as const,
      sourceType: "contracts" as const,
      subject: "Contract complete",
      previewText: "Rewards are ready to claim.",
      senderName: null,
      createdAt: "2026-04-09T10:00:00.000Z",
      isRead: false,
      hasRewards: true,
      rewardsClaimed: false,
      hasReplay: true
    },
    {
      messageId: "msg_2",
      kind: "system_reward" as const,
      sourceType: "contracts" as const,
      subject: "Mirepool Contract Lv 8",
      previewText: "Another reward report is waiting.",
      senderName: null,
      createdAt: "2026-04-09T09:30:00.000Z",
      isRead: true,
      hasRewards: true,
      rewardsClaimed: false,
      hasReplay: false
    }
  ],
  unreadCount: 1,
  capabilities: {
    canSendDirect: true,
    canSendGuild: false,
    guildId: null,
    guildName: null
  }
};

const unreadMessage = {
  messageId: "msg_1",
  kind: "system_reward" as const,
  sourceType: "contracts" as const,
  subject: "Contract complete",
  body: "The contract report is attached.",
  senderName: null,
  senderPlayerId: null,
  guildId: null,
  createdAt: "2026-04-09T10:00:00.000Z",
  readAt: null,
  claimedAt: null,
  rewards: {
    experience: 0,
    ducats: 75,
    imperials: 0,
    renown: 0,
    items: [
      {
        id: "reward_item_1",
        itemCode: "mail_sword",
        quantity: 1,
        itemName: "Mail Sword",
        rarity: "rare" as const,
        category: "Weapon",
        equipable: true,
        levelRequirement: 1,
        allowedSlotIds: ["weapon"] as const,
        baseLevel: 1,
        power: 18,
        archetype: {
          majorCategory: "weapon" as const,
          weaponArchetype: "melee" as const,
          weaponFamily: "sword" as const
        },
        statBonuses: {},
        description: "Forged for the courier guard."
      }
    ]
  },
  hasReplay: true
};

const nextAttentionMessage = {
  messageId: "msg_2",
  kind: "system_reward" as const,
  sourceType: "contracts" as const,
  subject: "Mirepool Contract Lv 8",
  body: "The Mirepool spoils are ready.",
  senderName: null,
  senderPlayerId: null,
  guildId: null,
  createdAt: "2026-04-09T09:30:00.000Z",
  readAt: "2026-04-09T09:31:00.000Z",
  claimedAt: null,
  rewards: {
    experience: 0,
    ducats: 15,
    imperials: 0,
    renown: 0,
    items: []
  },
  hasReplay: false
};

const combatReplayResponse = {
  kind: "combat" as const,
  encounter: {
    encounterId: "enc_1",
    contractInstanceId: "contract_1",
    contractName: "Contract complete",
    contractLevel: 8,
    levelBand: "on_level" as const,
    familyId: "snagtooth_hollow_00",
    locationName: "Snagtooth Hollow",
    player: {
      id: "player:player_1",
      side: "player" as const,
      name: "Warden",
      maxHp: 120,
      power: 90,
      combatStat: "strength" as const
    },
    enemies: [
      {
        id: "enemy_1",
        side: "enemy" as const,
        name: "Snagtooth Boss",
        maxHp: 80,
        power: 65,
        combatStat: "strength" as const
      }
    ]
  },
  timeline: [
    {
      type: "CombatPlaybackStarted" as const,
      eventId: "evt_start",
      encounterId: "enc_1"
    },
    {
      type: "CombatPlaybackEnded" as const,
      eventId: "evt_end",
      encounterId: "enc_1",
      winnerSide: "player" as const,
      summaryLine: "Contract complete."
    }
  ]
};

const playerState = {
  playerId: "player_1",
  accountId: "account_1",
  class: "warrior",
  portraitId: "portrait_1",
  backgroundId: "background_1",
  preferredLocale: "en",
  level: 10,
  experience: 0,
  experienceIntoLevel: 0,
  experienceToNextLevel: 100,
  gearScore: 10,
  health: {
    current: 100,
    max: 100,
    nextPointAt: null
  },
  stamina: {
    current: 10,
    max: 10,
    nextPointAt: null
  },
  stats: {
    strength: 10,
    intelligence: 5,
    dexterity: 6,
    vitality: 8,
    initiative: 4,
    luck: 3
  },
  statSnapshot: {
    armor: 0,
    spellShield: 0,
    missileResistance: 0,
    meleeDamage: 0,
    rangedDamage: 0,
    spellDamage: 0,
    maxHitpoints: 100,
    critChance: 0,
    critDamage: 0,
    extraAttackChance: 0,
    threat: 0
  },
  activeConsumables: [],
  inventory: [],
  equipment: {
    helmet: null,
    necklace: null,
    upperArmor: null,
    belt: null,
    ringLeft: null,
    weapon: null,
    pauldrons: null,
    gloves: null,
    lowerArmor: null,
    boots: null,
    ringRight: null,
    vestige1: null,
    vestige2: null,
    vestige3: null
  },
  currency: {
    ducats: 0,
    imperials: 0,
    renown: 0
  },
  cheatSettings: {
    fastTravelEnabled: false,
    fastContractReplenishEnabled: false,
    fastArenaReplenishEnabled: false,
    invincibilityEnabled: false,
    fastTrainTimeEnabled: false,
    fastCraftTimeEnabled: false,
    unlimitedAcademyDonationsEnabled: false,
    unlimitedForgeConsumablesEnabled: false,
    unlimitedRefineryMaterialsEnabled: false
  }
} as unknown as PlayerState;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("messages panel", () => {
  beforeEach(() => {
    Object.values(mailboxApiMocks).forEach((mock) => mock.mockReset());
    Object.values(combatComponentMocks).forEach((mock) => mock.mockClear());
    mailboxApiMocks.fetchMailbox.mockResolvedValue(inboxResponse);
    mailboxApiMocks.fetchMailboxMessage.mockImplementation(async (_token: string, messageId: string) => {
      if (messageId === "msg_2") {
        return nextAttentionMessage;
      }
      return unreadMessage;
    });
    mailboxApiMocks.fetchMailboxReplay.mockResolvedValue(combatReplayResponse);
    mailboxApiMocks.markMailboxMessageRead.mockImplementation(async (_token: string, messageId: string) => {
      if (messageId === "msg_2") {
        return {
          message: nextAttentionMessage,
          unreadCount: 0
        };
      }

      return {
        message: {
          ...unreadMessage,
          readAt: "2026-04-09T10:01:00.000Z"
        },
        unreadCount: 0
      };
    });
    mailboxApiMocks.claimMailboxMessage.mockResolvedValue({
      message: null,
      deletedMessageId: "msg_1",
      unreadCount: 0
    });
  });

  it("loads inbox detail, claims rewards, and advances to the next message needing attention", async () => {
    const handleUnreadCountChange = vi.fn();
    const handleRewardsClaimed = vi.fn();

    render(
      <MessagesPanel
        token="token"
        playerState={playerState}
        onUnreadCountChange={handleUnreadCountChange}
        onRewardsClaimed={handleRewardsClaimed}
      />
    );

    expect((await screen.findAllByText("Contract complete")).length).toBeGreaterThan(0);
    expect(await screen.findByText("The contract report is attached.")).toBeTruthy();
    expect(screen.queryByText("120 Experience")).toBeNull();
    expect(await screen.findByText("75")).toBeTruthy();
    expect(await screen.findByTestId("message-reward-item-reward_item_1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Claim Rewards" }));

    await waitFor(() => {
      expect(mailboxApiMocks.claimMailboxMessage).toHaveBeenCalledWith("token", "msg_1");
    });

    await waitFor(() => {
      expect(handleRewardsClaimed).toHaveBeenCalledTimes(1);
    });
    expect(handleRewardsClaimed).toHaveBeenCalledWith({
      ducats: 75,
      imperials: 0
    });
    expect(handleUnreadCountChange).toHaveBeenCalledWith(1);
    expect(handleUnreadCountChange).toHaveBeenCalledWith(0);
    await waitFor(() => {
      expect(screen.queryByTestId("message-reward-item-reward_item_1")).toBeNull();
    });
    expect(screen.queryByRole("button", { name: /Contract complete/i })).toBeNull();
    expect(screen.queryByText("Rewards claimed.")).toBeNull();
    expect(await screen.findByText("The Mirepool spoils are ready.")).toBeTruthy();
  });

  it("hydrates mailbox combat replay with the current player portrait path", async () => {
    render(
      <MessagesPanel
        token="token"
        playerState={playerState}
        playerAvatarPath="/portraits/current-player.png"
      />
    );

    expect(await screen.findByText("The contract report is attached.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Replay Combat" }));

    await waitFor(() => {
      expect(mailboxApiMocks.fetchMailboxReplay).toHaveBeenCalledWith("token", "msg_1");
    });

    await waitFor(() => {
      expect(combatComponentMocks.CombatEncounterArenaPanel).toHaveBeenCalled();
    });

    const latestArenaCall = combatComponentMocks.CombatEncounterArenaPanel.mock.calls.at(-1);
    expect(latestArenaCall?.[0].encounter.player.avatarPath).toBe("/portraits/current-player.png");
    expect(latestArenaCall?.[0].backButtonLabel).toBe("Back to message");
    expect(latestArenaCall?.[0].replayButtonLabel).toBe("Replay combat");
  });

  it("keeps the current message visible while the next detail loads", async () => {
    const deferredMessage = createDeferred<typeof nextAttentionMessage>();
    mailboxApiMocks.fetchMailboxMessage.mockImplementation(async (_token: string, messageId: string) => {
      if (messageId === "msg_2") {
        return deferredMessage.promise;
      }
      return unreadMessage;
    });

    render(
      <MessagesPanel
        token="token"
        playerState={playerState}
      />
    );

    expect(await screen.findByText("The contract report is attached.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Mirepool Contract Lv 8/i }));

    expect(screen.getByText("The contract report is attached.")).toBeTruthy();
    expect(screen.queryByText("Loading message...")).toBeNull();

    deferredMessage.resolve(nextAttentionMessage);

    expect(await screen.findByText("The Mirepool spoils are ready.")).toBeTruthy();
  });
});
