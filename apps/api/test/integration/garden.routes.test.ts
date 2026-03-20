import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_GARDEN_SLOT_COUNT, MIN_GARDEN_UNLOCKED_SLOT_COUNT } from "@ebonkeep/shared/garden";

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
    expect(body.unlockedSlotCount).toBe(MIN_GARDEN_UNLOCKED_SLOT_COUNT);
    expect(body.plots).toHaveLength(MAX_GARDEN_SLOT_COUNT);
    expect(body.plots.filter((plot: { isUnlocked: boolean }) => plot.isUnlocked)).toHaveLength(MIN_GARDEN_UNLOCKED_SLOT_COUNT);
    expect(body.plots.every((plot: { phase: string }) => plot.phase === "empty")).toBe(true);
    expect(body.inventory).toHaveLength(5);
    expect(body.inventory.every((entry: { kind: string; quantity: number }) => entry.kind === "seed" && entry.quantity === 999)).toBe(true);
  });

  it("handles concurrent first-load bootstrap without duplicate plot or seed rows", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const [firstResponse, secondResponse] = await Promise.all([
      context.app.inject({
        method: "GET",
        url: "/v1/garden/state",
        headers
      }),
      context.app.inject({
        method: "GET",
        url: "/v1/garden/state",
        headers
      })
    ]);

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);

    const plotCount = await context.prisma.gardenPlot.count({
      where: {
        playerId: guest.body.playerId
      }
    });
    const seedCount = await context.prisma.gardenInventoryEntry.count({
      where: {
        playerId: guest.body.playerId,
        kind: "seed"
      }
    });

    expect(plotCount).toBe(MAX_GARDEN_SLOT_COUNT);
    expect(seedCount).toBe(5);
  });

  it("plants seeds, decrements inventory, and upgrades legacy infinite starter stacks once", async () => {
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
    ).toBe(998);

    await context.prisma.gardenInventoryEntry.updateMany({
      where: {
        playerId: guest.body.playerId,
        plantId: "fenroot",
        kind: "seed"
      },
      data: {
        quantity: 5
      }
    });

    const migratedSeedState = await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    expect(migratedSeedState.statusCode).toBe(200);
    expect(
      migratedSeedState.json().inventory.find((entry: { plantId: string; kind: string }) => entry.plantId === "fenroot" && entry.kind === "seed").quantity
    ).toBe(999);

    const plantFenrootResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/2/plant",
      headers,
      payload: {
        plantId: "fenroot"
      }
    });

    expect(plantFenrootResponse.statusCode).toBe(200);
    expect(
      plantFenrootResponse.json().garden.inventory.find((entry: { plantId: string; kind: string }) => entry.plantId === "fenroot" && entry.kind === "seed").quantity
    ).toBe(998);
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

    const playerInventoryIngredient = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId: guest.body.playerId,
        itemCode: "ingredient_bloodleaf"
      }
    });
    expect(playerInventoryIngredient).toBeNull();
  });

  it("grants bloom harvest ingredients only once under concurrent harvest requests", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/1/plant",
      headers,
      payload: {
        plantId: "bloodleaf"
      }
    });

    const nowMs = Date.now();
    await context.prisma.gardenPlot.update({
      where: {
        playerId_slotIndex: {
          playerId: guest.body.playerId,
          slotIndex: 1
        }
      },
      data: {
        plantedAt: new Date(nowMs - 5_000),
        growthEndsAt: new Date(nowMs - 4_000),
        bloomStartsAt: new Date(nowMs - 1_000),
        bloomEndsAt: new Date(nowMs + 4_000),
        wiltAt: new Date(nowMs + 9_000)
      }
    });

    const [firstResponse, secondResponse] = await Promise.all([
      context.app.inject({
        method: "POST",
        url: "/v1/garden/slots/1/harvest",
        headers,
        payload: {}
      }),
      context.app.inject({
        method: "POST",
        url: "/v1/garden/slots/1/harvest",
        headers,
        payload: {}
      })
    ]);

    const statusCodes = [firstResponse.statusCode, secondResponse.statusCode];
    expect(statusCodes.filter((statusCode) => statusCode === 200)).toHaveLength(1);
    expect(statusCodes.some((statusCode) => statusCode === 400 || statusCode === 409)).toBe(true);

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
      url: `/v1/garden/slots/${MAX_GARDEN_SLOT_COUNT + 1}/plant`,
      headers,
      payload: {
        plantId: "bloodleaf"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects reducing unlocked slots below an occupied plot", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const bootstrapResponse = await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    expect(bootstrapResponse.statusCode).toBe(200);

    const unlockResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/cheats/unlocked-slots",
      headers,
      payload: {
        unlockedSlotCount: 8
      }
    });

    expect(unlockResponse.statusCode).toBe(200);
    expect(unlockResponse.json().garden.unlockedSlotCount).toBe(8);

    const plantResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/8/plant",
      headers,
      payload: {
        plantId: "bloodleaf"
      }
    });

    expect(plantResponse.statusCode).toBe(200);

    const relockResponse = await context.app.inject({
      method: "POST",
      url: "/v1/garden/cheats/unlocked-slots",
      headers,
      payload: {
        unlockedSlotCount: MIN_GARDEN_UNLOCKED_SLOT_COUNT
      }
    });

    expect(relockResponse.statusCode).toBe(409);
    expect(relockResponse.json().code).toBe("PLOTS_OCCUPIED_BEYOND_UNLOCK_COUNT");

    const stateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/garden/state",
      headers
    });

    expect(stateResponse.statusCode).toBe(200);
    expect(stateResponse.json().unlockedSlotCount).toBe(8);
    expect(stateResponse.json().plots[7].isUnlocked).toBe(true);
    expect(stateResponse.json().plots[7].plantId).toBe("bloodleaf");
  });
});
