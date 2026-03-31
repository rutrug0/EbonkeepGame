import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import { CRAFTING_JOB_SLOT_INDEXES } from "@ebonkeep/shared/crafting";
import {
  allPlayerClasses,
  normalizePlayerClass,
  classToEquipmentGroup,
  type EquipmentSlotId,
  type PlayerClass
} from "@ebonkeep/shared/core";
import type { InventoryItem, ItemRarity } from "@ebonkeep/shared/inventory";
import type { PlayerCheatSettings, PlayerState } from "@ebonkeep/shared/player";

import { allDefinedItemTemplates, rollInventoryItem } from "../inventory/item-service.js";
import { CHEAT_FAST_CRAFT_DURATION_SEC } from "../crafting/service.js";
import { getCumulativeExperienceToReachLevel, playerProgressionConfig } from "./progression-service.js";
import { ensurePlayerEquipmentSlots, loadPlayerState } from "./state-service.js";
import { getGuildRaidBossDefinition } from "../guild/raid-config.js";

type PlayerDbClient = PrismaClient | Prisma.TransactionClient;

const STANDARD_CHEAT_SLOT_IDS: readonly EquipmentSlotId[] = [
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
  "ringRight"
];

export const CHEAT_FAST_TRAVEL_DURATION_MS = 2_000;
export const CHEAT_FAST_CONTRACT_REPLENISH_DURATION_MS = 3_000;
export const CHEAT_FAST_ARENA_REPLENISH_DURATION_MS = 2_000;
export const CHEAT_DUCATS_GRANT = 1_000_000;
export const CHEAT_IMPERIALS_GRANT = 10_000;
export const CHEAT_RENOWN_GRANT = 20;
export const CHEAT_GUILD_RAID_SQUAD_SIZE = 30;
export const CHEAT_GUILD_RAID_MEMBER_LEVEL = 30;
export const CHEAT_GUILD_RAID_MEMBER_POWER = 100;
const CHEAT_GUILD_RAID_CLASS_ROTATION = [...allPlayerClasses] as readonly PlayerClass[];

async function loadRequiredPlayerState(prisma: PlayerDbClient, playerId: string): Promise<PlayerState> {
  const playerState = await loadPlayerState(prisma, playerId);
  if (!playerState) {
    throw new Error("Player state not found.");
  }
  return playerState;
}

function pickRandomTemplateIdForSlot(args: {
  playerClass: PlayerState["class"];
  playerLevel: number;
  slotId: EquipmentSlotId;
}): string {
  const equipmentGroup = classToEquipmentGroup(args.playerClass);
  const matchesOwner = (template: (typeof allDefinedItemTemplates)[number]) =>
    template.allowedClass === equipmentGroup || template.allowedClass === "all";
  const matchesSlot = (template: (typeof allDefinedItemTemplates)[number]) => template.allowedSlotIds.includes(args.slotId);

  const exactTemplates = allDefinedItemTemplates.filter(
    (template) =>
      matchesOwner(template) &&
      matchesSlot(template) &&
      template.dropMinLevel <= args.playerLevel &&
      template.dropMaxLevel >= args.playerLevel
  );
  const nearbyTemplates = allDefinedItemTemplates.filter(
    (template) =>
      matchesOwner(template) &&
      matchesSlot(template) &&
      template.baseLevel <= args.playerLevel + 5 &&
      template.baseLevel >= Math.max(1, args.playerLevel - 8)
  );
  const fallbackTemplates = allDefinedItemTemplates.filter(
    (template) => matchesOwner(template) && matchesSlot(template)
  );
  const candidates = exactTemplates.length > 0 ? exactTemplates : nearbyTemplates.length > 0 ? nearbyTemplates : fallbackTemplates;
  const template = candidates[Math.floor(Math.random() * candidates.length)];

  if (!template) {
    throw new Error(`No item template available for slot ${args.slotId}.`);
  }

  return template.id;
}

