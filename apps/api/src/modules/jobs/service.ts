import type { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

import {
  EMPTY_BUNDLE,
  HOUR_MS,
  JOB_BOARD_REFRESH_MS,
  JOB_TEMPLATES_BY_ID,
  addRewardBundles,
  buildJobBoardState,
  buildRunReleaseAtMs,
  getCompletedHours,
  getFocusUnlockHours,
  getPlayerLevelRewardMultiplier,
  jobsMutationResponseSchema,
  jobsStateResponseSchema,
  resolveRunRewards,
  type JobActiveRunRuntime,
  type JobsHistoryEntry,
  type JobsMutationResponse,
  type JobsStateResponse,
  type RewardBundle
} from "@ebonkeep/shared/jobs";

export type JobsDbClient = PrismaClient | Prisma.TransactionClient;

const JOBS_EVENT_CODE = "jobs_state_v1";
const JOBS_HISTORY_LIMIT = 8;
const JOBS_DAILY_REROLLS = 2;
export const JOBS_ACTIVITY_LOCKED_MESSAGE = "Finish the active job before starting another activity.";

type PersistedJobsState = {
  boardCycle: number;
  boardNonce: number;
  refreshesRemaining: number;
  refreshesResetAt: string;
  activeRun: JobActiveRunRuntime | null;
  stash: RewardBundle;
  history: JobsHistoryEntry[];
};

export class JobsError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "JobsError";
  }
}

function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
}

function sanitizeBundle(input: Partial<RewardBundle> | null | undefined): RewardBundle {
  return {
    ducats: Number.isFinite(input?.ducats) ? Math.max(0, Math.floor(input?.ducats ?? 0)) : 0,
    ironOre: Number.isFinite(input?.ironOre) ? Math.max(0, Math.floor(input?.ironOre ?? 0)) : 0,
    charcoal: Number.isFinite(input?.charcoal) ? Math.max(0, Math.floor(input?.charcoal ?? 0)) : 0,
    supplyCrates: Number.isFinite(input?.supplyCrates) ? Math.max(0, Math.floor(input?.supplyCrates ?? 0)) : 0,
    seedBundles: Number.isFinite(input?.seedBundles) ? Math.max(0, Math.floor(input?.seedBundles ?? 0)) : 0,
    herbs: Number.isFinite(input?.herbs) ? Math.max(0, Math.floor(input?.herbs ?? 0)) : 0
  };
}

function sanitizeRuntimeRun(input: Partial<JobActiveRunRuntime> | null | undefined): JobActiveRunRuntime | null {
  if (!input || typeof input.jobId !== "string" || !(input.jobId in JOB_TEMPLATES_BY_ID)) {
    return null;
  }

  const jobId = input.jobId;

  return {
    runId: typeof input.runId === "string" ? input.runId : randomUUID(),
    jobId,
    jobName: typeof input.jobName === "string" ? input.jobName : JOB_TEMPLATES_BY_ID[jobId].name,
    durationHours: Math.max(1, Math.min(10, Math.floor(input.durationHours ?? 1))),
    startedAtMs: Number.isFinite(input.startedAtMs) ? Number(input.startedAtMs) : Date.now(),
    debugOffsetMs: Number.isFinite(input.debugOffsetMs) ? Math.max(0, Math.floor(input.debugOffsetMs ?? 0)) : 0,
    selectedFocusOptionIds: Array.isArray(input.selectedFocusOptionIds)
      ? input.selectedFocusOptionIds.filter(
          (optionId): optionId is string =>
            typeof optionId === "string" &&
            JOB_TEMPLATES_BY_ID[jobId].focusOptions.some((option) => option.id === optionId)
        )
      : [],
    levelRewardMultiplier:
      Number.isFinite(input.levelRewardMultiplier) && Number(input.levelRewardMultiplier) >= 1
        ? Number(input.levelRewardMultiplier)
        : 1,
    featuredRewardMultiplier:
      Number.isFinite(input.featuredRewardMultiplier) && Number(input.featuredRewardMultiplier) >= 1
        ? Number(input.featuredRewardMultiplier)
        : 1,
    featuredTitle: typeof input.featuredTitle === "string" ? input.featuredTitle : null
  };
}

