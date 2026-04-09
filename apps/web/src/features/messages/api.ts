import {
  mailboxInboxResponseSchema,
  mailboxMessageDetailSchema,
  mailboxMessageMutationResponseSchema,
  mailboxReplayResponseSchema,
  mailboxUnreadCountResponseSchema,
  sendDirectMailboxMessageBodySchema,
  sendGuildMailboxMessageBodySchema,
  type MailboxInboxResponse,
  type MailboxMessageDetail,
  type MailboxMessageMutationResponse,
  type MailboxReplayResponse,
  type MailboxUnreadCountResponse,
  type SendDirectMailboxMessageBody,
  type SendGuildMailboxMessageBody
} from "@ebonkeep/shared/messages";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchMailbox(token: string): Promise<MailboxInboxResponse> {
  const response = await fetch(`${API_URL}/v1/messages`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Mailbox load failed"));
  }

  return mailboxInboxResponseSchema.parse(await response.json());
}

export async function fetchMailboxUnreadCount(token: string): Promise<MailboxUnreadCountResponse> {
  const response = await fetch(`${API_URL}/v1/messages/unread-count`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Mailbox unread count failed"));
  }

  return mailboxUnreadCountResponseSchema.parse(await response.json());
}

export async function fetchMailboxMessage(token: string, messageId: string): Promise<MailboxMessageDetail> {
  const response = await fetch(`${API_URL}/v1/messages/${messageId}`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Mailbox message failed"));
  }

  return mailboxMessageDetailSchema.parse(await response.json());
}

async function postMailboxMutation<TBody>(
  token: string,
  path: string,
  body: TBody
): Promise<MailboxMessageMutationResponse> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Mailbox action failed"));
  }

  return mailboxMessageMutationResponseSchema.parse(await response.json());
}

export function markMailboxMessageRead(token: string, messageId: string): Promise<MailboxMessageMutationResponse> {
  return postMailboxMutation(token, `/v1/messages/${messageId}/read`, {});
}

export function claimMailboxMessage(token: string, messageId: string): Promise<MailboxMessageMutationResponse> {
  return postMailboxMutation(token, `/v1/messages/${messageId}/claim`, {});
}

export function sendDirectMailboxMessage(
  token: string,
  body: SendDirectMailboxMessageBody
): Promise<MailboxMessageMutationResponse> {
  return postMailboxMutation(token, "/v1/messages/direct", sendDirectMailboxMessageBodySchema.parse(body));
}

export function sendGuildMailboxMessage(
  token: string,
  body: SendGuildMailboxMessageBody
): Promise<MailboxMessageMutationResponse> {
  return postMailboxMutation(token, "/v1/messages/guild", sendGuildMailboxMessageBodySchema.parse(body));
}

export async function fetchMailboxReplay(token: string, messageId: string): Promise<MailboxReplayResponse> {
  const response = await fetch(`${API_URL}/v1/messages/${messageId}/replay`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Mailbox replay failed"));
  }

  return mailboxReplayResponseSchema.parse(await response.json());
}