export async function updatePlayerCheatSettings(
  prisma: PlayerDbClient,
  playerId: string,
  settings: PlayerCheatSettings
): Promise<PlayerState> {
  await prisma.playerProfile.update({
    where: { id: playerId },
    data: {
      fastTravelEnabled: settings.fastTravelEnabled,
      fastContractReplenishEnabled: settings.fastContractReplenishEnabled,
      fastArenaReplenishEnabled: settings.fastArenaReplenishEnabled,
      invincibilityEnabled: settings.invincibilityEnabled,
      fastTrainTimeEnabled: settings.fastTrainTimeEnabled,
      fastCraftTimeEnabled: settings.fastCraftTimeEnabled,
      unlimitedAcademyDonationsEnabled: settings.unlimitedAcademyDonationsEnabled,
      unlimitedForgeConsumablesEnabled: settings.unlimitedForgeConsumablesEnabled,
      unlimitedRefineryMaterialsEnabled: settings.unlimitedRefineryMaterialsEnabled
    },
    select: { id: true }
  });

  if (settings.fastCraftTimeEnabled) {
    const acceleratedFinishesAt = new Date(Date.now() + (CHEAT_FAST_CRAFT_DURATION_SEC * 1000));
    await prisma.craftingJob.updateMany({
      where: {
        playerId,
        claimed: false,
        slotIndex: { in: [...CRAFTING_JOB_SLOT_INDEXES] },
        finishesAt: { gt: acceleratedFinishesAt }
      },
      data: {
        finishesAt: acceleratedFinishesAt
      }
    });
  }

  return loadRequiredPlayerState(prisma, playerId);
}

export async function replenishPlayerForCheats(
  prisma: PlayerDbClient,
  playerId: string,
  now = new Date()
): Promise<PlayerState> {
  const playerState = await loadRequiredPlayerState(prisma, playerId);

  await prisma.playerProfile.update({
    where: { id: playerId },
    data: {
      hitpointsCurrent: playerState.health.max,
      hitpointsUpdatedAt: now,
      staminaCurrent: playerState.stamina.max,
      staminaUpdatedAt: now
    }
  });

  return loadRequiredPlayerState(prisma, playerId);
}

export async function levelPlayerForCheats(
  prisma: PlayerDbClient,
  playerId: string,
  targetLevel: number
): Promise<PlayerState> {
  const playerState = await loadRequiredPlayerState(prisma, playerId);
  const normalizedTargetLevel = Math.min(playerProgressionConfig.maxLevel, Math.max(1, Math.floor(targetLevel)));

  if (normalizedTargetLevel === playerState.level) {
    throw new Error("Target level must be different from the current level.");
  }

  await prisma.playerProfile.update({
    where: { id: playerId },
    data: {
      level: normalizedTargetLevel,
      experience: getCumulativeExperienceToReachLevel(normalizedTargetLevel)
    }
  });

  return loadRequiredPlayerState(prisma, playerId);
}

export async function generateEquipmentForCheats(
  prisma: PlayerDbClient,
  playerId: string,
  rarity: ItemRarity
): Promise<{ playerState: PlayerState; generatedItems: InventoryItem[] }> {
  const playerState = await loadRequiredPlayerState(prisma, playerId);
  const generatedItems: InventoryItem[] = [];

  for (const slotId of STANDARD_CHEAT_SLOT_IDS) {
    const templateId = pickRandomTemplateIdForSlot({
      playerClass: playerState.class,
      playerLevel: playerState.level,
      slotId
    });
    const item = rollInventoryItem({
      playerId,
      templateId,
      rarity,
      itemLevel: playerState.level
    });

    await prisma.inventoryItem.create({
      data: {
        id: item.id,
        playerId,
        itemCode: item.itemCode,
        slotKey: "inventory",
        quantity: 1,
        itemData: item
      }
    });

    generatedItems.push(item);
  }

  return {
    playerState: await loadRequiredPlayerState(prisma, playerId),
    generatedItems
  };
}

export async function grantCurrencyForCheats(
  prisma: PlayerDbClient,
  playerId: string
): Promise<{ playerState: PlayerState; ducatsGranted: number; imperialsGranted: number }> {
  await prisma.currencyBalance.upsert({
    where: { playerId },
    update: {
      ducats: { increment: CHEAT_DUCATS_GRANT },
      imperials: { increment: CHEAT_IMPERIALS_GRANT },
      renown: { increment: CHEAT_RENOWN_GRANT }
    },
    create: {
      playerId,
      ducats: CHEAT_DUCATS_GRANT,
      imperials: CHEAT_IMPERIALS_GRANT,
      renown: CHEAT_RENOWN_GRANT
    }
  });

  return {
    playerState: await loadRequiredPlayerState(prisma, playerId),
    ducatsGranted: CHEAT_DUCATS_GRANT,
    imperialsGranted: CHEAT_IMPERIALS_GRANT
  };
}

function getCheatRaidBotUsername(guildId: string, index: number): string {
  return `raid_${guildId.slice(-6)}_${String(index + 1).padStart(2, "0")}`;
}

function getCheatRaidBotProviderUserId(guildId: string, index: number): string {
  return `guild-raid-bot:${guildId}:${index + 1}`;
}