function sanitizeHistory(input: unknown): JobsHistoryEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const nextEntry = entry as Partial<JobsHistoryEntry>;
    if (typeof nextEntry.jobId !== "string" || !(nextEntry.jobId in JOB_TEMPLATES_BY_ID)) {
      return [];
    }

    return [
      {
        runId: typeof nextEntry.runId === "string" ? nextEntry.runId : randomUUID(),
        jobId: nextEntry.jobId,
        jobName: typeof nextEntry.jobName === "string" ? nextEntry.jobName : JOB_TEMPLATES_BY_ID[nextEntry.jobId].name,
        durationHours: Math.max(1, Math.min(10, Math.floor(nextEntry.durationHours ?? 1))),
        claimType: nextEntry.claimType === "interrupted" ? "interrupted" : "completed",
        claimedAtMs: Number.isFinite(nextEntry.claimedAtMs) ? Number(nextEntry.claimedAtMs) : Date.now(),
        rewards: sanitizeBundle(nextEntry.rewards)
      }
    ];
  });
}

async function assertPlayerExists(prisma: JobsDbClient, playerId: string): Promise<{ id: string; level: number }> {
  const player = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: { id: true, level: true }
  });

  if (!player) {
    throw new JobsError("PLAYER_NOT_FOUND", 404, "Player not found.");
  }

  return player;
}

function defaultPersistedState(now: Date): PersistedJobsState {
  return {
    boardCycle: Math.floor(now.getTime() / JOB_BOARD_REFRESH_MS),
    boardNonce: 0,
    refreshesRemaining: JOBS_DAILY_REROLLS,
    refreshesResetAt: nextUtcMidnight(now).toISOString(),
    activeRun: null,
    stash: { ...EMPTY_BUNDLE },
    history: []
  };
}

function normalizePersistedState(input: unknown, now: Date): PersistedJobsState {
  const fallback = defaultPersistedState(now);

  if (!input || typeof input !== "object") {
    return fallback;
  }

  const payload = input as Partial<PersistedJobsState>;
  const currentCycle = Math.floor(now.getTime() / JOB_BOARD_REFRESH_MS);
  const resetAt = payload.refreshesResetAt ? new Date(payload.refreshesResetAt) : nextUtcMidnight(now);
  const shouldResetRerolls = Number.isNaN(resetAt.getTime()) || now >= resetAt;

  return {
    boardCycle:
      Number.isFinite(payload.boardCycle) && Number(payload.boardCycle) === currentCycle ? currentCycle : currentCycle,
    boardNonce:
      Number.isFinite(payload.boardCycle) && Number(payload.boardCycle) === currentCycle && Number.isFinite(payload.boardNonce)
        ? Math.max(0, Math.floor(payload.boardNonce ?? 0))
        : 0,
    refreshesRemaining: shouldResetRerolls
      ? JOBS_DAILY_REROLLS
      : Math.max(0, Math.min(JOBS_DAILY_REROLLS, Math.floor(payload.refreshesRemaining ?? JOBS_DAILY_REROLLS))),
    refreshesResetAt: shouldResetRerolls ? nextUtcMidnight(now).toISOString() : resetAt.toISOString(),
    activeRun: sanitizeRuntimeRun(payload.activeRun),
    stash: sanitizeBundle(payload.stash),
    history: sanitizeHistory(payload.history).slice(0, JOBS_HISTORY_LIMIT)
  };
}

async function loadJobsProgressRow(prisma: JobsDbClient, playerId: string) {
  return prisma.eventProgress.findFirst({
    where: {
      playerId,
      eventCode: JOBS_EVENT_CODE
    },
    orderBy: { createdAt: "asc" }
  });
}

async function savePersistedState(prisma: JobsDbClient, playerId: string, state: PersistedJobsState) {
  const row = await loadJobsProgressRow(prisma, playerId);
  const payload: Prisma.InputJsonValue = {
    boardCycle: state.boardCycle,
    boardNonce: state.boardNonce,
    refreshesRemaining: state.refreshesRemaining,
    refreshesResetAt: state.refreshesResetAt,
    activeRun: state.activeRun,
    stash: state.stash,
    history: state.history
  };

  if (row) {
    await prisma.eventProgress.update({
      where: { id: row.id },
      data: { payload }
    });
    return;
  }

  await prisma.eventProgress.create({
    data: {
      playerId,
      eventCode: JOBS_EVENT_CODE,
      payload
    }
  });
}

async function loadPersistedState(prisma: JobsDbClient, playerId: string, now: Date): Promise<PersistedJobsState> {
  const row = await loadJobsProgressRow(prisma, playerId);
  const normalized = normalizePersistedState(row?.payload, now);

  if (!row) {
    await savePersistedState(prisma, playerId, normalized);
  } else {
    const raw = row.payload as PersistedJobsState | null;
    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      await savePersistedState(prisma, playerId, normalized);
    }
  }

  return normalized;
}

