import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authHeaders, loginAsGuest } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("garden routes", () => {
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

  it("bootstraps fixed plots and starter seed stacks on first load", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const response = await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.plots).toHaveLength(5);
    expect(body.plots.every((plot: { phase: string }) => plot.phase === "empty")).toBe(true);
    expect(body.inventory).toHaveLength(5);
    expect(body.inventory.every((entry: { kind: string; quantity: number }) => entry.kind === "seed" && entry.quantity === 5)).toBe(true);
  });

  it("plants seeds, tracks phases, and keeps starter seeds available", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const initialState = await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });
    expect(initialState.statusCode).toBe(200);

    const plantResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/1/plant",
      headers,
      payload: {
        plantId: "bloodleaf"
      }
    });

    expect(plantResponse.statusCode).toBe(200);
    expect(plantResponse.json().garden.plots[0].phase).toBe("growing");
    expect(
      plantResponse.json().garden.inventory.find((entry: { plantId: string; kind: string }) => entry.plantId === "bloodleaf" && entry.kind === "seed").quantity
    ).toBe(5);

    await context.prisma.gardenInventoryEntry.updateMany({
      where: {
        playerId: guest.body.playerId,
        plantId: "fenroot",
        kind: "seed"
      },
      data: {
        quantity: 0
      }
    });

    const replenishedSeedState = await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    expect(replenishedSeedState.statusCode).toBe(200);
    expect(
      replenishedSeedState.json().inventory.find((entry: { plantId: string; kind: string }) => entry.plantId === "fenroot" && entry.kind === "seed").quantity
    ).toBe(5);

    const plantFenrootResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/2/plant",
      headers,
      payload: {
        plantId: "fenroot"
      }
    });

    expect(plantFenrootResponse.statusCode).toBe(200);
  });

  it("harvests bloom crops for double yield and keeps ingredients outside player inventory", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    const plantResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/1/plant",
      headers,
      payload: {
        plantId: "bloodleaf"
      }
    });

    const plantedAt = new Date(plantResponse.json().garden.plots[0].plantedAt);
    await context.prisma.gardenPlot.update({
      where: {
        playerId_slotIndex: {
          playerId: guest.body.playerId,
          slotIndex: 1
        }
      },
      data: {
        plantedAt,
        growthEndsAt: new Date(plantedAt.getTime() - 1_000),
        bloomStartsAt: new Date(plantedAt.getTime() - 500),
        bloomEndsAt: new Date(plantedAt.getTime() + 60_000),
        wiltAt: new Date(plantedAt.getTime() + 120_000)
      }
    });

    const harvestResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/1/harvest",
      headers,
      payload: {}
    });

    expect(harvestResponse.statusCode).toBe(200);
    expect(harvestResponse.json().harvested.quantity).toBe(4);
    expect(harvestResponse.json().garden.plots[0].phase).toBe("empty");

    const ingredientEntry = await context.prisma.gardenInventoryEntry.findUnique({
      where: {
        playerId_plantId_kind: {
          playerId: guest.body.playerId,
          plantId: "bloodleaf",
          kind: "ingredient"
        }
      }
    });
    expect(ingredientEntry?.quantity).toBe(4);

    const playerState = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(playerState.statusCode).toBe(200);
    expect(playerState.json().inventory.some((item: { itemCode: string }) => item.itemCode === "ingredient_bloodleaf")).toBe(false);
  });

  it("rejects harvesting wilted crops and allows clearing them", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/3/plant",
      headers,
      payload: {
        plantId: "duskmint"
      }
    });

    await context.prisma.gardenPlot.update({
      where: {
        playerId_slotIndex: {
          playerId: guest.body.playerId,
          slotIndex: 3
        }
      },
      data: {
        growthEndsAt: new Date(Date.now() - 120_000),
        bloomStartsAt: new Date(Date.now() - 90_000),
        bloomEndsAt: new Date(Date.now() - 30_000),
        wiltAt: new Date(Date.now() - 1_000)
      }
    });

    const wiltedHarvest = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/3/harvest",
      headers,
      payload: {}
    });
    expect(wiltedHarvest.statusCode).toBe(409);

    const clearResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/3/clear",
      headers,
      payload: {}
    });
    expect(clearResponse.statusCode).toBe(200);
    expect(clearResponse.json().clearedSlotIndex).toBe(3);
    expect(clearResponse.json().garden.plots[2].phase).toBe("empty");
  });

  it("rejects invalid slot bounds", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const response = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/6/plant",
      headers,
      payload: {
        plantId: "bloodleaf"
      }
    });

    expect(response.statusCode).toBe(400);
  });
});
