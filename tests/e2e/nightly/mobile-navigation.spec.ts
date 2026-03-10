import { expect, test } from "@playwright/test";

test("mobile viewport can navigate key panels @nightly @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("menu-inventory")).toBeVisible();

  await page.getByTestId("menu-merchant").click();
  await expect(page.getByText(/Merchant Inventory/i)).toBeVisible();

  await page.getByTestId("menu-leaderboards").click();
  await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible();
});