function getCheatRaidBotClass(index: number): PlayerClass {
  return normalizePlayerClass(
    CHEAT_GUILD_RAID_CLASS_ROTATION[index % CHEAT_GUILD_RAID_CLASS_ROTATION.length] ?? "juggernaut"
  );
}

async function syncGuildPower(tx: PlayerDbClient, guildId: string): Promise<number> {
  const members = await tx.guildMember.findMany({
    where: { guildId },
    include: {
      player: {
        select: {
          gearScore: true
        }
      }
    }
  });

  let totalPower = 0;
  for (const member of members) {
    const contributedPower = member.player.gearScore;
    totalPower += contributedPower;

    if (member.contributedPower !== contributedPower) {
      await tx.guildMember.update({
        where: { id: member.id },
        data: { contributedPower }
      });
    }
  }

  await tx.guild.update({
    where: { id: guildId },
    data: { totalPower }
  });

  return totalPower;
}

export async function seedGuildRaidSquadForCheats(
  prisma: PlayerDbClient,
  playerId: string
): Promise<{
  playerState: PlayerState;
  createdMembers: number;
  joinedRaiders: number;
  guildMemberCount: number;
  raidJoinCount: number;
}> {
  const membership = await prisma.guildMember.findUnique({
    where: { playerId },
    include: {
      guild: {
        include: {
          raidProgress: true
        }
      }
    }
  });

  if (!membership) {
    throw new Error("PLAYER_NOT_IN_GUILD");
  }

  const guildId = membership.guildId;
  const activeRaidInstanceId = membership.guild.raidProgress?.activeRaidInstanceId ?? null;
  const activeRaid =
    activeRaidInstanceId
      ? await prisma.guildRaidInstance.findUnique({
          where: { id: activeRaidInstanceId },
          include: {
            participants: {
              select: {
                playerId: true
              }
            }
          }
        })
      : null;

  const activeBoss = activeRaid ? getGuildRaidBossDefinition(activeRaid.bossOrderIndex) : null;
  const existingRaidParticipantIds = new Set(activeRaid?.participants.map((participant) => participant.playerId) ?? []);
  let availableGuildSlots = Math.max(
    0,
    membership.guild.maxMembers - (await prisma.guildMember.count({ where: { guildId } }))
  );
  let availableRaidSlots =
    activeRaid && activeRaid.state === "lobby" && activeBoss
      ? Math.max(0, activeBoss.participantCap - existingRaidParticipantIds.size)
      : 0;
  let createdMembers = 0;
  let joinedRaiders = 0;

  for (let index = 0; index < CHEAT_GUILD_RAID_SQUAD_SIZE; index += 1) {
    const username = getCheatRaidBotUsername(guildId, index);
    const providerUserId = getCheatRaidBotProviderUserId(guildId, index);
    const playerClass = getCheatRaidBotClass(index);

    const account = await prisma.account.upsert({
      where: {
        provider_providerUserId: {
          provider: "dev-guest",
          providerUserId
        }
      },
      update: {
        username
      },
      create: {
        provider: "dev-guest",
        providerUserId,
        username,
        emailVerified: true
      }
    });

    let profile = await prisma.playerProfile.findFirst({
      where: { accountId: account.id }
    });

    if (!profile) {
      profile = await prisma.playerProfile.create({
        data: {
          id: `player_${randomUUID().replaceAll("-", "")}`,
          accountId: account.id,
          class: playerClass,
          portraitId: "str_01",
          backgroundId: "bg_01",
          level: CHEAT_GUILD_RAID_MEMBER_LEVEL,
          experience: getCumulativeExperienceToReachLevel(CHEAT_GUILD_RAID_MEMBER_LEVEL),
          gearScore: CHEAT_GUILD_RAID_MEMBER_POWER
        }
      });
    } else {
      profile = await prisma.playerProfile.update({
        where: { id: profile.id },
        data: {
          class: playerClass,
          level: CHEAT_GUILD_RAID_MEMBER_LEVEL,
          experience: getCumulativeExperienceToReachLevel(CHEAT_GUILD_RAID_MEMBER_LEVEL),
          gearScore: CHEAT_GUILD_RAID_MEMBER_POWER
        }
      });
    }

    await prisma.playerStat.upsert({
      where: { playerId: profile.id },
      update: {
        strength: 30,
        intelligence: 30,
        dexterity: 30,
        vitality: 30,
        initiative: 30,
        luck: 30
      },
      create: {
        playerId: profile.id,
        strength: 30,
        intelligence: 30,
        dexterity: 30,
        vitality: 30,
        initiative: 30,
        luck: 30
      }
    });

    await prisma.currencyBalance.upsert({
      where: { playerId: profile.id },
      update: {},
      create: {
        playerId: profile.id,
        ducats: 0,
        imperials: 0,
        renown: 0
      }
    });

    await ensurePlayerEquipmentSlots(prisma, profile.id);

    const existingGuildMembership = await prisma.guildMember.findUnique({
      where: { playerId: profile.id }
    });

    let isGuildMember = existingGuildMembership?.guildId === guildId;

    if (!existingGuildMembership && availableGuildSlots > 0) {
      await prisma.guildMember.create({
        data: {
          guildId,
          playerId: profile.id,
          role: "member",
          contributedPower: CHEAT_GUILD_RAID_MEMBER_POWER
        }
      });
      createdMembers += 1;
      availableGuildSlots -= 1;
      isGuildMember = true;
    } else if (existingGuildMembership?.guildId === guildId && existingGuildMembership.contributedPower !== CHEAT_GUILD_RAID_MEMBER_POWER) {
      await prisma.guildMember.update({
        where: { id: existingGuildMembership.id },
        data: {
          contributedPower: CHEAT_GUILD_RAID_MEMBER_POWER
        }
      });
    }

    if (
      isGuildMember &&
      activeRaid &&
      activeRaid.state === "lobby" &&
      activeBoss &&
      availableRaidSlots > 0 &&
      !existingRaidParticipantIds.has(profile.id)
    ) {
      await prisma.guildRaidParticipant.create({
        data: {
          raidInstanceId: activeRaid.id,
          playerId: profile.id,
          playerName: username,
          playerClass,
          role: "member",
          level: CHEAT_GUILD_RAID_MEMBER_LEVEL,
          power: CHEAT_GUILD_RAID_MEMBER_POWER
        }
      });
      existingRaidParticipantIds.add(profile.id);
      joinedRaiders += 1;
      availableRaidSlots -= 1;
    }
  }

  const guildMemberCount = await prisma.guildMember.count({
    where: { guildId }
  });

  let raidJoinCount = activeRaid?.joinCount ?? 0;
  if (activeRaid && activeRaid.state === "lobby" && activeBoss) {
    const raidPowerAggregate = await prisma.guildRaidParticipant.aggregate({
      where: {
        raidInstanceId: activeRaid.id
      },
      _sum: {
        power: true
      }
    });
    raidJoinCount = existingRaidParticipantIds.size;
    await prisma.guildRaidInstance.update({
      where: { id: activeRaid.id },
      data: {
        joinCount: raidJoinCount,
        joinedPower: raidPowerAggregate._sum.power ?? 0
      }
    });
  }

  await syncGuildPower(prisma, guildId);

  return {
    playerState: await loadRequiredPlayerState(prisma, playerId),
    createdMembers,
    joinedRaiders,
    guildMemberCount,
    raidJoinCount
  };
}

