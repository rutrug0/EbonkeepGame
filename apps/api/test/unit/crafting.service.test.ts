import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setPlayerDucats } from "../helpers/fixtures.js";
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
    const suffix = randomUUID().replaceAll("-", "");
    const account = await context.prisma.account.create({
      data: {
        provider: "test",
        providerUserId: `crafting-${suffix}`,
        username: `crafter_${suffix.slice(0, 10)}`
      }
    });
    const profile = await context.prisma.playerProfile.create({
      data: {
        id: `player_${suffix}`,
        accountId: account.id,
        class: "juggernaut",
        portraitId: "str_01",
        backgroundId: "bg_01",
        level: 50,
        gearScore: 0
      }
    });
    await setPlayerDucats(context.prisma, profile.id, amount);
    return profile.id;
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

    await context.prisma.inventoryItem.create({
      data: {
        id: `item_${randomUUID().replaceAll("-", "")}`,
        playerId,
        itemCode: "all_salvaged_ingot",
        slotKey: "inventory",
        quantity: 2
      }
    });
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

  it("stores placeholder icon paths for crafted stacks and refreshes stale item data on increment", async () => {
    if (!context) {
      return;
    }
    const playerId = await createPlayerWithDucats();
    const existingId = `itm_${randomUUID().replaceAll("-", "")}`;

    await context.prisma.inventoryItem.create({
      data: {
        id: existingId,
        playerId,
        itemCode: "consumable_vigorous_restorative",
        slotKey: "inventory",
        quantity: 1,
        itemData: {
          id: existingId,
          itemCode: "consumable_vigorous_restorative",
          itemName: "Broken Icon Potion",
          iconAssetPath: "/assets/materials/missing-icon.png"
        }
      }
    });

    await grantCraftingStackableItem(context.prisma, playerId, "mat_t1_metal_common", 1, "material");
    await grantCraftingStackableItem(context.prisma, playerId, "consumable_vigorous_restorative", 2, "output");

    const materialRow = await context.prisma.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: "mat_t1_metal_common"
      },
      select: {
        itemData: true
      }
    });
    const outputRow = await context.prisma.inventoryItem.findUnique({
      where: {
        id: existingId
      },
      select: {
        quantity: true,
        itemData: true
      }
    });

    expect((materialRow?.itemData as { iconAssetPath?: string } | null)?.iconAssetPath).toMatch(
      /^\/assets\/random_stuff_materials\/material-\d{2}\.png$/
    );
    expect(outputRow?.quantity).toBe(3);
    expect((outputRow?.itemData as { iconAssetPath?: string } | null)?.iconAssetPath).toMatch(
      /^\/assets\/random_stuff_materials\/material-\d{2}\.png$/
    );
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

  it("surfaces slot insert races as a conflict instead of a generic failure", async () => {
    const fakeTx = {
      craftingJob: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue({ code: "P2002" })
      },
      currencyBalance: {
        findUnique: vi.fn().mockResolvedValue({
          playerId: "player_race",
          ducats: 50_000
        }),
        update: vi.fn().mockResolvedValue({})
      },
      playerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          unlimitedRefineryMaterialsEnabled: true
        })
      },
      inventoryItem: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    const fakePrisma = {
      $transaction: vi.fn(async (callback: (tx: typeof fakeTx) => unknown) => callback(fakeTx))
    };

    await expect(
      startCraftingJob(
        fakePrisma as Parameters<typeof startCraftingJob>[0],
        "player_race",
        "combine_t1_metal_uncommon_to_rare",
        "combine",
        0
      )
    ).rejects.toMatchObject({
      code: "INVALID_SLOT",
      statusCode: 409
    });
  });
});
