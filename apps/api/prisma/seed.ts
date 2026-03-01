import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    update: {},
    create: {
      id: "player_local_default",
      accountId: account.id,
      class: "warrior",
      level: 1,
      gearScore: 10
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
    update: {},
    create: {
      playerId: profile.id,
      ducats: 100,
      imperials: 10
    }
  });

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