export async function resetGuildRaidProgressForCheats(
  prisma: PlayerDbClient,
  playerId: string
): Promise<{
  playerState: PlayerState;
  removedInstances: number;
}> {
  const membership = await prisma.guildMember.findUnique({
    where: { playerId }
  });

  if (!membership) {
    throw new Error("PLAYER_NOT_IN_GUILD");
  }

  const guildId = membership.guildId;
  const raidInstances = await prisma.guildRaidInstance.findMany({
    where: { guildId },
    select: { id: true }
  });
  const raidInstanceIds = raidInstances.map((instance) => instance.id);

  if (raidInstanceIds.length > 0) {
    await prisma.guildRaidParticipant.deleteMany({
      where: {
        raidInstanceId: {
          in: raidInstanceIds
        }
      }
    });

    await prisma.guildRaidInstance.deleteMany({
      where: {
        id: {
          in: raidInstanceIds
        }
      }
    });
  }

  await prisma.guildRaidProgress.upsert({
    where: { guildId },
    update: {
      highestBossIndexDefeated: -1,
      totalAttempts: 0,
      totalVictories: 0,
      activeRaidInstanceId: null,
      nextAvailableAt: null,
      lastBossId: null,
      lastOutcome: null,
      lastResolvedAt: null
    },
    create: {
      guildId,
      highestBossIndexDefeated: -1,
      totalAttempts: 0,
      totalVictories: 0,
      activeRaidInstanceId: null,
      nextAvailableAt: null,
      lastBossId: null,
      lastOutcome: null,
      lastResolvedAt: null
    }
  });

  await syncGuildPower(prisma, guildId);

  return {
    playerState: await loadRequiredPlayerState(prisma, playerId),
    removedInstances: raidInstanceIds.length
  };
}
