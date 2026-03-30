import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  combatActorSnapshotSchema,
  combatEventSchema,
  developerContractsStaticCurvesResponseSchema
} from "@ebonkeep/shared/combat";

import {
  getContractReplenishPacingRow,
  resolveContractTravelDurationSeconds
} from "../../src/config/activity-pacing.js";
import { resetDeveloperContractSimulationJobsForTests } from "../../src/modules/contracts/developer-simulation.js";
import {
  getCumulativeExperienceToReachLevel,
  getExperienceToNextLevel
} from "../../src/modules/player/progression-service.js";
import { authHeaders, loginAsGuest, registerUser } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

function resolvePlayerCurrentHpFromStoredRun(run: {
  playerSnapshot: unknown;
  events: unknown;
}): number {
  const player = combatActorSnapshotSchema.parse(run.playerSnapshot);
  const events = combatEventSchema.array().parse(run.events);
  let currentHp = player.currentHp;

  for (const event of events) {
    if (event.type !== "CombatActionResolved") {
      continue;
    }
    for (const strike of event.strikes) {
      if (strike.targetId === player.id) {
        currentHp = strike.targetHpAfter;
      }
    }
  }

  return Math.max(0, Math.min(player.maxHp, currentHp));
}

describe("contracts routes", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;

  beforeAll(async () => {
    context = await createApiTestContext();
  });

  beforeEach(async () => {
    await context.resetState();
    resetDeveloperContractSimulationJobsForTests();
  });

  afterAll(async () => {
    await context.close();
  });

  it("starts, gates, claims, and applies a winning contract run exactly once", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: { level: 25 }
    });
    await context.prisma.playerStat.update({
      where: { playerId: guest.body.playerId },
      data: {
        strength: 180,
        intelligence: 180,
        dexterity: 180,
        vitality: 180,
        initiative: 200,
        luck: 120
      }
    });

    const initialPlayerState = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });

    expect(boardResponse.statusCode).toBe(200);
    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const startResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(startResponse.statusCode).toBe(200);

    const startedRun = startResponse.json() as { runId: string; travelDurationSeconds: number };
    expect(startedRun.travelDurationSeconds).toBe(
      resolveContractTravelDurationSeconds(25, availableSlot.rewardsPreview.efficiencyTier)
    );
    const prematureClaim = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
      headers,
      payload: {}
    });
    expect(prematureClaim.statusCode).toBe(400);

    await context.prisma.contractRun.update({
      where: { id: startedRun.runId },
      data: {
        travelEndsAt: new Date(Date.now() - 5_000)
      }
    });

    const claimResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
      headers,
      payload: {}
    });
    expect(claimResponse.statusCode).toBe(200);

    const claimBody = claimResponse.json();
    expect(["player", "enemy"]).toContain(claimBody.winnerSide);
    expect(claimBody.events.length).toBeGreaterThan(0);
    expect(claimBody.playerState.health.current).toBeGreaterThanOrEqual(0);
    expect(claimBody.playerState.health.current).toBeLessThanOrEqual(claimBody.playerState.health.max);
    expect(claimBody.playerState.experienceIntoLevel).toBeGreaterThanOrEqual(0);
    expect(claimBody.playerState.experienceIntoLevel).toBeLessThan(claimBody.playerState.experienceToNextLevel);

    if (claimBody.winnerSide === "player") {
      expect(claimBody.rewards.experience).toBeGreaterThan(0);
      expect(claimBody.rewards.ducats).toBeGreaterThan(0);
    } else {
      expect(claimBody.rewards.experience).toBe(0);
      expect(claimBody.rewards.ducats).toBe(0);
      expect(claimBody.rewards.item).toBeNull();
    }

    const secondClaim = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
      headers,
      payload: {}
    });
    expect(secondClaim.statusCode).toBe(409);

    const finalPlayerStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(finalPlayerStateResponse.statusCode).toBe(200);

    const initialBody = initialPlayerState.json();
    const finalBody = finalPlayerStateResponse.json();
    expect(finalBody.currency.ducats).toBe(initialBody.currency.ducats + claimBody.rewards.ducats);
    expect(finalBody.experience).toBe(initialBody.experience + claimBody.rewards.experience);
    expect(finalBody.health.current).toBe(claimBody.playerState.health.current);
    expect(finalBody.health.max).toBe(claimBody.playerState.health.max);
    expect(finalBody.stamina.current).toBeLessThan(initialBody.stamina.current);

    const refreshedBoard = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    const refreshedSlot = refreshedBoard.json().slots.find((slot: { slotId: number }) => slot.slotId === availableSlot.slotId);
    expect(refreshedSlot.state).toBe("replenishing");
    expect(refreshedSlot.startedRunId).toBeNull();
  });

  it("allows only one active run when start requests race for the same player", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);

    const [firstAvailableSlot, secondAvailableSlot] = boardResponse
      .json()
      .slots.filter((slot: { state: string }) => slot.state === "available");
    expect(firstAvailableSlot).toBeTruthy();
    expect(secondAvailableSlot).toBeTruthy();

    const [firstStart, secondStart] = await Promise.all([
      context.app.inject({
        method: "POST",
        url: `/v1/contracts/slots/${firstAvailableSlot.slotId}/start`,
        headers,
        payload: {}
      }),
      context.app.inject({
        method: "POST",
        url: `/v1/contracts/slots/${secondAvailableSlot.slotId}/start`,
        headers,
        payload: {}
      })
    ]);

    const statusCodes = [firstStart.statusCode, secondStart.statusCode].sort((left, right) => left - right);
    expect(statusCodes).toEqual([200, 409]);

    const activeRuns = await context.prisma.contractRun.findMany({
      where: {
        playerId: guest.body.playerId,
        state: { in: ["traveling", "ready_to_claim"] }
      }
    });
    expect(activeRuns).toHaveLength(1);
  });

  it("marks fast-travel runs ready after two seconds even when server travel is longer", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        fastTravelEnabled: true
      }
    });

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);

    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const startResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(startResponse.statusCode).toBe(200);
    const startedRun = startResponse.json() as { runId: string };

    const prematureRun = await context.app.inject({
      method: "GET",
      url: `/v1/contracts/runs/${startedRun.runId}`,
      headers
    });
    expect(prematureRun.statusCode).toBe(200);
    expect(prematureRun.json().state).toBe("traveling");

    await context.prisma.contractRun.update({
      where: { id: startedRun.runId },
      data: {
        createdAt: new Date(Date.now() - 5_000)
      }
    });

    const readyRunResponse = await context.app.inject({
      method: "GET",
      url: `/v1/contracts/runs/${startedRun.runId}`,
      headers
    });
    expect(readyRunResponse.statusCode).toBe(200);
    expect(readyRunResponse.json().state).toBe("ready_to_claim");

    const claimResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
      headers,
      payload: {}
    });
    expect(claimResponse.statusCode).toBe(200);
  });

  it("grants rewards only once when claim requests race", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: { level: 25 }
    });
    await context.prisma.playerStat.update({
      where: { playerId: guest.body.playerId },
      data: {
        strength: 180,
        intelligence: 180,
        dexterity: 180,
        vitality: 180,
        initiative: 200,
        luck: 120
      }
    });

    const initialPlayerStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(initialPlayerStateResponse.statusCode).toBe(200);
    const initialPlayerState = initialPlayerStateResponse.json();

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const startResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(startResponse.statusCode).toBe(200);
    const startedRun = startResponse.json() as { runId: string };

    await context.prisma.contractRun.update({
      where: { id: startedRun.runId },
      data: {
        travelEndsAt: new Date(Date.now() - 5_000)
      }
    });

    const [firstClaim, secondClaim] = await Promise.all([
      context.app.inject({
        method: "POST",
        url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
        headers,
        payload: {}
      }),
      context.app.inject({
        method: "POST",
        url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
        headers,
        payload: {}
      })
    ]);

    const responses = [firstClaim, secondClaim];
    const winningClaim = responses.find((response) => response.statusCode === 200);
    const rejectedClaim = responses.find((response) => response.statusCode === 409);

    expect(winningClaim).toBeTruthy();
    expect(rejectedClaim).toBeTruthy();

    const claimBody = winningClaim!.json();
    const finalPlayerStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(finalPlayerStateResponse.statusCode).toBe(200);

    const finalPlayerState = finalPlayerStateResponse.json();
    expect(finalPlayerState.currency.ducats).toBe(initialPlayerState.currency.ducats + claimBody.rewards.ducats);
    expect(finalPlayerState.experience).toBe(initialPlayerState.experience + claimBody.rewards.experience);

    const runRecord = await context.prisma.contractRun.findUniqueOrThrow({
      where: { id: startedRun.runId },
      select: { state: true, rewardsGranted: true, winnerSide: true }
    });
    expect(runRecord.state).toBe("claimed");
    expect(runRecord.rewardsGranted).toBe(runRecord.winnerSide === "player");
  });

  it("keeps the player at full health during invincible contract runs and still grants win rewards", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        level: 25,
        hitpointsCurrent: 1,
        hitpointsUpdatedAt: new Date(),
        invincibilityEnabled: true
      }
    });
    await context.prisma.playerStat.update({
      where: { playerId: guest.body.playerId },
      data: {
        strength: 180,
        intelligence: 180,
        dexterity: 180,
        vitality: 180,
        initiative: 200,
        luck: 120
      }
    });

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);
    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const startResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(startResponse.statusCode).toBe(200);
    const startedRun = startResponse.json() as { runId: string };

    await context.prisma.contractRun.update({
      where: { id: startedRun.runId },
      data: {
        travelEndsAt: new Date(Date.now() - 5_000)
      }
    });

    const claimResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
      headers,
      payload: {}
    });
    expect(claimResponse.statusCode).toBe(200);
    expect(claimResponse.json().winnerSide).toBe("player");
    expect(claimResponse.json().rewards.experience).toBeGreaterThan(0);
    expect(claimResponse.json().rewards.ducats).toBeGreaterThan(0);
    expect(claimResponse.json().playerState.health.current).toBe(claimResponse.json().playerState.health.max);
    expect(claimResponse.json().playerState.health.nextPointAt).toBeNull();
  });

  it("adds passive health regeneration after applying the stored contract result", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: { level: 25 }
    });
    await context.prisma.playerStat.update({
      where: { playerId: guest.body.playerId },
      data: {
        strength: 180,
        intelligence: 180,
        dexterity: 180,
        vitality: 180,
        initiative: 200,
        luck: 120
      }
    });

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);
    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const startResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(startResponse.statusCode).toBe(200);
    const startedRun = startResponse.json() as { runId: string };

    const regenStartedAt = new Date(Date.now() - (5 * 60 * 1000));
    await context.prisma.contractRun.update({
      where: { id: startedRun.runId },
      data: {
        playerHitpointsUpdatedAt: regenStartedAt,
        travelEndsAt: new Date(Date.now() - 5_000)
      }
    });
    await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });

    const runRecord = await context.prisma.contractRun.findUniqueOrThrow({
      where: { id: startedRun.runId },
      select: {
        playerSnapshot: true,
        events: true,
        playerHitpointsUpdatedAt: true
      }
    });
    const postFightHp = resolvePlayerCurrentHpFromStoredRun(runRecord);
    const preRewardMaxHp = combatActorSnapshotSchema.parse(runRecord.playerSnapshot).maxHp;

    const claimResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
      headers,
      payload: {}
    });
    expect(claimResponse.statusCode).toBe(200);

    const claimBody = claimResponse.json();
    const expectedRegen = Math.floor(preRewardMaxHp * 0.05);
    expect(claimBody.playerState.health.current).toBe(
      Math.min(preRewardMaxHp, postFightHp + expectedRegen)
    );
  });

  it("uses pre-reward max health when a claim levels the player up", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);
    const playerLevel = 25;

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        level: playerLevel,
        experience: getCumulativeExperienceToReachLevel(playerLevel) + getExperienceToNextLevel(playerLevel) - 1
      }
    });
    await context.prisma.playerStat.update({
      where: { playerId: guest.body.playerId },
      data: {
        strength: 180,
        intelligence: 180,
        dexterity: 180,
        vitality: 180,
        initiative: 200,
        luck: 120
      }
    });

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);
    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const startResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(startResponse.statusCode).toBe(200);
    const startedRun = startResponse.json() as { runId: string };

    const regenStartedAt = new Date(Date.now() - (5 * 60 * 1000));
    const runRecord = await context.prisma.contractRun.findUniqueOrThrow({
      where: { id: startedRun.runId },
      select: {
        playerSnapshot: true,
        events: true,
        rewards: true
      }
    });
    const preRewardMaxHp = combatActorSnapshotSchema.parse(runRecord.playerSnapshot).maxHp;
    const postFightHp = resolvePlayerCurrentHpFromStoredRun(runRecord);
    const storedRewards = runRecord.rewards as Record<string, unknown>;

    await context.prisma.contractRun.update({
      where: { id: startedRun.runId },
      data: {
        winnerSide: "player",
        travelEndsAt: new Date(Date.now() - 5_000),
        playerHitpointsUpdatedAt: regenStartedAt,
        rewards: {
          ...storedRewards,
          experience: 1
        }
      }
    });

    const claimResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/runs/${startedRun.runId}/claim-result`,
      headers,
      payload: {}
    });
    expect(claimResponse.statusCode).toBe(200);

    const claimBody = claimResponse.json();
    const expectedCurrentHp = Math.min(preRewardMaxHp, postFightHp + Math.floor(preRewardMaxHp * 0.05));
    expect(claimBody.playerState.level).toBe(playerLevel + 1);
    expect(claimBody.playerState.health.max).toBeGreaterThan(preRewardMaxHp);
    expect(claimBody.playerState.health.current).toBe(expectedCurrentHp);
  });

  it("blocks contract starts while the player is at zero health", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        hitpointsCurrent: 0,
        hitpointsUpdatedAt: new Date()
      }
    });

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);

    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const startResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/start`,
      headers,
      payload: {}
    });

    expect(startResponse.statusCode).toBe(400);
    expect(startResponse.json().error).toContain("rest");
  });

  it("abandons an available slot and schedules replenishment", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);

    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const abandonResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/abandon`,
      headers,
      payload: {}
    });
    expect(abandonResponse.statusCode).toBe(200);

    const abandonedSlot = abandonResponse.json().slots.find((slot: { slotId: number }) => slot.slotId === availableSlot.slotId);
    expect(abandonedSlot.state).toBe("replenishing");
    expect(abandonedSlot.replenishAt).toBeTruthy();
    expect(abandonedSlot.startedRunId).toBeNull();
    const replenishMs = Date.parse(abandonedSlot.replenishAt) - Date.now();
    const replenishWindow = getContractReplenishPacingRow(1);
    expect(replenishMs).toBeGreaterThanOrEqual(replenishWindow.replenishMinSeconds * 1000 - 5_000);
    expect(replenishMs).toBeLessThanOrEqual(replenishWindow.replenishMaxSeconds * 1000 + 5_000);
  });

  it("shortens contract replenish cooldowns to three seconds when the cheat is enabled", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const cheatSettingsResponse = await context.app.inject({
      method: "PATCH",
      url: "/v1/player/cheats/settings",
      headers,
      payload: {
        fastContractReplenishEnabled: true
      }
    });
    expect(cheatSettingsResponse.statusCode).toBe(200);

    const boardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(boardResponse.statusCode).toBe(200);

    const availableSlot = boardResponse.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableSlot).toBeTruthy();

    const abandonResponse = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableSlot.slotId}/abandon`,
      headers,
      payload: {}
    });
    expect(abandonResponse.statusCode).toBe(200);

    const abandonedSlot = abandonResponse.json().slots.find((slot: { slotId: number }) => slot.slotId === availableSlot.slotId);
    expect(abandonedSlot.state).toBe("replenishing");
    expect(abandonedSlot.replenishAt).toBeTruthy();

    const replenishMs = Date.parse(abandonedSlot.replenishAt) - Date.now();
    expect(replenishMs).toBeGreaterThanOrEqual(0);
    expect(replenishMs).toBeLessThanOrEqual(8_000);
  });

  it("exposes developer contracts simulation to all authenticated accounts", async () => {
    const guest = await loginAsGuest(context.app);
    const guestHeaders = authHeaders(guest.body.accessToken);

    const guestOverview = await context.app.inject({
      method: "GET",
      url: "/v1/account/overview",
      headers: guestHeaders
    });
    expect(guestOverview.statusCode).toBe(200);
    expect(guestOverview.json().developerToolsEnabled).toBe(true);

    const startGuestJob = await context.app.inject({
      method: "POST",
      url: "/v1/contracts/simulations",
      headers: guestHeaders,
      payload: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 2
      }
    });
    expect(startGuestJob.statusCode).toBe(200);

    const guestJobId = startGuestJob.json().jobId as string;
    let guestJob = startGuestJob.json();
    for (let attempt = 0; attempt < 50 && (guestJob.status === "queued" || guestJob.status === "running"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const poll = await context.app.inject({
        method: "GET",
        url: `/v1/contracts/simulations/${guestJobId}`,
        headers: guestHeaders
      });
      expect(poll.statusCode).toBe(200);
      guestJob = poll.json();
    }

    expect(guestJob.status).toBe("completed");
    expect(guestJob.result.playerClass).toBe("juggernaut");

    const registered = await registerUser(context.app);
    const registeredHeaders = authHeaders(registered.body.accessToken);

    const userOverview = await context.app.inject({
      method: "GET",
      url: "/v1/account/overview",
      headers: registeredHeaders
    });
    expect(userOverview.statusCode).toBe(200);
    expect(userOverview.json().developerToolsEnabled).toBe(true);

    const registeredJob = await context.app.inject({
      method: "POST",
      url: "/v1/contracts/simulations",
      headers: registeredHeaders,
      payload: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 2
      }
    });
    expect(registeredJob.statusCode).toBe(200);
  });

  it("returns developer contracts static pacing curves for developer-enabled accounts", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const response = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/simulation-curves",
      headers
    });

    expect(response.statusCode).toBe(200);
    const parsed = developerContractsStaticCurvesResponseSchema.parse(response.json());
    expect(parsed.levels).toHaveLength(100);
    expect(parsed.levels[0]?.level).toBe(1);
    expect(parsed.levels[0]?.averageTravelSeconds).toBeGreaterThan(0);
    expect(parsed.levels[0]?.averageStaminaWaitSecondsForContract).toBeGreaterThan(0);
    expect(parsed.levels[0]?.averageContractAvailabilityWaitSeconds).toBeGreaterThan(0);
    expect(parsed.levels[0]?.averageExperiencePerContract.on_level).toBeGreaterThan(0);
  });
});
