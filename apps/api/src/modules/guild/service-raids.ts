import type { Prisma, PrismaClient } from "@prisma/client";

import {
  guildRaidStateResponseSchema,
  type GuildRaidBossDefinition,
  type GuildRaidBonus,
  type GuildRaidReport,
  type GuildRaidStateResponse,
  type GuildRole
} from "@ebonkeep/shared/guild";
import { normalizePlayerClass, type PlayerClass } from "@ebonkeep/shared/core";

import { GUILD_RAID_BOSS_CHAIN, GUILD_RAID_LABEL, getGuildRaidBossDefinition } from "./raid-config.js";
import { getUnlockedGuildRaidBonuses } from "./raid-effects.js";

type GuildRaidDbClient = PrismaClient | Prisma.TransactionClient;

const HOUR_MS = 60 * 60 * 1000;
const MANAGER_ROLES = new Set<GuildRole>(["leader", "officer"]);

type RaidMembershipContext = {
  guildId: string;
  playerId: string;
  role: GuildRole;
  playerClass: PlayerClass;
  level: number;
  power: number;
  playerName: string;
  ducats: number;
  imperials: number;
};

type EncounterInstanceWithParticipants = Prisma.GuildRaidInstanceGetPayload<{
  include: {
    participants: true;
    summonedBy: {
      include: {
        account: {
          select: {
            username: true;
          };
        };
      };
    };
  };
}>;

function getDisplayName(username: string | null | undefined, playerId: string): string {
  return username?.trim() || `Warden ${playerId.slice(-4)}`;
}

function isManagerRole(role: GuildRole): boolean {
  return MANAGER_ROLES.has(role);
}

