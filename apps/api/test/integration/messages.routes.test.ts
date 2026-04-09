import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authHeaders, loginAsGuest, registerUser } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";
import { createSystemRewardMessage } from "../../src/modules/messages/service.js";

async function createGuild(context: Awaited<ReturnType<typeof createApiTestContext>>, token: string, name: string, tag: string) {
  const response = await context.app.inject({
    method: "POST",
    url: "/v1/guild",
    headers: authHeaders(token),
    payload: {
      name,
      tag,
      description: `${name} description`,
      crestId: "crest_0"
    }
  });

  expect(response.statusCode).toBe(201);
  return response.json().guild.id as string;
}

async function inviteIntoGuild(
  context: Awaited<ReturnType<typeof createApiTestContext>>,
  guildId: string,
  leaderToken: string,
  inviteeId: string,
  inviteeToken: string
) {
  const inviteResponse = await context.app.inject({
    method: "POST",
    url: `/v1/guild/${guildId}/invites`,
    headers: authHeaders(leaderToken),
    payload: { inviteeId }
  });
  expect(inviteResponse.statusCode).toBe(201);

  const receivedInvites = await context.app.inject({
    method: "GET",
    url: "/v1/guild/invites/received",
    headers: authHeaders(inviteeToken)
  });
  expect(receivedInvites.statusCode).toBe(200);

  const inviteId = receivedInvites.json().invites[0]?.id as string | undefined;
  expect(inviteId).toBeTruthy();

  const acceptResponse = await context.app.inject({
    method: "POST",
    url: `/v1/guild/invites/${inviteId}/accept`,
    headers: authHeaders(inviteeToken)
  });
  expect(acceptResponse.statusCode).toBe(200);
}

describe("messages routes", () => {
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

  it("delivers direct mail to the target inbox and clears unread state when read", async () => {
    const sender = await registerUser(context.app, { username: "sender_mail" });
    const recipient = await registerUser(context.app, { username: "recipient_mail" });

    const sendResponse = await context.app.inject({
      method: "POST",
      url: "/v1/messages/direct",
      headers: authHeaders(sender.body.accessToken),
      payload: {
        recipient: recipient.payload.username,
        subject: "Quartermaster notice",
        body: "Supplies are waiting at the keep."
      }
    });

    expect(sendResponse.statusCode).toBe(200);
    expect(sendResponse.json().message.kind).toBe("direct");

    const unreadBeforeRead = await context.app.inject({
      method: "GET",
      url: "/v1/messages/unread-count",
      headers: authHeaders(recipient.body.accessToken)
    });
    expect(unreadBeforeRead.statusCode).toBe(200);
    expect(unreadBeforeRead.json().unreadCount).toBe(1);

    const inboxResponse = await context.app.inject({
      method: "GET",
      url: "/v1/messages",
      headers: authHeaders(recipient.body.accessToken)
    });
    expect(inboxResponse.statusCode).toBe(200);
    expect(inboxResponse.json().entries).toHaveLength(1);

    const messageId = inboxResponse.json().entries[0]?.messageId as string;
    expect(messageId).toBeTruthy();

    const detailResponse = await context.app.inject({
      method: "GET",
      url: `/v1/messages/${messageId}`,
      headers: authHeaders(recipient.body.accessToken)
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().subject).toBe("Quartermaster notice");
    expect(detailResponse.json().readAt).toBeNull();

    const readResponse = await context.app.inject({
      method: "POST",
      url: `/v1/messages/${messageId}/read`,
      headers: authHeaders(recipient.body.accessToken),
      payload: {}
    });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json().message.readAt).toBeTruthy();
    expect(readResponse.json().unreadCount).toBe(0);
  });

  it("allows guild broadcasts only for guild leaders and officers", async () => {
    const leader = await loginAsGuest(context.app, { guestId: "mail-leader" });
    const recruit = await loginAsGuest(context.app, { guestId: "mail-recruit" });
    const guildId = await createGuild(context, leader.body.accessToken, "Mail Watch", "MLW");

    await inviteIntoGuild(
      context,
      guildId,
      leader.body.accessToken,
      recruit.body.playerId,
      recruit.body.accessToken
    );

    const deniedResponse = await context.app.inject({
      method: "POST",
      url: "/v1/messages/guild",
      headers: authHeaders(recruit.body.accessToken),
      payload: {
        subject: "Unauthorized order",
        body: "This should fail."
      }
    });
    expect(deniedResponse.statusCode).toBe(403);

    const sendResponse = await context.app.inject({
      method: "POST",
      url: "/v1/messages/guild",
      headers: authHeaders(leader.body.accessToken),
      payload: {
        subject: "Raid muster",
        body: "Assemble in the war room before dusk."
      }
    });
    expect(sendResponse.statusCode).toBe(200);
    expect(sendResponse.json().message.kind).toBe("guild_broadcast");

    const recruitInbox = await context.app.inject({
      method: "GET",
      url: "/v1/messages",
      headers: authHeaders(recruit.body.accessToken)
    });
    expect(recruitInbox.statusCode).toBe(200);
    expect(recruitInbox.json().entries.some((entry: { subject: string; kind: string }) =>
      entry.subject === "Raid muster" && entry.kind === "guild_broadcast"
    )).toBe(true);
  });

  it("deletes reward mail after claim", async () => {
    const recipient = await registerUser(context.app, { username: "reward_mail_recipient" });

    await createSystemRewardMessage(context.prisma, {
      recipients: [recipient.body.playerId],
      subject: "Contract complete",
      body: "Rewards are ready to claim.",
      sourceType: "contracts",
      sourceRefId: "contract-run-1",
      rewards: {
        experience: 0,
        ducats: 75,
        imperials: 0,
        renown: 0,
        items: []
      }
    });

    const inboxBeforeClaim = await context.app.inject({
      method: "GET",
      url: "/v1/messages",
      headers: authHeaders(recipient.body.accessToken)
    });

    expect(inboxBeforeClaim.statusCode).toBe(200);
    expect(inboxBeforeClaim.json().entries).toHaveLength(1);

    const messageId = inboxBeforeClaim.json().entries[0]?.messageId as string;
    expect(messageId).toBeTruthy();

    const claimResponse = await context.app.inject({
      method: "POST",
      url: `/v1/messages/${messageId}/claim`,
      headers: authHeaders(recipient.body.accessToken),
      payload: {}
    });

    expect(claimResponse.statusCode).toBe(200);
    expect(claimResponse.json().message).toBeNull();
    expect(claimResponse.json().deletedMessageId).toBe(messageId);
    expect(claimResponse.json().unreadCount).toBe(0);

    const inboxAfterClaim = await context.app.inject({
      method: "GET",
      url: "/v1/messages",
      headers: authHeaders(recipient.body.accessToken)
    });

    expect(inboxAfterClaim.statusCode).toBe(200);
    expect(inboxAfterClaim.json().entries).toHaveLength(0);
  });
});
