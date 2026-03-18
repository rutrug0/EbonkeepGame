import { expect, test } from "@playwright/test";

test("contract travel and combat playback render @smoke", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("menu-group-adventures").click();
  await page.getByTestId("menu-contracts").click();

  const firstContract = page.locator('[data-testid^="contract-row-"]').first();
  await expect(firstContract).toBeVisible();
  await firstContract.click();

  await expect(page.locator(".contractsCombatViewportMainStack")).toBeVisible({ timeout: 30_000 });
});
