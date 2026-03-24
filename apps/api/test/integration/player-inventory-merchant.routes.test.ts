import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getCumulativeExperienceToReachLevel } from "../../src/modules/player/progression-service.js";

import {
  authHeaders,
  createInventoryItemForPlayer,
  loginAsGuest,
  setPlayerDucats
} from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("player, inventory, and merchant routes", () => {
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

  it("creates player state for a guest login and updates preferences", async () => {
    const guest = await loginAsGuest(context.app);
    expect(guest.response.statusCode).toBe(200);

    const stateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers: authHeaders(guest.body.accessToken)
    });
    expect(stateResponse.statusCode).toBe(200);
    expect(stateResponse.json().currency.ducats).toBe(100_000);
    expect(stateResponse.json().health.current).toBeGreaterThan(0);
    expect(stateResponse.json().health.current).toBe(stateResponse.json().health.max);

    const preferenceResponse = await context.app.inject({
      method: "PATCH",
      url: "/v1/player/preferences",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        preferredLocale: "pt-BR"
      }
    });
    expect(preferenceResponse.statusCode).toBe(200);
    expect(preferenceResponse.json()).toEqual({ preferredLocale: "pt-BR" });
  });

  it("rests to fully restore health and stamina for ducats", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        hitpointsCurrent: 0,
        hitpointsUpdatedAt: new Date(),
        staminaCurrent: 10,
        staminaUpdatedAt: new Date()
      }
    });
    await setPlayerDucats(context.prisma, guest.body.playerId, 1_000);

    const restResponse = await context.app.inject({
      method: "POST",
      url: "/v1/player/rest",
      headers,
      payload: {}
    });

    expect(restResponse.statusCode).toBe(200);
    const body = restResponse.json();
    expect(body.costDucats).toBeGreaterThan(0);
    expect(body.playerState.health.current).toBe(body.playerState.health.max);
    expect(body.playerState.health.nextPointAt).toBeNull();
    expect(body.playerState.stamina.current).toBe(body.playerState.stamina.max);
    expect(body.playerState.currency.ducats).toBe(1_000 - body.costDucats);
  });

  it("applies passive health regeneration in player state responses", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const initialStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(initialStateResponse.statusCode).toBe(200);
    const initialState = initialStateResponse.json();
    const initialMaxHealth = initialState.health.max as number;

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        hitpointsCurrent: 0,
        hitpointsUpdatedAt: new Date(Date.now() - (5 * 60 * 1000))
      }
    });

    const stateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(stateResponse.statusCode).toBe(200);

    const body = stateResponse.json();
    const expectedRegen = Math.floor(initialMaxHealth * 0.05);
    expect(body.health.current).toBe(expectedRegen);
    expect(body.health.max).toBe(initialMaxHealth);
    expect(body.health.nextPointAt).toBeTruthy();
  });

  it("persists cheat settings and applies cheat actions through player routes", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);

    const initialStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(initialStateResponse.statusCode).toBe(200);
    expect(initialStateResponse.json().cheatSettings).toEqual({
      fastTravelEnabled: false,
      fastContractReplenishEnabled: false,
      fastArenaReplenishEnabled: false,
      invincibilityEnabled: false,
      fastTrainTimeEnabled: false,
      unlimitedAcademyDonationsEnabled: false,
      unlimitedForgeConsumablesEnabled: false
    });

    const settingsResponse = await context.app.inject({
      method: "PATCH",
      url: "/v1/player/cheats/settings",
      headers,
      payload: {
        fastTravelEnabled: true,
        fastContractReplenishEnabled: true,
        fastArenaReplenishEnabled: true,
        invincibilityEnabled: true,
        fastTrainTimeEnabled: true,
        unlimitedAcademyDonationsEnabled: true
      }
    });
    expect(settingsResponse.statusCode).toBe(200);
    expect(settingsResponse.json().playerState.cheatSettings).toEqual({
      fastTravelEnabled: true,
      fastContractReplenishEnabled: true,
      fastArenaReplenishEnabled: true,
      invincibilityEnabled: true,
      fastTrainTimeEnabled: true,
      unlimitedAcademyDonationsEnabled: true,
      unlimitedForgeConsumablesEnabled: false
    });

    const persistedStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });
    expect(persistedStateResponse.statusCode).toBe(200);
    expect(persistedStateResponse.json().cheatSettings.fastTravelEnabled).toBe(true);
    expect(persistedStateResponse.json().cheatSettings.fastContractReplenishEnabled).toBe(true);
    expect(persistedStateResponse.json().cheatSettings.fastArenaReplenishEnabled).toBe(true);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        hitpointsCurrent: 1,
        hitpointsUpdatedAt: new Date(),
        staminaCurrent: 5,
        staminaUpdatedAt: new Date()
      }
    });

    const replenishResponse = await context.app.inject({
      method: "POST",
      url: "/v1/player/cheats/replenish",
      headers,
      payload: {}
    });
    expect(replenishResponse.statusCode).toBe(200);
    expect(replenishResponse.json().playerState.health.current).toBe(replenishResponse.json().playerState.health.max);
    expect(replenishResponse.json().playerState.health.nextPointAt).toBeNull();
    expect(replenishResponse.json().playerState.stamina.current).toBe(replenishResponse.json().playerState.stamina.max);

    const levelUpResponse = await context.app.inject({
      method: "POST",
      url: "/v1/player/cheats/level-up",
      headers,
      payload: {
        targetLevel: 7
      }
    });
    expect(levelUpResponse.statusCode).toBe(200);
    expect(levelUpResponse.json().playerState.level).toBe(7);
    expect(levelUpResponse.json().playerState.experience).toBe(getCumulativeExperienceToReachLevel(7));

    const levelDownResponse = await context.app.inject({
      method: "POST",
      url: "/v1/player/cheats/level-up",
      headers,
      payload: {
        targetLevel: 3
      }
    });
    expect(levelDownResponse.statusCode).toBe(200);
    expect(levelDownResponse.json().playerState.level).toBe(3);
    expect(levelDownResponse.json().playerState.experience).toBe(getCumulativeExperienceToReachLevel(3));

    const rejectLevelResponse = await context.app.inject({
      method: "POST",
      url: "/v1/player/cheats/level-up",
      headers,
      payload: {
        targetLevel: 3
      }
    });
    expect(rejectLevelResponse.statusCode).toBe(400);

    const inventoryCountBefore = levelDownResponse.json().playerState.inventory.length;
    const generateEquipmentResponse = await context.app.inject({
      method: "POST",
      url: "/v1/player/cheats/generate-equipment",
      headers,
      payload: {
        rarity: "epic"
      }
    });
    expect(generateEquipmentResponse.statusCode).toBe(200);
    expect(generateEquipmentResponse.json().generatedItems).toHaveLength(11);
    expect(generateEquipmentResponse.json().generatedItems.every((item: { rarity: string }) => item.rarity === "epic")).toBe(true);
    expect(generateEquipmentResponse.json().playerState.inventory).toHaveLength(inventoryCountBefore + 11);

    const currencyBefore = generateEquipmentResponse.json().playerState.currency;
    const grantCurrencyResponse = await context.app.inject({
      method: "POST",
      url: "/v1/player/cheats/grant-currency",
      headers,
      payload: {}
    });
    expect(grantCurrencyResponse.statusCode).toBe(200);
    expect(grantCurrencyResponse.json().ducatsGranted).toBe(1_000_000);
    expect(grantCurrencyResponse.json().imperialsGranted).toBe(10_000);
    expect(grantCurrencyResponse.json().playerState.currency.ducats).toBe(currencyBefore.ducats + 1_000_000);
    expect(grantCurrencyResponse.json().playerState.currency.imperials).toBe(currencyBefore.imperials + 10_000);
  });

  it("prevents concurrent rest requests from double-charging the player", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);
    const initialStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });

    expect(initialStateResponse.statusCode).toBe(200);
    const initialState = initialStateResponse.json();
    const exactSingleRestCost =
      Math.ceil(initialState.health.max / 10) + Math.max(0, initialState.stamina.max - 10);

    await context.prisma.playerProfile.update({
      where: { id: guest.body.playerId },
      data: {
        hitpointsCurrent: 0,
        hitpointsUpdatedAt: new Date(),
        staminaCurrent: 10,
        staminaUpdatedAt: new Date()
      }
    });
    await setPlayerDucats(context.prisma, guest.body.playerId, exactSingleRestCost);

    const [firstResponse, secondResponse] = await Promise.all([
      context.app.inject({
        method: "POST",
        url: "/v1/player/rest",
        headers,
        payload: {}
      }),
      context.app.inject({
        method: "POST",
        url: "/v1/player/rest",
        headers,
        payload: {}
      })
    ]);

    const statusCodes = [firstResponse.statusCode, secondResponse.statusCode].sort((left, right) => left - right);
    expect(statusCodes[1]).toBe(200);

    const stateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers
    });

    expect(stateResponse.statusCode).toBe(200);
    expect(stateResponse.json().health.current).toBe(stateResponse.json().health.max);
    expect(stateResponse.json().stamina.current).toBe(stateResponse.json().stamina.max);
    expect(stateResponse.json().currency.ducats).toBe(0);
  });

  it("equips, swaps back, and blocks invalid inventory moves", async () => {
    const guest = await loginAsGuest(context.app, { playerClass: "juggernaut" });
    const stateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/player/state",
      headers: authHeaders(guest.body.accessToken)
    });

    const inventory = stateResponse.json().inventory as Array<{
      id: string;
      allowedSlotIds: string[];
    }>;
    const starterItem = inventory.find((item) => item.allowedSlotIds.length > 0);
    expect(starterItem).toBeTruthy();

    const equipResponse = await context.app.inject({
      method: "POST",
      url: "/v1/inventory/move-item",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: starterItem!.id,
        fromSlot: "inventory",
        toSlot: starterItem!.allowedSlotIds[0]
      }
    });
    expect(equipResponse.statusCode).toBe(200);
    expect(equipResponse.json().playerState.equipment[starterItem!.allowedSlotIds[0]]?.id).toBe(starterItem!.id);

    const unequipResponse = await context.app.inject({
      method: "POST",
      url: "/v1/inventory/move-item",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: starterItem!.id,
        fromSlot: starterItem!.allowedSlotIds[0],
        toSlot: "inventory"
      }
    });
    expect(unequipResponse.statusCode).toBe(200);

    const arcaneItem = await createInventoryItemForPlayer(context.prisma, guest.body.playerId, {
      itemName: "Forbidden Wand",
      archetype: {
        majorCategory: "weapon",
        weaponArchetype: "arcane",
        weaponFamily: "wand"
      },
      allowedSlotIds: ["weapon"]
    });

    const wrongClassResponse = await context.app.inject({
      method: "POST",
      url: "/v1/inventory/move-item",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: arcaneItem.id,
        fromSlot: "inventory",
        toSlot: "weapon"
      }
    });
    expect(wrongClassResponse.statusCode).toBe(400);

    const highLevelItem = await createInventoryItemForPlayer(context.prisma, guest.body.playerId, {
      itemName: "Late Game Blade",
      levelRequirement: 99,
      allowedSlotIds: ["weapon"]
    });

    const levelResponse = await context.app.inject({
      method: "POST",
      url: "/v1/inventory/move-item",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: highLevelItem.id,
        fromSlot: "inventory",
        toSlot: "weapon"
      }
    });
    expect(levelResponse.statusCode).toBe(400);

    const firstVestige = await createInventoryItemForPlayer(context.prisma, guest.body.playerId, {
      itemName: "Vestige A",
      category: "vestige",
      allowedSlotIds: ["vestige1", "vestige2", "vestige3"],
      archetype: {
        majorCategory: "vestige",
        vestigeId: "ashen-sovereign"
      },
      statBonuses: {}
    });
    const secondVestige = await createInventoryItemForPlayer(context.prisma, guest.body.playerId, {
      itemName: "Vestige B",
      category: "vestige",
      allowedSlotIds: ["vestige1", "vestige2", "vestige3"],
      archetype: {
        majorCategory: "vestige",
        vestigeId: "ashen-sovereign"
      },
      statBonuses: {}
    });

    await context.app.inject({
      method: "POST",
      url: "/v1/inventory/move-item",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: firstVestige.id,
        fromSlot: "inventory",
        toSlot: "vestige1"
      }
    });

    const duplicateVestigeResponse = await context.app.inject({
      method: "POST",
      url: "/v1/inventory/move-item",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: secondVestige.id,
        fromSlot: "inventory",
        toSlot: "vestige2"
      }
    });
    expect(duplicateVestigeResponse.statusCode).toBe(400);
  });

  it("buys, sells, and restocks merchant offers", async () => {
    const guest = await loginAsGuest(context.app);

    const merchantStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/merchant/state",
      headers: authHeaders(guest.body.accessToken)
    });
    expect(merchantStateResponse.statusCode).toBe(200);

    const merchantState = merchantStateResponse.json();
    const initialOffer = merchantState.offers[0];
    expect(initialOffer).toBeTruthy();

    const buyResponse = await context.app.inject({
      method: "POST",
      url: "/v1/merchant/buy",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        offerId: initialOffer.offerId
      }
    });
    expect(buyResponse.statusCode).toBe(200);
    expect(buyResponse.json().playerState.currency.ducats).toBeLessThan(merchantState.currency.ducats);

    const purchasedItem = buyResponse
      .json()
      .playerState.inventory.find((item: { itemName: string }) => item.itemName === initialOffer.item.itemName);
    expect(purchasedItem).toBeTruthy();

    const badSellResponse = await context.app.inject({
      method: "POST",
      url: "/v1/merchant/sell",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: purchasedItem!.id,
        fromSlot: "weapon"
      }
    });
    expect(badSellResponse.statusCode).toBe(400);

    const sellResponse = await context.app.inject({
      method: "POST",
      url: "/v1/merchant/sell",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        itemId: purchasedItem!.id,
        fromSlot: "inventory"
      }
    });
    expect(sellResponse.statusCode).toBe(200);
    expect(
      sellResponse
        .json()
        .merchantState.offers.some((offer: { item: { itemCode: string } }) => offer.item.itemCode === purchasedItem!.itemCode)
    ).toBe(true);

    const restockResponse = await context.app.inject({
      method: "POST",
      url: "/v1/merchant/restock",
      headers: authHeaders(guest.body.accessToken),
      payload: {}
    });
    expect(restockResponse.statusCode).toBe(200);
    expect(restockResponse.json().merchantState.offers).toHaveLength(8);
  });

  it("rejects buying an offer without enough ducats", async () => {
    const guest = await loginAsGuest(context.app);
    await setPlayerDucats(context.prisma, guest.body.playerId, 0);

    const merchantStateResponse = await context.app.inject({
      method: "GET",
      url: "/v1/merchant/state",
      headers: authHeaders(guest.body.accessToken)
    });
    const initialOffer = merchantStateResponse.json().offers[0];

    const buyResponse = await context.app.inject({
      method: "POST",
      url: "/v1/merchant/buy",
      headers: authHeaders(guest.body.accessToken),
      payload: {
        offerId: initialOffer.offerId
      }
    });
    expect(buyResponse.statusCode).toBe(400);
  });
});
