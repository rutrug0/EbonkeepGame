import { expect, test } from "@playwright/test";

import { createAuthedPage } from "../utils/auth";

const apiBaseUrl = process.env.VITE_API_URL ?? `http://127.0.0.1:${process.env.TEST_API_PORT ?? "4010"}`;

test("guild invite lifecycle works across two players @nightly", async ({ browser, request }) => {
  const leader = await createAuthedPage(browser, request, "guild-leader");
  const recruit = await createAuthedPage(browser, request, "guild-recruit");

  try {
    const createGuildResponse = await request.post(`${apiBaseUrl}/v1/guild`, {
      headers: { Authorization: `Bearer ${leader.login.accessToken}` },
      data: {
        name: "Night Watch",
        tag: "NITE",
        crestId: "crest_0"
      }
    });
    expect(createGuildResponse.ok()).toBeTruthy();
    const guild = await createGuildResponse.json();

    const inviteResponse = await request.post(`${apiBaseUrl}/v1/guild/${guild.guild.id}/invites`, {
      headers: { Authorization: `Bearer ${leader.login.accessToken}` },
      data: {
        inviteeId: recruit.login.playerId
      }
    });
    expect(inviteResponse.ok()).toBeTruthy();

    await recruit.page.goto("/");
    await recruit.page.getByTestId("menu-group-realm").click();
    await recruit.page.getByTestId("menu-guild").click();
    await expect(recruit.page.getByRole("button", { name: /Accept/i }).first()).toBeVisible();
    await recruit.page.getByRole("button", { name: /Accept/i }).first().click();

    await leader.page.goto("/");
    await leader.page.getByTestId("menu-group-realm").click();
    await leader.page.getByTestId("menu-guild").click();
    await expect(leader.page.getByText(/Night Watch/)).toBeVisible();
    await expect(leader.page.getByText(/Members/i)).toBeVisible();
  } finally {
    await leader.context.close();
    await recruit.context.close();
  }
});
