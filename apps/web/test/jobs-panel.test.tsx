import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JOB_TEMPLATES_BY_ID, type JobsStateResponse } from "@ebonkeep/shared/jobs";

import { __resetJobsPanelCacheForTests, JobsPanel } from "../src/features/jobs/JobsPanel";

const jobsApiMocks = vi.hoisted(() => ({
  fetchJobsState: vi.fn(),
  startJobsRunApi: vi.fn(),
  claimJobsRunApi: vi.fn(),
  selectJobsBonusApi: vi.fn(),
  rerollJobsBoardApi: vi.fn(),
  advanceJobsDebugApi: vi.fn()
}));
const jobsTestTemplateName = Object.values(JOB_TEMPLATES_BY_ID)[0]?.name ?? "Stonecutting Crew";

vi.mock("../src/features/jobs/api", () => ({
  fetchJobsState: jobsApiMocks.fetchJobsState,
  startJobsRunApi: jobsApiMocks.startJobsRunApi,
  claimJobsRunApi: jobsApiMocks.claimJobsRunApi,
  selectJobsBonusApi: jobsApiMocks.selectJobsBonusApi,
  rerollJobsBoardApi: jobsApiMocks.rerollJobsBoardApi,
  advanceJobsDebugApi: jobsApiMocks.advanceJobsDebugApi
}));

function createJobsState(): JobsStateResponse {
  const jobTemplates = Object.values(JOB_TEMPLATES_BY_ID).slice(0, 3);

  return {
    serverTime: "2026-03-21T09:00:00.000Z",
    boardRefreshAt: "2026-03-21T21:00:00.000Z",
    boardEntries: jobTemplates.map((template) => ({
      slotId: template.family,
      template,
      featuredWindow: null
    })),
    refreshesRemaining: 2,
    refreshesResetAt: "2026-03-22T09:00:00.000Z",
    activeRun: null,
    stash: {
      ducats: 0,
      ironOre: 0,
      charcoal: 0,
      supplyCrates: 0,
      seedBundles: 0,
      herbs: 0
    },
    history: []
  };
}

describe("jobs panel", () => {
  beforeEach(() => {
    __resetJobsPanelCacheForTests();
    jobsApiMocks.fetchJobsState.mockReset();
    jobsApiMocks.startJobsRunApi.mockReset();
    jobsApiMocks.claimJobsRunApi.mockReset();
    jobsApiMocks.selectJobsBonusApi.mockReset();
    jobsApiMocks.rerollJobsBoardApi.mockReset();
    jobsApiMocks.advanceJobsDebugApi.mockReset();
  });

  it("reuses the warm jobs response on remount without flashing the loading state", async () => {
    jobsApiMocks.fetchJobsState
      .mockResolvedValueOnce(createJobsState())
      .mockImplementationOnce(() => new Promise(() => {}));

    const firstRender = render(
      <JobsPanel
        token="token"
        hasPlayerState
        currentDucats={0}
        playerLevel={1}
        developerToolsEnabled={false}
        onGrantDucats={() => {}}
        onLockReleaseAtChange={() => {}}
      />
    );

    expect((await screen.findAllByText(jobsTestTemplateName)).length).toBeGreaterThan(0);

    firstRender.unmount();

    render(
      <JobsPanel
        token="token"
        hasPlayerState
        currentDucats={0}
        playerLevel={1}
        developerToolsEnabled={false}
        onGrantDucats={() => {}}
        onLockReleaseAtChange={() => {}}
      />
    );

    expect(screen.queryByText("Loading jobs...")).toBeNull();
    expect(screen.getAllByText(jobsTestTemplateName).length).toBeGreaterThan(0);
  });
});
