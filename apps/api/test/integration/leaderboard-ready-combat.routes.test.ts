import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authHeaders, loginAsGuest, seedLeaderboardPlayers } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("leaderboard, readiness, and combat routes", () => {
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

  it("reports health and readiness", async () => {
    const health = await context.app.inject({
      method: "GET",
      url: "/health"
    });
    const ready = await context.app.inject({
      method: "GET",
      url: "/ready"
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({
      status: "ok",
      redis: "ok",
      postgres: "ok"
    });
  });

  it("orders leaderboard results and returns the current player rank", async () => {
    const currentPlayer = await loginAsGuest(context.app, { guestId: "ranked-player" });
    await context.prisma.playerProfile.update({
      where: { id: currentPlayer.body.playerId },
      data: {
        level: 15,
        gearScore: 120,
        updatedAt: new Date("2026-03-09T08:00:00.000Z")
      }
    });

    await seedLeaderboardPlayers(context.prisma, [
      {
        name: "Stronger Ranger",
        class: "ranger",
        level: 20,
        gearScore: 250,
        updatedAt: new Date("2026-03-08T08:00:00.000Z")
      },
      {
        name: "Equal Ranger",
        class: "warrior",
        level: 15,
        gearScore: 120,
        updatedAt: new Date("2026-03-10T08:00:00.000Z")
      }
    ]);

    const leaderboardResponse = await context.app.inject({
      method: "GET",
      url: "/v1/leaderboard?type=power&classFilter=all",
      headers: authHeaders(currentPlayer.body.accessToken)
    });
    expect(leaderboardResponse.statusCode).toBe(200);
    expect(leaderboardResponse.json().entries[0].username).toBe("Stronger Ranger");
    expect(leaderboardResponse.json().currentPlayerRank).toBe(2);

    const filteredResponse = await context.app.inject({
      method: "GET",
      url: "/v1/leaderboard/public?type=power&classFilter=ranger"
    });
    expect(filteredResponse.statusCode).toBe(200);
    expect(filteredResponse.json().entries).toHaveLength(1);
    expect(filteredResponse.json().entries[0].class).toBe("ranger");
  });

  it("creates combat sessions and accepts combat actions", async () => {
    const guest = await loginAsGuest(context.app, { guestId: "combat-player" });

    const sessionResponse = await context.app.inject({
      method: "POST",
      url: "/v1/combat/sessions",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        mode: "pve",
        enemyPackId: "starter-pack"
      }
    });
    expect(sessionResponse.statusCode).toBe(200);

    const actionResponse = await context.app.inject({
      method: "POST",
      url: "/v1/combat/actions",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        sessionId: sessionResponse.json().sessionId,
        actionType: "basic_attack",
        targetId: "enemy_1"
      }
    });
    expect(actionResponse.statusCode).toBe(200);
    expect(actionResponse.json().accepted).toBe(true);
  });
});
