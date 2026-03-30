import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authHeaders, loginAsGuest, registerUser } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

async function startFirstBoardJob(context: Awaited<ReturnType<typeof createApiTestContext>>, headers: Record<string, string>, durationHours = 5) {
  const jobsStateResponse = await context.app.inject({
    method: "GET",
    url: "/v1/jobs/state",
    headers
  });

  expect(jobsStateResponse.statusCode).toBe(200);
  const firstJobId = jobsStateResponse.json().boardEntries[0]?.template.id as string | undefined;
  expect(firstJobId).toBeTruthy();

  const startResponse = await context.app.inject({
    method: "POST",
    url: "/v1/jobs/start",
    headers,
    payload: {
      jobId: firstJobId,
      durationHours
    }
  });

  expect(startResponse.statusCode).toBe(200);
  return startResponse;
}

describe("jobs routes", () => {
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

  it("allows debug fast-forward for all authenticated accounts", async () => {
    const guest = await loginAsGuest(context.app);
    const guestHeaders = authHeaders(guest.body.accessToken);
    await startFirstBoardJob(context, guestHeaders, 3);

    const developerAdvance = await context.app.inject({
      method: "POST",
      url: "/v1/jobs/debug/advance",
      headers: guestHeaders,
      payload: { hours: 1 }
    });

    expect(developerAdvance.statusCode).toBe(200);
    expect(developerAdvance.json().jobs.activeRun.debugOffsetMs).toBeGreaterThanOrEqual(60 * 60 * 1000);

    const registered = await registerUser(context.app);
    const registeredHeaders = authHeaders(registered.body.accessToken);
    await startFirstBoardJob(context, registeredHeaders, 3);

    const registeredAdvance = await context.app.inject({
      method: "POST",
      url: "/v1/jobs/debug/advance",
      headers: registeredHeaders,
      payload: { hours: 1 }
    });

    expect(registeredAdvance.statusCode).toBe(200);
    expect(registeredAdvance.json().jobs.activeRun.debugOffsetMs).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  it("blocks other timed activity starts while a jobs run is still active", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);
    await startFirstBoardJob(context, headers, 5);

    const contractsBoard = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(contractsBoard.statusCode).toBe(200);
    const availableContractSlot = contractsBoard.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableContractSlot).toBeTruthy();

    const blockedContractStart = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableContractSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(blockedContractStart.statusCode).toBe(409);
    expect(blockedContractStart.json().error).toContain("active job");

    const blockedArenaFind = await context.app.inject({
      method: "POST",
      url: "/v1/arena/find-opponents",
      headers,
      payload: {}
    });
    expect(blockedArenaFind.statusCode).toBe(409);
    expect(blockedArenaFind.json().error).toContain("active job");

    const blockedGardenPlant = await context.app.inject({
      method: "POST",
      url: "/v1/garden/slots/1/plant",
      headers,
      payload: { plantId: "bloodleaf" }
    });
    expect(blockedGardenPlant.statusCode).toBe(409);
    expect(blockedGardenPlant.json().error).toContain("active job");
  });

  it("allows other timed activity starts again once the jobs timer has fully completed", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);
    await startFirstBoardJob(context, headers, 3);

    const advanceToCompletion = await context.app.inject({
      method: "POST",
      url: "/v1/jobs/debug/advance",
      headers,
      payload: { hours: 3 }
    });
    expect(advanceToCompletion.statusCode).toBe(200);

    const contractsBoard = await context.app.inject({
      method: "GET",
      url: "/v1/contracts/board",
      headers
    });
    expect(contractsBoard.statusCode).toBe(200);
    const availableContractSlot = contractsBoard.json().slots.find((slot: { state: string }) => slot.state === "available");
    expect(availableContractSlot).toBeTruthy();

    const contractStart = await context.app.inject({
      method: "POST",
      url: `/v1/contracts/slots/${availableContractSlot.slotId}/start`,
      headers,
      payload: {}
    });
    expect(contractStart.statusCode).toBe(200);
  });

  it("rejects interrupted claims after the run has already completed", async () => {
    const guest = await loginAsGuest(context.app);
    const headers = authHeaders(guest.body.accessToken);
    await startFirstBoardJob(context, headers, 3);

    const advanceToCompletion = await context.app.inject({
      method: "POST",
      url: "/v1/jobs/debug/advance",
      headers,
      payload: { hours: 3 }
    });
    expect(advanceToCompletion.statusCode).toBe(200);

    const interruptedClaim = await context.app.inject({
      method: "POST",
      url: "/v1/jobs/claim",
      headers,
      payload: { claimType: "interrupted" }
    });
    expect(interruptedClaim.statusCode).toBe(409);
    expect(interruptedClaim.json().error).toContain("already complete");

    const completedClaim = await context.app.inject({
      method: "POST",
      url: "/v1/jobs/claim",
      headers,
      payload: { claimType: "completed" }
    });
    expect(completedClaim.statusCode).toBe(200);
  });
});
