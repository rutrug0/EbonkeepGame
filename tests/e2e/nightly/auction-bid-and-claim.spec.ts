import { expect, test } from "@playwright/test";

import { seedPendingAuctionReward, seedPlayableAuction } from "../utils/db";

test("auction bid and reward claim flows work @nightly", async ({ page, request }) => {
  const loginResponse = await request.post(`${process.env.VITE_API_URL ?? `http://127.0.0.1:${process.env.TEST_API_PORT ?? "4010"}`}/v1/dev/guest-login`, {
    data: {
      guestId: "auction-nightly"
    }
  });
  const login = await loginResponse.json();

  await seedPlayableAuction(login.playerId);
  await seedPendingAuctionReward(
    login.playerId,
    JSON.stringify({
      id: "reward_item",
      itemCode: "reward_blade",
      itemName: "Reward Blade",
      rarity: "epic",
      category: "weapon",
      equipable: true,
      levelRequirement: 1,
      allowedSlotIds: ["weapon"],
      baseLevel: 1,
      power: 80,
      archetype: {
        majorCategory: "weapon",
        weaponArchetype: "melee",
        weaponFamily: "sword"
      },
      statBonuses: {
        damage: 20
      },
      description: "Playwright reward."
    })
  );

  await page.goto("/");
  await page.evaluate((token) => {
    window.localStorage.setItem("ebonkeep.dev.token", token);
  }, login.accessToken);
  await page.reload();

  await page.getByTestId("menu-auctionHouse").click();
  await expect(page.getByText(/Playwright Blade/)).toBeVisible();
  await page.locator('input[type="number"]').first().fill("100");
  await page.getByRole("button", { name: /Place Bid/i }).first().click();
  await page.getByRole("button", { name: /Confirm/i }).first().click();

  await page.getByRole("button", { name: /Rewards/i }).click();
  await expect(page.getByText(/Reward Blade/)).toBeVisible();
  await page.getByRole("button", { name: /Claim/i }).first().click();
  await expect(page.getByText(/Reward Blade/)).not.toBeVisible();
});
