import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authHeaders, loginAsGuest } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("arena routes", () => {
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

  it("opens a duel window only after find-opponents and clears offers after a fight", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const stateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/arena/state",
      headers
    });

    expect(stateResponse.statusCode).toBe(200);
    expect(stateResponse.json()).toMatchObject({
      canFindOpponents: true
    });
    expect(stateResponse.json().offers).toHaveLength(0);

    const findResponse = await context.app.inject({
      method: "POST",
      url: "/v1/arena/find-opponents",
      headers,
      payload: {}
    });

    expect(findResponse.statusCode).toBe(200);
    expect(findResponse.json().offers).toHaveLength(3);
    expect(findResponse.json().canFindOpponents).toBe(false);
    expect(findResponse.json().profile.cooldownEndsAt).toBeTruthy();

    const secondFindResponse = await context.app.inject({
      method: "POST",
      url: "/v1/arena/find-opponents",
      headers,
      payload: {}
    });

    expect(secondFindResponse.statusCode).toBe(409);

    const selectedOffer = findResponse.json().offers[0];
    const fightResponse = await context.app.inject({
      method: "POST",
      url: `/v1/arena/offers/${selectedOffer.offerId}/fight`,
      headers,
      payload: {}
    });

    expect(fightResponse.statusCode).toBe(200);
    expect(fightResponse.json().events.length).toBeGreaterThan(0);
    expect(fightResponse.json().recentMatches).toHaveLength(1);
    expect(fightResponse.json().profile.rating).toBeGreaterThanOrEqual(100);
    expect(fightResponse.json().ladder.entries.length).toBeGreaterThan(0);

    const refreshedState = await context.app.inject({
      method: "GET",
      url: "/v1/arena/state",
      headers
    });

    expect(refreshedState.statusCode).toBe(200);
    expect(refreshedState.json().offers).toHaveLength(0);
    expect(refreshedState.json().canFindOpponents).toBe(false);
  });

  it("rejects foreign and expired offers", async () => {
    const firstGuest = await loginAsGuest(context.app);
    const secondGuest = await loginAsGuest(context.app);
    const firstHeaders = authHeaders(firstGuest.body.accessToken);
    const secondHeaders = authHeaders(secondGuest.body.accessToken);

    const findResponse = await context.app.inject({
      method: "POST",
      url: "/v1/arena/find-opponents",
      headers: firstHeaders,
      payload: {}
    });

    expect(findResponse.statusCode).toBe(200);
    const selectedOffer = findResponse.json().offers[0];

    const foreignFightResponse = await context.app.inject({
      method: "POST",
      url: `/v1/arena/offers/${selectedOffer.offerId}/fight`,
      headers: secondHeaders,
      payload: {}
    });

    expect(foreignFightResponse.statusCode).toBe(404);

    await context.prisma.arenaOffer.update({
      where: { id: selectedOffer.offerId },
      data: {
        cooldownEndsAt: new Date(Date.now() - 5_000)
      }
    });

    const expiredFightResponse = await context.app.inject({
      method: "POST",
      url: `/v1/arena/offers/${selectedOffer.offerId}/fight`,
      headers: firstHeaders,
      payload: {}
    });

    expect(expiredFightResponse.statusCode).toBe(404);
  });

  it("reduces arena cooldown to 2 seconds when fast arena replenish cheat is enabled", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const cheatSettingsResponse = await context.app.inject({
      method: "PATCH",
      url: "/v1/player/cheats/settings",
      headers,
      payload: {
        fastArenaReplenishEnabled: true
      }
    });

    expect(cheatSettingsResponse.statusCode).toBe(200);
    expect(cheatSettingsResponse.json().playerState.cheatSettings.fastArenaReplenishEnabled).toBe(true);

    const beforeFindAt = Date.now();
    const findResponse = await context.app.inject({
      method: "POST",
      url: "/v1/arena/find-opponents",
      headers,
      payload: {}
    });

    expect(findResponse.statusCode).toBe(200);
    const cooldownEndsAt = Date.parse(findResponse.json().profile.cooldownEndsAt);
    expect(cooldownEndsAt - beforeFindAt).toBeLessThanOrEqual(2_500);
  });
});
