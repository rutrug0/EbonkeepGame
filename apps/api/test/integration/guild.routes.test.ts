import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getConsumableDefinition } from "@ebonkeep/shared/consumables";

import { authHeaders, loginAsGuest } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("guild routes", () => {
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

  it("handles guild creation, invites, membership, roles, leadership transfer, and disband", async () => {
    const leader = await loginAsGuest(context.app, { guestId: "leader-1" });
    const recruit = await loginAsGuest(context.app, { guestId: "recruit-1" });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/v1/guild",
      headers: authHeaders(leader.body.accessToken),
      payload: {
        name: "Ashen Guard",
        tag: "ASH",
        description: "Core guild",
        crestId: "crest_0"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const guildId = createResponse.json().guild.id as string;

    const searchResponse = await context.app.inject({
      method: "GET",
      url: "/v1/guild/search?name=Ashen"
    });
    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().guilds).toHaveLength(1);

    const memberUpdateAttempt = await context.app.inject({
      method: "PATCH",
      url: `/v1/guild/${guildId}`,
      headers: authHeaders(recruit.body.accessToken),
      payload: {
        description: "Should fail"
      }
    });
    expect(memberUpdateAttempt.statusCode).toBe(403);

    const sendInviteResponse = await context.app.inject({
      method: "POST",
      url: `/v1/guild/${guildId}/invites`,
      headers: authHeaders(leader.body.accessToken),
      payload: {
        inviteeId: recruit.body.playerId
      }
    });
    expect(sendInviteResponse.statusCode).toBe(201);

    const receivedInvites = await context.app.inject({
      method: "GET",
      url: "/v1/guild/invites/received",
      headers: authHeaders(recruit.body.accessToken)
    });
    expect(receivedInvites.statusCode).toBe(200);
    const inviteId = receivedInvites.json().invites[0].id as string;

    const acceptResponse = await context.app.inject({
      method: "POST",
      url: `/v1/guild/invites/${inviteId}/accept`,
      headers: authHeaders(recruit.body.accessToken)
    });
    expect(acceptResponse.statusCode).toBe(200);

    const updateGuildResponse = await context.app.inject({
      method: "PATCH",
      url: `/v1/guild/${guildId}`,
      headers: authHeaders(leader.body.accessToken),
      payload: {
        description: "Updated description",
        isRecruiting: false
      }
    });
    expect(updateGuildResponse.statusCode).toBe(200);
    expect(updateGuildResponse.json().description).toBe("Updated description");

    const membersResponse = await context.app.inject({
      method: "GET",
      url: `/v1/guild/${guildId}/members`,
      headers: authHeaders(leader.body.accessToken)
    });
    expect(membersResponse.statusCode).toBe(200);
    expect(membersResponse.json().members).toHaveLength(2);

    const activityResponse = await context.app.inject({
      method: "GET",
      url: `/v1/guild/${guildId}/activity`,
      headers: authHeaders(leader.body.accessToken)
    });
    expect(activityResponse.statusCode).toBe(200);
    expect(activityResponse.json().activities.length).toBeGreaterThanOrEqual(2);

    const promoteResponse = await context.app.inject({
      method: "PATCH",
      url: `/v1/guild/${guildId}/members/${recruit.body.playerId}/role`,
      headers: authHeaders(leader.body.accessToken),
      payload: {
        role: "officer"
      }
    });
    expect(promoteResponse.statusCode).toBe(200);

    const transferResponse = await context.app.inject({
      method: "POST",
      url: `/v1/guild/${guildId}/transfer-leadership`,
      headers: authHeaders(leader.body.accessToken),
      payload: {
        newLeaderId: recruit.body.playerId
      }
    });
    expect(transferResponse.statusCode).toBe(200);

    const leaveResponse = await context.app.inject({
      method: "POST",
      url: `/v1/guild/${guildId}/leave`,
      headers: authHeaders(leader.body.accessToken)
    });
    expect(leaveResponse.statusCode).toBe(200);

    const disbandResponse = await context.app.inject({
      method: "DELETE",
      url: `/v1/guild/${guildId}/disband`,
      headers: authHeaders(recruit.body.accessToken)
    });
    expect(disbandResponse.statusCode).toBe(200);
  });

  it("sorts guild leaderboards by power", async () => {
    const leaderOne = await loginAsGuest(context.app, { guestId: "guild-power-1" });
    const leaderTwo = await loginAsGuest(context.app, { guestId: "guild-power-2" });

    await context.prisma.playerProfile.update({
      where: { id: leaderOne.body.playerId },
      data: {
        gearScore: 150
      }
    });
    await context.prisma.playerProfile.update({
      where: { id: leaderTwo.body.playerId },
      data: {
        gearScore: 320
      }
    });

    await context.app.inject({
      method: "POST",
      url: "/v1/guild",
      headers: authHeaders(leaderOne.body.accessToken),
      payload: {
        name: "Iron Watch",
        tag: "IRN",
        crestId: "crest_0"
      }
    });
    await context.app.inject({
      method: "POST",
      url: "/v1/guild",
      headers: authHeaders(leaderTwo.body.accessToken),
      payload: {
        name: "Gilded Watch",
        tag: "GLD",
        crestId: "crest_0"
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/v1/guild/leaderboards?sortBy=power"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().guilds[0].guild.name).toBe("Gilded Watch");
  });

  it("decrements encounter-based consumables for raid participants on resolution", async () => {
    const leader = await loginAsGuest(context.app, { guestId: "raid-leader-1" });
    const raiderOne = await loginAsGuest(context.app, { guestId: "raid-raider-1" });
    const raiderTwo = await loginAsGuest(context.app, { guestId: "raid-raider-2" });

    const createGuildResponse = await context.app.inject({
      method: "POST",
      url: "/v1/guild",
      headers: authHeaders(leader.body.accessToken),
      payload: {
        name: "Raid Watch",
        tag: "RWD",
        crestId: "crest_0"
      }
    });
    expect(createGuildResponse.statusCode).toBe(201);
    const guildId = createGuildResponse.json().guild.id as string;

    for (const recruit of [raiderOne, raiderTwo]) {
      const inviteResponse = await context.app.inject({
        method: "POST",
        url: `/v1/guild/${guildId}/invites`,
        headers: authHeaders(leader.body.accessToken),
        payload: { inviteeId: recruit.body.playerId }
      });
      expect(inviteResponse.statusCode).toBe(201);

      const receivedInvites = await context.app.inject({
        method: "GET",
        url: "/v1/guild/invites/received",
        headers: authHeaders(recruit.body.accessToken)
      });
      expect(receivedInvites.statusCode).toBe(200);
      const inviteId = receivedInvites.json().invites[0].id as string;

      const acceptResponse = await context.app.inject({
        method: "POST",
        url: `/v1/guild/invites/${inviteId}/accept`,
        headers: authHeaders(recruit.body.accessToken)
      });
      expect(acceptResponse.statusCode).toBe(200);
    }

    const tonicDefinition = getConsumableDefinition("consumable_wardens_tonic");
    expect(tonicDefinition).toBeTruthy();

    for (const participant of [leader, raiderOne, raiderTwo]) {
      await context.prisma.playerActiveConsumable.create({
        data: {
          playerId: participant.body.playerId,
          itemCode: tonicDefinition!.itemCode,
          consumableType: tonicDefinition!.type,
          consumableFamily: tonicDefinition!.family,
          effects: tonicDefinition!.effects,
          appliedAt: new Date(),
          remainingEncounters: 2,
          originalDurationKind: tonicDefinition!.durationKind,
          originalDurationValue: tonicDefinition!.durationValue
        }
      });
    }

    const summonResponse = await context.app.inject({
      method: "POST",
      url: `/v1/guild/${guildId}/raids/summon`,
      headers: authHeaders(leader.body.accessToken),
      payload: {}
    });
    expect(summonResponse.statusCode).toBe(200);

    for (const participant of [leader, raiderOne, raiderTwo]) {
      const joinResponse = await context.app.inject({
        method: "POST",
        url: `/v1/guild/${guildId}/raids/join`,
        headers: authHeaders(participant.body.accessToken),
        payload: {}
      });
      expect(joinResponse.statusCode).toBe(200);
    }

    const commenceResponse = await context.app.inject({
      method: "POST",
      url: `/v1/guild/${guildId}/raids/commence`,
      headers: authHeaders(leader.body.accessToken),
      payload: {}
    });
    expect(commenceResponse.statusCode).toBe(200);

    for (const participant of [leader, raiderOne, raiderTwo]) {
      const activeConsumable = await context.prisma.playerActiveConsumable.findFirst({
        where: { playerId: participant.body.playerId }
      });
      expect(activeConsumable).not.toBeNull();
      expect(activeConsumable?.remainingEncounters).toBe(1);
    }
  });
});
