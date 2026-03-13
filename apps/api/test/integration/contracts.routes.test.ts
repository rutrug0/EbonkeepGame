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
    expect(claimBody.winnerSide).toBe("player");
    expect(claimBody.rewards.experience).toBeGreaterThan(0);
    expect(claimBody.rewards.ducats).toBeGreaterThan(0);
    expect(claimBody.events.length).toBeGreaterThan(0);

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
    expect(finalBody.currency.ducats).toBeGreaterThan(initialBody.currency.ducats);
    expect(finalBody.experience).toBeGreaterThanOrEqual(initialBody.experience + claimBody.rewards.experience);
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
