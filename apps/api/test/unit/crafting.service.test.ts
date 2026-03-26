import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loginAsGuest, setPlayerDucats } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";
import {
  claimCraftingJob,
  grantCraftingStackableItem,
  startCraftingJob
} from "../../src/modules/crafting/service.js";

describe("crafting service", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>> | null = null;

  beforeAll(async () => {
    try {
      context = await createApiTestContext();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Can't reach database server")) {
        return;
      }
      throw error;
    }
  });

  beforeEach(async () => {
    await context?.resetState();
  });

  afterAll(async () => {
    await context?.close();
  });

  async function createPlayerWithDucats(amount = 50_000) {
    if (!context) {
      throw new Error("Crafting tests require the test database to be available.");
    }
    const guest = await loginAsGuest(context.app);
    await setPlayerDucats(context.prisma, guest.body.playerId, amount);
    return guest.body.playerId;
  }

  it("grants instant combine outputs without creating a crafting job", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_metal_common", 2, "material");
    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_binding_common", 1, "material");

    const result = await startCraftingJob(
      context.prisma,
      playerId,
      "combine_t1_metal_common_to_uncommon",
      "combine",
      0
    );

    expect(result.instant).toBe(true);
    expect(result.granted).toEqual({
      itemCode: "mat_t1_metal_uncommon",
      quantity: 1
    });

    const activeJobs = await context.prisma.craftingJob.count({
      where: {
        playerId,
        claimed: false
      }
    });
    expect(activeJobs).toBe(0);

    const inputRows = await context.prisma.inventoryItem.findMany({
      where: {
        playerId,
        itemCode: {
          in: ["mat_t1_metal_common", "mat_t1_binding_common"]
        }
      }
    });
    expect(inputRows).toHaveLength(0);

    const outputRow = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "mat_t1_metal_uncommon"
      }
    });
    expect(outputRow?.quantity).toBe(1);
  });

  it("creates timed combine jobs and only grants the output after claim", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_metal_uncommon", 2, "material");
    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_arcane_uncommon", 1, "material");

    const started = await startCraftingJob(
      context.prisma,
      playerId,
      "combine_t1_metal_uncommon_to_rare",
      "combine",
      0
    );

    expect(started.instant).toBe(false);

    const outputBeforeClaim = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "mat_t1_metal_rare"
      }
    });
    expect(outputBeforeClaim).toBeNull();

    await expect(claimCraftingJob(context.prisma, playerId, started.job.id)).rejects.toMatchObject({
      code: "CRAFT_NOT_READY"
    });

    await context.prisma.craftingJob.update({
      where: { id: started.job.id },
      data: {
        finishesAt: new Date(Date.now() - 1_000)
      }
    });

    const claimed = await claimCraftingJob(context.prisma, playerId, started.job.id);
    expect(claimed.material).toEqual({
      itemCode: "mat_t1_metal_rare",
      quantity: 1
    });

    const outputAfterClaim = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "mat_t1_metal_rare"
      }
    });
    expect(outputAfterClaim?.quantity).toBe(1);

    const archivedJob = await context.prisma.craftingJob.findUnique({
      where: {
        id: started.job.id
      }
    });
    expect(archivedJob?.claimed).toBe(true);
    expect(archivedJob?.slotIndex).toBeGreaterThanOrEqual(1000);
  });

  it("accepts recycling outputs as substitutes for entry-tier material recipes", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await grantCraftingStackableItem(context.prisma, playerId, "all_salvaged_ingot", 2, "output");
    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_binding_common", 1, "material");

    const result = await startCraftingJob(
      context.prisma,
      playerId,
      "combine_t1_metal_common_to_uncommon",
      "combine",
      1
    );

    expect(result.instant).toBe(true);

    const salvageRow = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "all_salvaged_ingot"
      }
    });
    expect(salvageRow).toBeNull();

    const outputRow = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "mat_t1_metal_uncommon"
      }
    });
    expect(outputRow?.quantity).toBe(1);
  });

  it("allows instant recipes to complete even when all timed crafting slots are occupied", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_metal_uncommon", 6, "material");
    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_arcane_uncommon", 3, "material");
    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_metal_common", 2, "material");
    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_binding_common", 1, "material");

    await startCraftingJob(context.prisma, playerId, "combine_t1_metal_uncommon_to_rare", "combine", 0);
    await startCraftingJob(context.prisma, playerId, "combine_t1_metal_uncommon_to_rare", "combine", 1);
    await startCraftingJob(context.prisma, playerId, "combine_t1_metal_uncommon_to_rare", "combine", 2);

    const result = await startCraftingJob(
      context.prisma,
      playerId,
      "combine_t1_metal_common_to_uncommon",
      "combine",
      0
    );

    expect(result.instant).toBe(true);
    expect(result.granted).toEqual({
      itemCode: "mat_t1_metal_uncommon",
      quantity: 1
    });
  });

  it("rejects timed crafts when the player cannot afford the ducat cost", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats(0);

    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_metal_uncommon", 2, "material");
    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_arcane_uncommon", 1, "material");

    await expect(
      startCraftingJob(context.prisma, playerId, "combine_t1_metal_uncommon_to_rare", "combine", 0)
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_DUCATS"
    });
  });

  it("creates and claims distillation jobs from crafted consumables", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await grantCraftingStackableItem(context.prisma, playerId, "consumable_vigorous_restorative", 3, "output");

    const started = await startCraftingJob(
      context.prisma,
      playerId,
      "distill_consumable_vigorous_restorative_d1",
      "distill",
      2
    );

    expect(started.instant).toBe(false);

    const consumedBase = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "consumable_vigorous_restorative"
      }
    });
    expect(consumedBase).toBeNull();

    await context.prisma.craftingJob.update({
      where: { id: started.job.id },
      data: {
        finishesAt: new Date(Date.now() - 1_000)
      }
    });

    const claimed = await claimCraftingJob(context.prisma, playerId, started.job.id);
    expect(claimed.item?.itemCode).toBe("consumable_vigorous_restorative_d1");

    const distilled = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "consumable_vigorous_restorative_d1"
      }
    });
    expect(distilled?.quantity).toBe(1);
  });

  it("creates and claims second-stage distillation jobs from distilled potions", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await grantCraftingStackableItem(context.prisma, playerId, "consumable_vigorous_restorative_d1", 3, "output");

    const started = await startCraftingJob(
      context.prisma,
      playerId,
      "distill_consumable_vigorous_restorative_d2",
      "distill",
      1
    );

    await context.prisma.craftingJob.update({
      where: { id: started.job.id },
      data: {
        finishesAt: new Date(Date.now() - 1_000)
      }
    });

    const claimed = await claimCraftingJob(context.prisma, playerId, started.job.id);
    expect(claimed.item?.itemCode).toBe("consumable_vigorous_restorative_d2");

    const distilled = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "consumable_vigorous_restorative_d2"
      }
    });
    expect(distilled?.quantity).toBe(1);
  });

  it("rejects distillation when the player has fewer than three base consumables", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await grantCraftingStackableItem(context.prisma, playerId, "consumable_vigorous_restorative", 2, "output");

    await expect(
      startCraftingJob(
        context.prisma,
        playerId,
        "distill_consumable_vigorous_restorative_d1",
        "distill",
        0
      )
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_MATERIALS"
    });
  });

  it("allows refinery crafts to start without consuming ingredients when the cheat is enabled", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();

    await context.prisma.playerProfile.update({
      where: { id: playerId },
      data: {
        unlimitedRefineryMaterialsEnabled: true
      }
    });

    const started = await startCraftingJob(
      context.prisma,
      playerId,
      "combine_t1_metal_uncommon_to_rare",
      "combine",
      0
    );

    expect(started.instant).toBe(false);

    const remainingInputs = await context.prisma.inventoryItem.findMany({
      where: {
        playerId,
        itemCode: {
          in: ["mat_t1_metal_uncommon", "mat_t1_arcane_uncommon"]
        }
      }
    });
    expect(remainingInputs).toHaveLength(0);

    await context.prisma.craftingJob.update({
      where: { id: started.job.id },
      data: {
        finishesAt: new Date(Date.now() - 1_000)
      }
    });

    const claimed = await claimCraftingJob(context.prisma, playerId, started.job.id);
    expect(claimed.material).toEqual({
      itemCode: "mat_t1_metal_rare",
      quantity: 1
    });
  });
});
