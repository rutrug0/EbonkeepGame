import { describe, expect, it } from "vitest";

import {
  accountOverviewResponseSchema,
  developerContractsStaticCurvesResponseSchema,
  developerContractSimulationJobSchema,
  gardenStateResponseSchema,
  leaderboardTypeSchema as compatibilityLeaderboardTypeSchema,
  resolveGardenHarvestYield,
  resolveGardenPlotPhase,
  getAllowedClassesForArchetype,
  isItemUsableByClass,
  normalizePlayerClass,
  runDeveloperContractSimulationBodySchema,
  validateVestigeLoadout
} from "../src/index.js";
import { leaderboardTypeSchema } from "../src/domains/leaderboard/index.js";
import {
  mailboxInboxResponseSchema,
  mailboxMessageMutationResponseSchema,
  mailboxReplayResponseSchema,
  sendDirectMailboxMessageBodySchema
} from "../src/domains/messages/index.js";
import { supportedLocaleSchema } from "../src/core/index.js";

describe("shared contracts", () => {
  it("maps archetypes to allowed classes", () => {
    // armor archetypes grouped by equipment group (weapon stat)
    expect(getAllowedClassesForArchetype("armor", "heavy")).toEqual(["juggernaut", "arbalist", "runecaster"]);
    expect(getAllowedClassesForArchetype("weapon", "arcane")).toEqual(["runecaster", "voidcaster", "arcanist"]);
    expect(getAllowedClassesForArchetype("jewelry")).toEqual([
      "juggernaut", "sentinel", "reaver",
      "shade", "arbalist", "disciple",
      "runecaster", "voidcaster", "arcanist"
    ]);
  });

  it("checks whether an item is usable by a class", () => {
    expect(isItemUsableByClass("juggernaut", "weapon", "melee")).toBe(true);
    expect(isItemUsableByClass("juggernaut", "weapon", "arcane")).toBe(false);
    expect(isItemUsableByClass("arcanist", "jewelry")).toBe(true);
  });

  it("normalizes legacy class aliases", () => {
    expect(normalizePlayerClass("chronomancer")).toBe("voidcaster");
  });

  it("validates vestige loadout size and duplicates", () => {
    expect(validateVestigeLoadout(["ashen-sovereign", "emberwake", "first-light"])).toEqual({ valid: true });
    expect(validateVestigeLoadout(["ashen-sovereign", "ashen-sovereign"])).toEqual({
      valid: false,
      reason: "duplicate_vestige"
    });
    expect(validateVestigeLoadout(["ashen-sovereign", "emberwake", "first-light", "hollow-star"])).toEqual({
      valid: false,
      reason: "max_vestiges_exceeded"
    });
  });

  it("exposes domain entrypoints directly", () => {
    expect(supportedLocaleSchema.options).toContain("en");
    expect(leaderboardTypeSchema.options).toEqual(["power", "level"]);
  });

  it("keeps the root barrel as a compatibility re-export", () => {
    expect(compatibilityLeaderboardTypeSchema).toBe(leaderboardTypeSchema);
  });

  it("parses the developer tools account flag", () => {
    expect(accountOverviewResponseSchema.parse({
      accountId: "acct_1",
      username: "warden",
      email: "warden@example.com",
      emailVerified: true,
      developerToolsEnabled: true,
      provider: "dev-guest",
      createdAt: new Date().toISOString(),
      profile: null,
      currency: null
    }).developerToolsEnabled).toBe(true);
  });

  it("parses contracts simulation requests and completed jobs", () => {
    const body = runDeveloperContractSimulationBodySchema.parse({
      playerClass: "juggernaut"
    });

    expect(body.sampleSize).toBe(100);
    expect(
      developerContractSimulationJobSchema.parse({
        jobId: "job_1",
        status: "completed",
        config: {
          playerClass: "juggernaut",
          sampleSize: 200,
          maxLevel: 3
        },
        progress: {
          totalSamples: 600,
          completedSamples: 600,
          currentArchetype: null,
          currentLevel: null,
          currentSampleIndex: null
        },
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        artifactPath: "D:\\Ebonkeep\\artifacts\\contracts-simulations\\contracts-simulation-job_1.json",
        error: null,
        result: {
          playerClass: "juggernaut",
          sampleSize: 200,
          maxLevel: 3,
          archetypes: [
            {
              archetype: "active",
              levels: [
                {
                  level: 1,
                  gearScore: 42,
                  completedSamples: 200,
                  completionRate: 1,
                  avgElapsedSecondsToClearLevel: 20,
                  avgActivePlaySecondsToClearLevel: 10,
                  avgIdleSecondsToClearLevel: 10,
                  avgStaminaWaitSecondsToClearLevel: 4,
                  avgContractAvailabilityWaitSecondsToClearLevel: 6,
                  avgFightsToClearLevel: 2,
                  avgWinsByBand: { under_level: 1, on_level: 1, over_level: 0 },
                  avgLossesByBand: { under_level: 0, on_level: 0, over_level: 1 },
                  winRateByBand: { under_level: 1, on_level: 1, over_level: 0 },
                  avgXpPerFight: 100,
                  avgStaminaCostPerFight: 4,
                  avgStaminaSpent: 8,
                  avgRestCount: 0,
                  avgCombatSeconds: 5,
                  avgInputOverheadSeconds: 5,
                  avgPlayerAttackRoll: 23,
                  avgPlayerHpLossPercent: 18,
                  avgPlayerActionTurnsByBand: { under_level: 4, on_level: 6, over_level: 7 },
                  avgEnemyActionTurnsByBand: { under_level: 3, on_level: 5, over_level: 7 },
                  avgPlayerStrikesByBand: { under_level: 4, on_level: 6, over_level: 8 },
                  avgEnemyStrikesByBand: { under_level: 3, on_level: 5, over_level: 7 },
                  avgPlayerHpLossPercentByBand: { under_level: 6, on_level: 12, over_level: 20 },
                  avgEncounterHpToPlayerHpRatioByBand: { under_level: 0.8, on_level: 0.95, over_level: 1.1 }
                }
              ],
              benchmarkTargetBandHitRateByBand: { under_level: 1, on_level: 0.5, over_level: 0.25 },
              benchmarkTurnTargetHitRateByBand: { under_level: 0.9, on_level: 0.6, over_level: 0.4 }
            },
            {
              archetype: "average",
              levels: [
                {
                  level: 1,
                  gearScore: 42,
                  completedSamples: 200,
                  completionRate: 1,
                  avgElapsedSecondsToClearLevel: 20,
                  avgActivePlaySecondsToClearLevel: 10,
                  avgIdleSecondsToClearLevel: 10,
                  avgStaminaWaitSecondsToClearLevel: 4,
                  avgContractAvailabilityWaitSecondsToClearLevel: 6,
                  avgFightsToClearLevel: 2,
                  avgWinsByBand: { under_level: 1, on_level: 1, over_level: 0 },
                  avgLossesByBand: { under_level: 0, on_level: 0, over_level: 1 },
                  winRateByBand: { under_level: 1, on_level: 1, over_level: 0 },
                  avgXpPerFight: 100,
                  avgStaminaCostPerFight: 4.5,
                  avgStaminaSpent: 8,
                  avgRestCount: 0,
                  avgCombatSeconds: 5,
                  avgInputOverheadSeconds: 5,
                  avgPlayerAttackRoll: 23,
                  avgPlayerHpLossPercent: 18,
                  avgPlayerActionTurnsByBand: { under_level: 4, on_level: 6, over_level: 8 },
                  avgEnemyActionTurnsByBand: { under_level: 3, on_level: 6, over_level: 8 },
                  avgPlayerStrikesByBand: { under_level: 4, on_level: 6, over_level: 9 },
                  avgEnemyStrikesByBand: { under_level: 3, on_level: 6, over_level: 8 },
                  avgPlayerHpLossPercentByBand: { under_level: 7, on_level: 13, over_level: 21 },
                  avgEncounterHpToPlayerHpRatioByBand: { under_level: 0.82, on_level: 0.97, over_level: 1.12 }
                }
              ],
              benchmarkTargetBandHitRateByBand: { under_level: 0.8, on_level: 0.6, over_level: 0.3 },
              benchmarkTurnTargetHitRateByBand: { under_level: 0.85, on_level: 0.65, over_level: 0.45 }
            },
            {
              archetype: "slow",
              levels: [
                {
                  level: 1,
                  gearScore: 42,
                  completedSamples: 200,
                  completionRate: 1,
                  avgElapsedSecondsToClearLevel: 20,
                  avgActivePlaySecondsToClearLevel: 10,
                  avgIdleSecondsToClearLevel: 10,
                  avgStaminaWaitSecondsToClearLevel: 4,
                  avgContractAvailabilityWaitSecondsToClearLevel: 6,
                  avgFightsToClearLevel: 2,
                  avgWinsByBand: { under_level: 1, on_level: 1, over_level: 0 },
                  avgLossesByBand: { under_level: 0, on_level: 0, over_level: 1 },
                  winRateByBand: { under_level: 1, on_level: 1, over_level: 0 },
                  avgXpPerFight: 100,
                  avgStaminaCostPerFight: 5,
                  avgStaminaSpent: 8,
                  avgRestCount: 0,
                  avgCombatSeconds: 5,
                  avgInputOverheadSeconds: 5,
                  avgPlayerAttackRoll: 23,
                  avgPlayerHpLossPercent: 18,
                  avgPlayerActionTurnsByBand: { under_level: 5, on_level: 7, over_level: 8 },
                  avgEnemyActionTurnsByBand: { under_level: 4, on_level: 6, over_level: 8 },
                  avgPlayerStrikesByBand: { under_level: 5, on_level: 7, over_level: 9 },
                  avgEnemyStrikesByBand: { under_level: 4, on_level: 6, over_level: 8 },
                  avgPlayerHpLossPercentByBand: { under_level: 8, on_level: 14, over_level: 24 },
                  avgEncounterHpToPlayerHpRatioByBand: { under_level: 0.85, on_level: 1, over_level: 1.15 }
                }
              ],
              benchmarkTargetBandHitRateByBand: { under_level: 0.7, on_level: 0.5, over_level: 0.4 },
              benchmarkTurnTargetHitRateByBand: { under_level: 0.8, on_level: 0.55, over_level: 0.5 }
            }
          ]
        }
      }).status
    ).toBe("completed");
  });

  it("parses developer contracts static curves", () => {
    expect(
      developerContractsStaticCurvesResponseSchema.parse({
        levels: [
          {
            level: 1,
            averageTravelSeconds: 30,
            averageReplenishSeconds: 60,
            averageStaminaWaitSecondsForContract: 120,
            weightedAverageStaminaWaitSecondsForContract: 100,
            weightedAverageStaminaCostPerContract: 5,
            averageContractAvailabilityWaitSeconds: 20,
            averageExperiencePerContract: {
              under_level: 100,
              on_level: 125,
              over_level: 150
            },
            experienceToNextLevel: 250
          }
        ]
      }).levels
    ).toHaveLength(1);
  });

  it("resolves garden plot phases and yields", () => {
    expect(
      resolveGardenPlotPhase({
        plantId: "bloodleaf",
        now: "2026-03-18T10:00:00.000Z",
        growthEndsAt: "2026-03-18T10:01:30.000Z",
        bloomStartsAt: "2026-03-18T10:02:00.000Z",
        bloomEndsAt: "2026-03-18T10:03:00.000Z",
        wiltAt: "2026-03-18T10:04:00.000Z"
      })
    ).toBe("growing");

    expect(
      resolveGardenPlotPhase({
        plantId: "bloodleaf",
        now: "2026-03-18T10:02:30.000Z",
        growthEndsAt: "2026-03-18T10:01:30.000Z",
        bloomStartsAt: "2026-03-18T10:02:00.000Z",
        bloomEndsAt: "2026-03-18T10:03:00.000Z",
        wiltAt: "2026-03-18T10:04:00.000Z"
      })
    ).toBe("bloom");

    expect(resolveGardenHarvestYield({ plantId: "bloodleaf", phase: "bloom" })).toBe(4);
    expect(resolveGardenHarvestYield({ plantId: "bloodleaf", phase: "post_bloom" })).toBe(2);
    expect(resolveGardenHarvestYield({ plantId: "bloodleaf", phase: "wilted" })).toBe(0);
  });

  it("parses a garden state payload", () => {
    expect(
      gardenStateResponseSchema.parse({
        serverTime: "2026-03-18T10:00:00.000Z",
        unlockedSlotCount: 7,
        plots: [
          {
            slotIndex: 1,
            isUnlocked: true,
            plantId: "bloodleaf",
            phase: "growing",
            plantedAt: "2026-03-18T10:00:00.000Z",
            growthEndsAt: "2026-03-18T10:01:30.000Z",
            bloomStartsAt: "2026-03-18T10:02:00.000Z",
            bloomEndsAt: "2026-03-18T10:03:00.000Z",
            wiltAt: "2026-03-18T10:04:00.000Z",
            nextTransitionAt: "2026-03-18T10:01:30.000Z",
            harvestYield: null
          },
          ...Array.from({ length: 17 }, (_, index) => ({
            slotIndex: index + 2,
            isUnlocked: index < 6,
            plantId: null,
            phase: "empty",
            plantedAt: null,
            growthEndsAt: null,
            bloomStartsAt: null,
            bloomEndsAt: null,
            wiltAt: null,
            nextTransitionAt: null,
            harvestYield: null
          }))
        ],
        inventory: [
          {
            inventoryEntryId: "gdn_seed_1",
            plantId: "bloodleaf",
            kind: "seed",
            itemCode: "seed_bloodleaf",
            displayName: "Bloodleaf Seeds",
            rarity: "common",
            quantity: 5
          }
        ]
      }).inventory[0].kind
    ).toBe("seed");
  });

  it("parses mailbox inbox entries and replay payloads", () => {
    expect(sendDirectMailboxMessageBodySchema.parse({
      recipient: "warden",
      subject: "Supplies delivered",
      body: "Report to the quartermaster."
    }).recipient).toBe("warden");

    expect(mailboxInboxResponseSchema.parse({
      entries: [
        {
          messageId: "msg_1",
          kind: "system_reward",
          sourceType: "auction",
          subject: "Contract complete",
          previewText: "Rewards are ready to claim.",
          senderName: null,
          createdAt: new Date().toISOString(),
          isRead: false,
          hasRewards: true,
          rewardsClaimed: false,
          hasReplay: true
        }
      ],
      unreadCount: 1,
      capabilities: {
        canSendDirect: true,
        canSendGuild: false,
        guildId: null,
        guildName: null
      }
    }).entries[0]?.sourceType).toBe("auction");

    expect(mailboxReplayResponseSchema.parse({
      kind: "combat",
      encounter: {
        encounterId: "enc_1",
        contractInstanceId: "contract_1",
        contractName: "Ashfen Sweep",
        contractLevel: 12,
        levelBand: "on_level",
        familyId: "ashfen_hounds_01",
        locationName: "Ashfen",
        player: {
          id: "player_1",
          side: "player",
          name: "Warden",
          maxHp: 120,
          power: 90,
          combatStat: "strength",
          avatarPath: "/portrait.png",
          usesSilhouetteFallback: false
        },
        enemies: [
          {
            id: "enemy_1",
            side: "enemy",
            name: "Ash Hound",
            maxHp: 80,
            power: 65,
            combatStat: "strength",
            avatarPath: "/enemy.png",
            usesSilhouetteFallback: false
          }
        ]
      },
      timeline: [
        {
          type: "CombatPlaybackStarted",
          eventId: "evt_start",
          encounterId: "enc_1"
        },
        {
          type: "CombatPlaybackEnded",
          eventId: "evt_end",
          encounterId: "enc_1",
          winnerSide: "player",
          summaryLine: "Ash Hound was defeated."
        }
      ]
    }).kind).toBe("combat");

    expect(mailboxInboxResponseSchema.parse({
      entries: [],
      unreadCount: 0,
      capabilities: {
        canSendDirect: true,
        canSendGuild: false,
        guildId: null,
        guildName: null
      }
    }).entries).toHaveLength(0);
  });

  it("parses mailbox mutation responses for updates and deletions", () => {
    expect(mailboxMessageMutationResponseSchema.parse({
      message: {
        messageId: "msg_1",
        kind: "direct",
        sourceType: "player",
        subject: "Quartermaster notice",
        body: "Supplies are waiting.",
        senderName: "Sender",
        senderPlayerId: "player_sender",
        guildId: null,
        createdAt: new Date().toISOString(),
        readAt: null,
        claimedAt: null,
        rewards: null,
        hasReplay: false
      },
      deletedMessageId: null,
      unreadCount: 1
    }).message?.subject).toBe("Quartermaster notice");

    expect(mailboxMessageMutationResponseSchema.parse({
      message: null,
      deletedMessageId: "msg_1",
      unreadCount: 0
    }).deletedMessageId).toBe("msg_1");
  });
});
