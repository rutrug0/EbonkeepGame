import { PrismaClient } from "@prisma/client";
import { normalizePlayerClass, type PlayerClass } from "@ebonkeep/shared/core";
import { ensureStarterInventoryItems } from "../src/modules/inventory/starter-items.js";

const prisma = new PrismaClient();
const TEST_STARTING_DUCATS = 100_000;
const equipmentSlotIds = [
  "helmet",
  "necklace",
  "upperArmor",
  "belt",
  "ringLeft",
  "weapon",
  "pauldrons",
  "gloves",
  "lowerArmor",
  "boots",
  "ringRight",
  "vestige1",
  "vestige2",
  "vestige3"
] as const;

async function main(): Promise<void> {
  const account = await prisma.account.upsert({
    where: {
      provider_providerUserId: {
        provider: "dev-guest",
        providerUserId: "local-default"
      }
    },
    update: {},
    create: {
      provider: "dev-guest",
      providerUserId: "local-default"
    }
  });

  const profile = await prisma.playerProfile.upsert({
    where: {
      id: "player_local_default"
    },
    update: { class: "juggernaut", portraitId: "str_01", backgroundId: "bg_01" },
    create: {
      id: "player_local_default",
      accountId: account.id,
      class: "juggernaut",
      portraitId: "str_01",
      backgroundId: "bg_01",
      level: 1,
      gearScore: 0
    }
  });

  await prisma.playerStat.upsert({
    where: { playerId: profile.id },
    update: {},
    create: {
      playerId: profile.id,
      strength: 12,
      intelligence: 8,
      dexterity: 10,
      vitality: 12,
      initiative: 10,
      luck: 9
    }
  });

  await prisma.currencyBalance.upsert({
    where: { playerId: profile.id },
    update: {
      ducats: TEST_STARTING_DUCATS
    },
    create: {
      playerId: profile.id,
      ducats: TEST_STARTING_DUCATS,
      imperials: 10
    }
  });

  const existingEquipmentSlots = await prisma.equipmentSlot.findMany({
    where: { playerId: profile.id },
    select: { slotType: true }
  });
  const existingSlotTypes = new Set(existingEquipmentSlots.map((slot) => slot.slotType));
  const missingEquipmentSlots = equipmentSlotIds.filter((slotId) => !existingSlotTypes.has(slotId));

  if (missingEquipmentSlots.length > 0) {
    await prisma.equipmentSlot.createMany({
      data: missingEquipmentSlots.map((slotId) => ({
        id: `equip_${profile.id}_${slotId}`,
        playerId: profile.id,
        slotType: slotId
      }))
    });
  }

  await ensureStarterInventoryItems(prisma, profile.id, normalizePlayerClass(profile.class));

  console.log("Seed complete for local default guest player.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