function deterministicUnitFloat(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function classCoordinationMultiplier(playerClass: PlayerClass): number {
  switch (playerClass) {
    case "juggernaut":
    case "sentinel":
    case "reaver":
      return 1.02;
    case "arbalist":
    case "shade":
    case "disciple":
      return 1;
    default:
      return 1.04;
  }
}

function getRaidLobbyDurationMs(boss: GuildRaidBossDefinition): number {
  return boss.lobbyDurationHours * HOUR_MS;
}

function getRaidLockDurationMs(boss: GuildRaidBossDefinition): number {
  return boss.lockDurationHours * HOUR_MS;
}

function isDateInFuture(value: Date | null | undefined, now: Date): boolean {
  return Boolean(value && value.getTime() > now.getTime());
}

async function ensureGuildRaidProgress(
  tx: GuildRaidDbClient,
  guildId: string
) {
  const existing = await tx.guildRaidProgress.findUnique({
    where: { guildId }
  });

  if (existing) {
    return existing;
  }

  return tx.guildRaidProgress.create({
    data: {
      guildId
    }
  });
}

async function requireGuildMembership(
  tx: GuildRaidDbClient,
  guildId: string,
  playerId: string
): Promise<RaidMembershipContext> {
  const membership = await tx.guildMember.findFirst({
    where: {
      guildId,
      playerId
    },
    include: {
      player: {
        include: {
          account: {
            select: {
              username: true
            }
          },
          currency: true
        }
      }
    }
  });

  if (!membership) {
    throw new Error("NOT_GUILD_MEMBER");
  }

  return {
    guildId,
    playerId,
    role: membership.role as GuildRole,
    playerClass: normalizePlayerClass(membership.player.class),
    level: membership.player.level,
    power: Math.max(0, membership.player.gearScore),
    playerName: getDisplayName(membership.player.account.username, membership.player.id),
    ducats: membership.player.currency?.ducats ?? 0,
    imperials: membership.player.currency?.imperials ?? 0
  };
}

async function loadActiveRaidInstance(
  tx: GuildRaidDbClient,
  activeRaidInstanceId: string | null | undefined
): Promise<EncounterInstanceWithParticipants | null> {
  if (!activeRaidInstanceId) {
    return null;
  }

  return tx.guildRaidInstance.findUnique({
    where: { id: activeRaidInstanceId },
    include: {
      participants: {
        orderBy: [
          { damageDone: "desc" },
          { power: "desc" },
          { joinedAt: "asc" }
        ]
      },
      summonedBy: {
        include: {
          account: {
            select: {
              username: true
            }
          }
        }
      }
    }
  });
}

async function lockGuildRaidInstance(
  tx: GuildRaidDbClient,
  raidInstanceId: string
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "guild_raid_instances" WHERE id = ${raidInstanceId} FOR UPDATE`;
}

async function loadLatestResolvedRaidInstance(
  tx: GuildRaidDbClient,
  guildId: string,
  excludedInstanceId?: string | null
): Promise<EncounterInstanceWithParticipants | null> {
  return tx.guildRaidInstance.findFirst({
    where: {
      guildId,
      resolvedAt: {
        not: null
      },
      ...(excludedInstanceId
        ? {
            id: {
              not: excludedInstanceId
            }
          }
        : {})
    },
    orderBy: {
      resolvedAt: "desc"
    },
    include: {
      participants: {
        orderBy: [
          { damageDone: "desc" },
          { power: "desc" },
          { joinedAt: "asc" }
        ]
      },
      summonedBy: {
        include: {
          account: {
            select: {
              username: true
            }
          }
        }
      }
    }
  });
}

async function getRaidJoinBlockedReason(
  tx: GuildRaidDbClient,
  playerId: string,
  now: Date
): Promise<string | null> {
  const [activeJob, activeContract, activeCrafting] = await Promise.all([
    tx.jobRun.findFirst({
      where: {
        playerId,
        completeAt: { gt: now }
      },
      select: { id: true }
    }),
    tx.contractRun.findFirst({
      where: {
        playerId,
        state: {
          in: ["traveling", "ready_to_claim"]
        }
      },
      select: { id: true }
    }),
    tx.craftingJob.findFirst({
      where: {
        playerId,
        claimed: false,
        finishesAt: { gt: now }
      },
      select: { id: true }
    })
  ]);

  if (activeJob) {
    return "Finish your active job before joining a guild raid.";
  }
  if (activeContract) {
    return "Claim or finish your active contract before joining the raid.";
  }
  if (activeCrafting) {
    return "Collect your current crafting run before committing to the raid.";
  }

  return null;
}

function buildSummonPreview(args: {
  boss: GuildRaidBossDefinition | null;
  role: GuildRole;
  ducats: number;
  imperials: number;
  activeEncounter: EncounterInstanceWithParticipants | null;
  nextAvailableAt: Date | null | undefined;
  now: Date;
}): GuildRaidStateResponse["summonPreview"] {
  const blockedReason =
    !args.boss
      ? "All currently configured raid bosses are already cleared."
      : !isManagerRole(args.role)
        ? "Only guild leaders and officers can summon a raid boss."
        : args.activeEncounter?.state === "lobby"
          ? "A raid lobby is already active for your guild."
          : args.activeEncounter?.state === "locked"
            ? "The guild raid is still locked from the previous attempt."
            : isDateInFuture(args.nextAvailableAt, args.now)
              ? "The guild raid is still locked from the previous failed attempt."
            : null;

  const canAfford = Boolean(
    args.boss &&
      args.ducats >= args.boss.summonDucatsCost &&
      args.imperials >= args.boss.summonImperialsCost
  );

  return {
    ducatsCost: args.boss?.summonDucatsCost ?? 0,
    imperialsCost: args.boss?.summonImperialsCost ?? 0,
    canSummon: blockedReason === null && canAfford,
    canAfford,
    blockedReason:
      blockedReason ??
      (canAfford ? null : "Not enough ducats or imperials to sound the raid summon.")
  };
}

function buildRaidProgression(args: {
  highestBossIndexDefeated: number;
  clearedAtByBossId: Map<string, string>;
}) {
  const currentBossIndex = args.highestBossIndexDefeated + 1;

  return GUILD_RAID_BOSS_CHAIN.map((boss) => ({
    bossId: boss.id,
    orderIndex: boss.orderIndex,
    zoneName: boss.zoneName,
    bossName: boss.bossName,
    status:
      boss.orderIndex <= args.highestBossIndexDefeated
        ? "cleared"
        : boss.orderIndex === currentBossIndex
          ? "current"
          : "upcoming",
    clearedAt: args.clearedAtByBossId.get(boss.id) ?? null,
    unlockedBonus: boss.unlockedBonus
  }));
}

function buildRaidHistoryEntry(instance: {
  id: string;
  bossId: string;
  zoneName: string;
  bossName: string;
  resolvedAt: Date | null;
  firstClear: boolean;
  summary: Prisma.JsonValue | null;
}) {
  const report = toRaidReport(instance.summary);
  const boss = GUILD_RAID_BOSS_CHAIN.find((entry) => entry.id === instance.bossId);
  if (!report || !instance.resolvedAt || !boss) {
    return null;
  }

  return {
    instanceId: instance.id,
    bossId: instance.bossId,
    bossName: instance.bossName,
    zoneName: instance.zoneName,
    resolvedAt: instance.resolvedAt.toISOString(),
    totalDamage: report.totalDamage,
    bossHpRemaining: report.bossHpRemaining,
    firstClear: instance.firstClear,
    unlockedBonus: boss.unlockedBonus,
    ranking: report.ranking
  };
}

function toRaidReport(summary: Prisma.JsonValue | null): GuildRaidReport | null {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return null;
  }

  return summary as GuildRaidReport;
}

function buildEncounterPayload(args: {
  instance: EncounterInstanceWithParticipants;
  boss: GuildRaidBossDefinition;
  currentUserRole: GuildRole;
  currentUserId: string;
  summonerRole: GuildRole | null;
  state: "lobby" | "locked" | "resolved";
  joinBlockedReason: string | null;
}) {
  const currentUserJoined =
    args.instance.participants.some((participant) => participant.playerId === args.currentUserId);
  const isLobby = args.state === "lobby";

  return {
    instanceId: args.instance.id,
    state: args.state,
    boss: args.boss,
    summonedBy: {
      playerId: args.instance.summonedById,
      playerName: getDisplayName(args.instance.summonedBy.account.username, args.instance.summonedBy.id),
      role: args.summonerRole ?? "leader"
    },
    summonedAt: args.instance.summonedAt.toISOString(),
    lobbyEndsAt: args.instance.lobbyEndsAt.toISOString(),
    lockEndsAt: args.instance.lockEndsAt?.toISOString() ?? null,
    joinedPower: args.instance.joinedPower,
    joinCount: args.instance.joinCount || args.instance.participants.length,
    currentUserJoined,
    canJoin:
      isLobby &&
      !currentUserJoined &&
      args.instance.participants.length < args.boss.participantCap &&
      args.joinBlockedReason === null,
    canLeave: isLobby && currentUserJoined,
    canCommenceNow:
      isLobby &&
      isManagerRole(args.currentUserRole) &&
      args.instance.participants.length >= args.boss.minParticipants,
    joinBlockedReason: isLobby && !currentUserJoined ? args.joinBlockedReason : null,
    participants: args.instance.participants.map((participant) => ({
      playerId: participant.playerId,
      playerName: participant.playerName,
      playerClass: normalizePlayerClass(participant.playerClass),
      role: participant.role as GuildRole,
      level: participant.level,
      power: participant.power,
      joinedAt: participant.joinedAt.toISOString(),
      isCurrentUser: participant.playerId === args.currentUserId
    })),
    report: toRaidReport(args.instance.summary)
  };
}

async function resolveLobbyRaid(
  tx: GuildRaidDbClient,
  progress: Awaited<ReturnType<typeof ensureGuildRaidProgress>>,
  activeEncounter: EncounterInstanceWithParticipants,
  now: Date
) {
  const boss = getGuildRaidBossDefinition(activeEncounter.bossOrderIndex);
  if (!boss || activeEncounter.state !== "lobby") {
    return activeEncounter;
  }

  const participants = activeEncounter.participants;
  const participantCount = participants.length;
  const uniqueClasses = new Set(participants.map((participant) => participant.playerClass)).size;
  const weightedEntries = participants.map((participant) => {
    const roll = 0.93 + deterministicUnitFloat(`${activeEncounter.id}:${participant.playerId}:roll`) * 0.14;
    const weightedPower = participant.power * classCoordinationMultiplier(normalizePlayerClass(participant.playerClass)) * roll;
    return {
      participant,
      weightedPower
    };
  });
  const joinedPower = participants.reduce((sum, participant) => sum + participant.power, 0);
  const weightedTotal = weightedEntries.reduce((sum, entry) => sum + entry.weightedPower, 0);
  const compositionMultiplier = 1 + Math.min(0.12, uniqueClasses * 0.02);
  const surplusMultiplier = 1 + Math.max(0, participantCount - boss.minParticipants) * 0.015;
  const pressureRoll = 0.96 + deterministicUnitFloat(`${activeEncounter.id}:outcome`) * 0.08;

  const totalDamage =
    participantCount < boss.minParticipants
      ? Math.round(weightedTotal * 11 * pressureRoll)
      : Math.round(weightedTotal * 20 * compositionMultiplier * surplusMultiplier * pressureRoll);
  const bossHpRemaining = Math.max(0, boss.bossMaxHp - totalDamage);
  const outcome = bossHpRemaining <= 0 ? "victory" : "defeat";
  const firstClear = outcome === "victory" && boss.orderIndex > progress.highestBossIndexDefeated;
  const lockEndsAt = outcome === "defeat" ? new Date(now.getTime() + getRaidLockDurationMs(boss)) : null;

  let remainingDamage = totalDamage;
  const ranking = weightedEntries
    .sort((left, right) => right.weightedPower - left.weightedPower)
    .map((entry, index, sortedEntries) => {
      const remainingWeight = sortedEntries
        .slice(index)
        .reduce((sum, nextEntry) => sum + nextEntry.weightedPower, 0);
      const damageDone =
        index === sortedEntries.length - 1 || remainingWeight <= 0
          ? remainingDamage
          : Math.round((remainingDamage * entry.weightedPower) / remainingWeight);
      remainingDamage = Math.max(0, remainingDamage - damageDone);
      return {
        playerId: entry.participant.playerId,
        playerName: entry.participant.playerName,
        playerClass: normalizePlayerClass(entry.participant.playerClass),
        role: entry.participant.role as GuildRole,
        damageDone,
        damageShareBps: totalDamage > 0 ? Math.round((damageDone / totalDamage) * 10_000) : 0,
        power: entry.participant.power
      };
    });

  const summary =
    participantCount < boss.minParticipants
      ? `Only ${participantCount} raiders answered the call. ${boss.bossName} held the line and the guild must regroup after the lockout.`
      : outcome === "victory"
        ? firstClear
          ? `${boss.bossName} fell under ${totalDamage.toLocaleString()} total damage. The guild unlocked ${boss.unlockedBonus.label} permanently.`
          : `${boss.bossName} was defeated again with ${totalDamage.toLocaleString()} total damage.`
        : `${boss.bossName} survived with ${bossHpRemaining.toLocaleString()} HP after taking ${totalDamage.toLocaleString()} damage.`;

  for (const row of ranking) {
    await tx.guildRaidParticipant.updateMany({
      where: {
        raidInstanceId: activeEncounter.id,
        playerId: row.playerId
      },
      data: {
        damageDone: row.damageDone
      }
    });
  }

  const report: GuildRaidReport = {
    outcome,
    summary,
    resolvedAt: now.toISOString(),
    lockEndsAt: lockEndsAt?.toISOString() ?? null,
    firstClear,
    totalDamage,
    bossHpMax: boss.bossMaxHp,
    bossHpRemaining,
    ranking
  };

  await tx.guildRaidInstance.update({
    where: { id: activeEncounter.id },
    data: {
      state: outcome === "defeat" ? "locked" : "archived",
      resolvedAt: now,
      lockEndsAt,
      joinedPower,
      joinCount: participantCount,
      summary: report as Prisma.InputJsonValue,
      outcome,
      firstClear
    }
  });

  await tx.guildRaidProgress.update({
    where: { guildId: progress.guildId },
    data: {
      highestBossIndexDefeated: firstClear ? boss.orderIndex : progress.highestBossIndexDefeated,
      totalAttempts: { increment: 1 },
      totalVictories: outcome === "victory" ? { increment: 1 } : undefined,
      nextAvailableAt: lockEndsAt,
      lastBossId: boss.id,
      lastOutcome: outcome,
      lastResolvedAt: now,
      activeRaidInstanceId: outcome === "defeat" ? activeEncounter.id : null
    }
  });
}

async function syncGuildRaidState(
  tx: GuildRaidDbClient,
  guildId: string
) {
  const progress = await ensureGuildRaidProgress(tx, guildId);
  const activeEncounter = await loadActiveRaidInstance(tx, progress.activeRaidInstanceId);
  const now = new Date();

  if (!activeEncounter) {
    if (progress.activeRaidInstanceId) {
      await tx.guildRaidProgress.update({
        where: { guildId },
        data: {
          activeRaidInstanceId: null
        }
      });
    }
    if (progress.nextAvailableAt && (progress.nextAvailableAt <= now || progress.lastOutcome === "victory")) {
      await tx.guildRaidProgress.update({
        where: { guildId },
        data: {
          nextAvailableAt: null
        }
      });
    }
    return {
      progress: {
        ...progress,
        activeRaidInstanceId: null,
        nextAvailableAt: progress.nextAvailableAt && progress.nextAvailableAt > now ? progress.nextAvailableAt : null
      },
      activeEncounter: null
    };
  }

  const activeReport = toRaidReport(activeEncounter.summary);
  if (
    activeEncounter.state === "locked" &&
    (activeEncounter.outcome === "victory" || activeReport?.outcome === "victory")
  ) {
    await tx.guildRaidInstance.update({
      where: { id: activeEncounter.id },
      data: {
        state: "archived",
        lockEndsAt: null
      }
    });
    await tx.guildRaidProgress.update({
      where: { guildId },
      data: {
        activeRaidInstanceId: null,
        nextAvailableAt: null
      }
    });
    return {
      progress: await ensureGuildRaidProgress(tx, guildId),
      activeEncounter: null
    };
  }

  if (activeEncounter.state === "lobby" && activeEncounter.lobbyEndsAt <= now) {
    await resolveLobbyRaid(tx, progress, activeEncounter, now);
  }

  const refreshedProgress = await ensureGuildRaidProgress(tx, guildId);
  let refreshedEncounter = await loadActiveRaidInstance(tx, refreshedProgress.activeRaidInstanceId);

  if (
    refreshedEncounter &&
    refreshedEncounter.state === "locked" &&
    refreshedEncounter.lockEndsAt &&
    refreshedEncounter.lockEndsAt <= now
  ) {
    await tx.guildRaidInstance.update({
      where: { id: refreshedEncounter.id },
      data: {
        state: "archived"
      }
    });
    await tx.guildRaidProgress.update({
      where: { guildId },
      data: {
        activeRaidInstanceId: null,
        nextAvailableAt: null
      }
    });
    refreshedEncounter = null;
  }

  return {
    progress: await ensureGuildRaidProgress(tx, guildId),
    activeEncounter: refreshedEncounter
  };
}

async function buildGuildRaidStateInternal(
  tx: GuildRaidDbClient,
  guildId: string,
  playerId: string
): Promise<GuildRaidStateResponse> {
  const membership = await requireGuildMembership(tx, guildId, playerId);
  const { progress, activeEncounter } = await syncGuildRaidState(tx, guildId);
  const activeBoss = getGuildRaidBossDefinition(progress.highestBossIndexDefeated + 1);
  const activeEncounterBoss =
    activeEncounter ? getGuildRaidBossDefinition(activeEncounter.bossOrderIndex) : null;
  const latestResolvedInstance = await loadLatestResolvedRaidInstance(
    tx,
    guildId,
    activeEncounter?.resolvedAt ? activeEncounter.id : null
  );
  const latestResolvedBoss =
    latestResolvedInstance ? getGuildRaidBossDefinition(latestResolvedInstance.bossOrderIndex) : null;
  const clearedVictories = await tx.guildRaidInstance.findMany({
    where: {
      guildId,
      outcome: "victory"
    },
    orderBy: {
      resolvedAt: "asc"
    },
    select: {
      bossId: true,
      resolvedAt: true
    }
  });
  const clearedAtByBossId = new Map<string, string>();
  for (const clear of clearedVictories) {
    if (!clearedAtByBossId.has(clear.bossId) && clear.resolvedAt) {
      clearedAtByBossId.set(clear.bossId, clear.resolvedAt.toISOString());
    }
  }
  const history = (
    await tx.guildRaidInstance.findMany({
      where: {
        guildId,
        outcome: "victory",
        resolvedAt: {
          not: null
        }
      },
      orderBy: {
        resolvedAt: "desc"
      },
      select: {
        id: true,
        bossId: true,
        zoneName: true,
        bossName: true,
        resolvedAt: true,
        firstClear: true,
        summary: true
      }
    })
  )
    .map((instance) => buildRaidHistoryEntry(instance))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const summonerMembership =
    activeEncounter
      ? await tx.guildMember.findFirst({
          where: {
            guildId,
            playerId: activeEncounter.summonedById
          },
          select: {
            role: true
          }
        })
      : null;
  const latestResolvedSummonerMembership =
    latestResolvedInstance
      ? await tx.guildMember.findFirst({
          where: {
            guildId,
            playerId: latestResolvedInstance.summonedById
          },
          select: {
            role: true
          }
        })
      : null;

  const currentUserJoined =
    activeEncounter?.participants.some((participant) => participant.playerId === playerId) ?? false;
  const joinBlockedReason =
    activeEncounter && activeEncounterBoss && activeEncounter.state === "lobby" && !currentUserJoined
      ? activeEncounter.participants.length >= activeEncounterBoss.participantCap
        ? "The raid lobby is already full."
        : await getRaidJoinBlockedReason(tx, playerId, new Date())
      : null;
  const summonPreview = buildSummonPreview({
    boss: activeBoss,
    role: membership.role,
    ducats: membership.ducats,
    imperials: membership.imperials,
    activeEncounter,
    nextAvailableAt: progress.nextAvailableAt,
    now: new Date()
  });
  const latestReport =
    toRaidReport(activeEncounter?.summary ?? null) ??
    toRaidReport(latestResolvedInstance?.summary ?? null);

  return guildRaidStateResponseSchema.parse({
    guildId,
    raidLabel: GUILD_RAID_LABEL,
    totalBossCount: GUILD_RAID_BOSS_CHAIN.length,
    bossesDefeatedCount: Math.max(0, progress.highestBossIndexDefeated + 1),
    activeBoss,
    activeEncounter: activeEncounter
      && activeEncounterBoss
      ? buildEncounterPayload({
          instance: activeEncounter,
          boss: activeEncounterBoss,
          currentUserRole: membership.role,
          currentUserId: playerId,
          summonerRole: (summonerMembership?.role as GuildRole | null | undefined) ?? null,
          state: activeEncounter.state === "locked" ? "locked" : "lobby",
          joinBlockedReason
        })
      : null,
    latestResolvedEncounter:
      latestResolvedInstance && latestResolvedBoss
        ? buildEncounterPayload({
            instance: latestResolvedInstance,
            boss: latestResolvedBoss,
            currentUserRole: membership.role,
            currentUserId: playerId,
            summonerRole: (latestResolvedSummonerMembership?.role as GuildRole | null | undefined) ?? null,
            state: "resolved",
            joinBlockedReason: null
          })
        : null,
    latestReport,
    history,
    unlockedBonuses: getUnlockedGuildRaidBonuses(progress.highestBossIndexDefeated),
    progression: buildRaidProgression({
      highestBossIndexDefeated: progress.highestBossIndexDefeated,
      clearedAtByBossId
    }),
    currentUserRole: membership.role,
    currentUserCanSummon: summonPreview.canSummon,
    summonPreview
  });
}

export async function getGuildRaidState(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<GuildRaidStateResponse> {
  return buildGuildRaidStateInternal(prisma, guildId, playerId);
}

export async function summonGuildRaid(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<GuildRaidStateResponse> {
  await prisma.$transaction(async (tx) => {
    const membership = await requireGuildMembership(tx, guildId, playerId);
    if (!isManagerRole(membership.role)) {
      throw new Error("INSUFFICIENT_PERMISSIONS");
    }

    const { progress, activeEncounter } = await syncGuildRaidState(tx, guildId);
    if (activeEncounter) {
      throw new Error(activeEncounter.state === "locked" ? "RAID_LOCKED" : "RAID_ALREADY_ACTIVE");
    }

    const boss = getGuildRaidBossDefinition(progress.highestBossIndexDefeated + 1);
    if (!boss) {
      throw new Error("RAID_CHAIN_COMPLETE");
    }
    if (membership.ducats < boss.summonDucatsCost || membership.imperials < boss.summonImperialsCost) {
      throw new Error("INSUFFICIENT_CURRENCY");
    }

    const deduction = await tx.currencyBalance.updateMany({
      where: {
        playerId,
        ducats: { gte: boss.summonDucatsCost },
        imperials: { gte: boss.summonImperialsCost }
      },
      data: {
        ducats: { decrement: boss.summonDucatsCost },
        imperials: { decrement: boss.summonImperialsCost }
      }
    });

    if (deduction.count !== 1) {
      throw new Error("INSUFFICIENT_CURRENCY");
    }

    const now = new Date();
    const encounter = await tx.guildRaidInstance.create({
      data: {
        guildId,
        bossId: boss.id,
        bossOrderIndex: boss.orderIndex,
        zoneKey: boss.zoneKey,
        zoneName: boss.zoneName,
        bossName: boss.bossName,
        bossTitle: boss.bossTitle,
        summonedById: playerId,
        summonedAt: now,
        lobbyEndsAt: new Date(now.getTime() + getRaidLobbyDurationMs(boss)),
        recommendedPower: boss.recommendedGuildPower,
        bossMaxHp: boss.bossMaxHp
      }
    });

    await tx.guildRaidProgress.update({
      where: { guildId },
      data: {
        activeRaidInstanceId: encounter.id
      }
    });
  });

  return buildGuildRaidStateInternal(prisma, guildId, playerId);
}

export async function joinGuildRaid(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<GuildRaidStateResponse> {
  await prisma.$transaction(async (tx) => {
    const membership = await requireGuildMembership(tx, guildId, playerId);
    const { activeEncounter } = await syncGuildRaidState(tx, guildId);
    const activeEncounterBoss =
      activeEncounter ? getGuildRaidBossDefinition(activeEncounter.bossOrderIndex) : null;

    if (!activeEncounter || activeEncounter.state !== "lobby") {
      throw new Error("NO_ACTIVE_RAID");
    }

    if (!activeEncounterBoss) {
      throw new Error("INVALID_RAID_BOSS");
    }

    await lockGuildRaidInstance(tx, activeEncounter.id);
    const lockedEncounter = await loadActiveRaidInstance(tx, activeEncounter.id);
    if (!lockedEncounter || lockedEncounter.state !== "lobby") {
      throw new Error("NO_ACTIVE_RAID");
    }

    if (lockedEncounter.participants.some((participant) => participant.playerId === playerId)) {
      return;
    }
    if (lockedEncounter.participants.length >= activeEncounterBoss.participantCap) {
      throw new Error("RAID_LOBBY_FULL");
    }

    const blockedReason = await getRaidJoinBlockedReason(tx, playerId, new Date());
    if (blockedReason) {
      throw new Error(blockedReason);
    }

    await tx.guildRaidParticipant.create({
      data: {
        raidInstanceId: lockedEncounter.id,
        playerId,
        playerName: membership.playerName,
        playerClass: membership.playerClass,
        role: membership.role,
        level: membership.level,
        power: membership.power
      }
    });

    await tx.guildRaidInstance.update({
      where: { id: lockedEncounter.id },
      data: {
        joinedPower: { increment: membership.power },
        joinCount: { increment: 1 }
      }
    });
  });

  return buildGuildRaidStateInternal(prisma, guildId, playerId);
}

export async function leaveGuildRaid(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<GuildRaidStateResponse> {
  await prisma.$transaction(async (tx) => {
    await requireGuildMembership(tx, guildId, playerId);
    const { activeEncounter } = await syncGuildRaidState(tx, guildId);

    if (!activeEncounter || activeEncounter.state !== "lobby") {
      throw new Error("NO_ACTIVE_RAID");
    }

    await lockGuildRaidInstance(tx, activeEncounter.id);
    const lockedEncounter = await loadActiveRaidInstance(tx, activeEncounter.id);
    if (!lockedEncounter || lockedEncounter.state !== "lobby") {
      throw new Error("NO_ACTIVE_RAID");
    }

    const participant = lockedEncounter.participants.find((entry) => entry.playerId === playerId);
    if (!participant) {
      throw new Error("NOT_JOINED");
    }

    const deleteResult = await tx.guildRaidParticipant.deleteMany({
      where: {
        raidInstanceId: lockedEncounter.id,
        playerId
      }
    });

    if (deleteResult.count > 0) {
      await tx.guildRaidInstance.update({
        where: { id: lockedEncounter.id },
        data: {
          joinedPower: { decrement: participant.power },
          joinCount: { decrement: 1 }
        }
      });
    }
  });

  return buildGuildRaidStateInternal(prisma, guildId, playerId);
}

export async function commenceGuildRaidNow(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<GuildRaidStateResponse> {
  await prisma.$transaction(async (tx) => {
    const membership = await requireGuildMembership(tx, guildId, playerId);
    if (!isManagerRole(membership.role)) {
      throw new Error("INSUFFICIENT_PERMISSIONS");
    }

    const { activeEncounter, progress } = await syncGuildRaidState(tx, guildId);
    const activeEncounterBoss =
      activeEncounter ? getGuildRaidBossDefinition(activeEncounter.bossOrderIndex) : null;
    if (!activeEncounter || activeEncounter.state !== "lobby") {
      throw new Error("NO_ACTIVE_RAID");
    }
    if (!activeEncounterBoss) {
      throw new Error("INVALID_RAID_BOSS");
    }
    if (activeEncounter.participants.length < activeEncounterBoss.minParticipants) {
      throw new Error("NOT_ENOUGH_PARTICIPANTS");
    }

    await resolveLobbyRaid(tx, progress, activeEncounter, new Date());
  });

  return buildGuildRaidStateInternal(prisma, guildId, playerId);
}