function buildJobsStateResponse(now: Date, state: PersistedJobsState): JobsStateResponse {
  const boardState = buildJobBoardState(now.getTime(), state.boardNonce);

  return jobsStateResponseSchema.parse({
    serverTime: now.toISOString(),
    boardRefreshAt: new Date(boardState.refreshAtMs).toISOString(),
    boardEntries: boardState.entries.map((entry) => ({
      slotId: entry.slotId,
      template: entry.template,
      featuredWindow: entry.featuredWindow
        ? {
            ...entry.featuredWindow,
            startsAt: new Date(entry.featuredWindow.startsAtMs).toISOString(),
            endsAt: new Date(entry.featuredWindow.endsAtMs).toISOString()
          }
        : null
    })),
    refreshesRemaining: state.refreshesRemaining,
    refreshesResetAt: state.refreshesResetAt,
    activeRun: state.activeRun
      ? {
          ...state.activeRun,
          startedAt: new Date(state.activeRun.startedAtMs).toISOString(),
          releaseAt: new Date(buildRunReleaseAtMs(state.activeRun)).toISOString()
        }
      : null,
    stash: state.stash,
    history: state.history.map((entry) => ({
      ...entry,
      claimedAt: new Date(entry.claimedAtMs).toISOString()
    }))
  });
}

function assertBoardHasJob(state: PersistedJobsState, now: Date, jobId: string) {
  const boardState = buildJobBoardState(now.getTime(), state.boardNonce);
  if (!boardState.entries.some((entry) => entry.template.id === jobId)) {
    throw new JobsError("JOB_NOT_ON_BOARD", 409, "This job is no longer on the current board.");
  }
}

export async function assertJobsActivityIdle(prisma: JobsDbClient, playerId: string, now = new Date()): Promise<void> {
  const state = await loadPersistedState(prisma, playerId, now);
  if (!state.activeRun) {
    return;
  }

  if (buildRunReleaseAtMs(state.activeRun) > now.getTime()) {
    throw new JobsError("ACTIVITY_LOCKED", 409, JOBS_ACTIVITY_LOCKED_MESSAGE);
  }
}

export async function getJobsState(prisma: PrismaClient, playerId: string): Promise<JobsStateResponse> {
  const now = new Date();
  await assertPlayerExists(prisma, playerId);
  const state = await loadPersistedState(prisma, playerId, now);
  return buildJobsStateResponse(now, state);
}

export async function startJobsRun(
  prisma: PrismaClient,
  playerId: string,
  args: { jobId: string; durationHours: number }
): Promise<JobsMutationResponse> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const player = await assertPlayerExists(tx, playerId);
    const state = await loadPersistedState(tx, playerId, now);

    if (state.activeRun) {
      throw new JobsError("RUN_ALREADY_ACTIVE", 409, "A job run is already active.");
    }
    if (!(args.jobId in JOB_TEMPLATES_BY_ID)) {
      throw new JobsError("JOB_UNKNOWN", 400, "Unknown job selected.");
    }

    assertBoardHasJob(state, now, args.jobId);

    const boardState = buildJobBoardState(now.getTime(), state.boardNonce);
    const boardEntry = boardState.entries.find((entry) => entry.template.id === args.jobId);
    const template = JOB_TEMPLATES_BY_ID[args.jobId];
    state.activeRun = {
      runId: randomUUID(),
      jobId: template.id,
      jobName: template.name,
      durationHours: Math.max(1, Math.min(10, Math.floor(args.durationHours))),
      startedAtMs: now.getTime(),
      debugOffsetMs: 0,
      selectedFocusOptionIds: [],
      levelRewardMultiplier: getPlayerLevelRewardMultiplier(template, player.level),
      featuredRewardMultiplier: boardEntry?.featuredWindow?.rewardMultiplier ?? 1,
      featuredTitle: boardEntry?.featuredWindow?.title ?? null
    };

    await savePersistedState(tx, playerId, state);

    return jobsMutationResponseSchema.parse({
      jobs: buildJobsStateResponse(now, state),
      ducatsGranted: 0
    });
  });
}

