import { expect, test } from "@playwright/test";

test("leaderboard page loads and filters @smoke", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("menu-group-profile").click();
  await page.getByTestId("menu-leaderboards").click();

  await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible();
  await page.getByRole("button", { name: /Dexterity/i }).click();
  await expect(page.getByText(/viewing top/i)).toBeVisible();
});
