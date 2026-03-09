import type { PrismaClient } from "@prisma/client";
import type { PlayerClass } from "@ebonkeep/shared";

import { createStarterInventoryItems } from "./item-service.js";

export async function ensureStarterInventoryItems(
  prisma: PrismaClient,
  playerId: string,
  playerClass: PlayerClass
): Promise<void> {
  const items = createStarterInventoryItems(playerId, playerClass);

  for (const item of items) {
    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      update: {
        itemCode: item.itemCode,
        slotKey: "inventory",
        quantity: 1,
        itemData: item
      },
      create: {
        id: item.id,
        playerId,
        itemCode: item.itemCode,
        slotKey: "inventory",
        quantity: 1,
        itemData: item
      }
    });
  }
}