export async function rerollJobsBoard(prisma: PrismaClient, playerId: string): Promise<JobsMutationResponse> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertPlayerExists(tx, playerId);
    const state = await loadPersistedState(tx, playerId, now);

    if (state.activeRun) {
      throw new JobsError("RUN_ALREADY_ACTIVE", 409, "Finish or interrupt the active run before rerolling.");
    }
    if (state.refreshesRemaining <= 0) {
      throw new JobsError("NO_REFRESHES_LEFT", 409, "No board refreshes remain until the next daily reset.");
    }

    state.boardNonce += 1;
    state.refreshesRemaining -= 1;
    await savePersistedState(tx, playerId, state);

    return jobsMutationResponseSchema.parse({
      jobs: buildJobsStateResponse(now, state),
      ducatsGranted: 0
    });
  });
}

export async function selectJobsBonus(
  prisma: PrismaClient,
  playerId: string,
  optionId: string
): Promise<JobsMutationResponse> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertPlayerExists(tx, playerId);
    const state = await loadPersistedState(tx, playerId, now);

    if (!state.activeRun) {
      throw new JobsError("RUN_MISSING", 409, "There is no active job run.");
    }

    const template = JOB_TEMPLATES_BY_ID[state.activeRun.jobId];
    if (!template.focusOptions.some((option) => option.id === optionId)) {
      throw new JobsError("BONUS_UNKNOWN", 400, "Unknown bonus option.");
    }

    if (state.activeRun.selectedFocusOptionIds.includes(optionId)) {
      throw new JobsError("BONUS_ALREADY_PICKED", 409, "That bonus has already been picked.");
    }

    const completedHours = getCompletedHours(state.activeRun, now.getTime());
    const unlockedCharges = getFocusUnlockHours(state.activeRun.durationHours).filter((hour) => completedHours >= hour).length;
    const availableCharges = Math.max(0, unlockedCharges - state.activeRun.selectedFocusOptionIds.length);
    if (availableCharges <= 0) {
      throw new JobsError("BONUS_LOCKED", 409, "No bonus picks are available yet.");
    }

    state.activeRun.selectedFocusOptionIds = [...state.activeRun.selectedFocusOptionIds, optionId];
    await savePersistedState(tx, playerId, state);

    return jobsMutationResponseSchema.parse({
      jobs: buildJobsStateResponse(now, state),
      ducatsGranted: 0
    });
  });
}

export async function claimJobsRun(
  prisma: PrismaClient,
  playerId: string,
  claimType: "completed" | "interrupted"
): Promise<JobsMutationResponse> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertPlayerExists(tx, playerId);
    const state = await loadPersistedState(tx, playerId, now);

    if (!state.activeRun) {
      throw new JobsError("RUN_MISSING", 409, "There is no active job run.");
    }

    const isComplete = getCompletedHours(state.activeRun, now.getTime()) >= state.activeRun.durationHours;
    if (claimType === "interrupted" && isComplete) {
      throw new JobsError("RUN_ALREADY_COMPLETE", 409, "This job is already complete. Claim the full rewards instead.");
    }
    if (claimType === "completed" && !isComplete) {
      throw new JobsError("RUN_NOT_COMPLETE", 409, "This job is not complete yet.");
    }

    const rewards = resolveRunRewards({
      run: state.activeRun,
      nowMs: now.getTime(),
      claimType
    });

    await tx.currencyBalance.upsert({
      where: { playerId },
      update: { ducats: { increment: rewards.ducats } },
      create: { playerId, ducats: rewards.ducats, imperials: 0, renown: 0 }
    });

    state.stash = addRewardBundles(state.stash, rewards);
    state.history = [
      {
        runId: state.activeRun.runId,
        jobId: state.activeRun.jobId,
        jobName: state.activeRun.jobName,
        durationHours: state.activeRun.durationHours,
        claimType,
        claimedAtMs: now.getTime(),
        rewards
      },
      ...state.history
    ].slice(0, JOBS_HISTORY_LIMIT);
    state.activeRun = null;

    await savePersistedState(tx, playerId, state);

    return jobsMutationResponseSchema.parse({
      jobs: buildJobsStateResponse(now, state),
      ducatsGranted: rewards.ducats
    });
  });
}

export async function advanceJobsDebug(
  prisma: PrismaClient,
  playerId: string,
  hours: number
): Promise<JobsMutationResponse> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertPlayerExists(tx, playerId);
    const state = await loadPersistedState(tx, playerId, now);

    if (!state.activeRun) {
      throw new JobsError("RUN_MISSING", 409, "There is no active job run.");
    }

    state.activeRun.debugOffsetMs += Math.max(1, Math.min(10, Math.floor(hours))) * HOUR_MS;
    await savePersistedState(tx, playerId, state);

    return jobsMutationResponseSchema.parse({
      jobs: buildJobsStateResponse(now, state),
      ducatsGranted: 0
    });
  });
}
