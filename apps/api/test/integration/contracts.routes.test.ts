import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authHeaders, loginAsGuest } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("contracts routes", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;

  beforeAll(async () => {
    context = await createApiTestContext();
  });

  beforeEach(async () => {
    await context.resetState();
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

    const startedRun = startResponse.json() as { runId: string };
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
  });
});
