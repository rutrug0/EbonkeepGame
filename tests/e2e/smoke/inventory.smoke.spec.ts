import { expect, test } from "@playwright/test";

test("inventory double-click equips an item @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("menu-inventory")).toBeVisible();

  const equippedBefore = await page.locator('[data-testid^="equipment-slot-"].hasItem').count();
  const firstInventoryCard = page.locator('[data-testid^="inventory-card-"]').first();
  await expect(firstInventoryCard).toBeVisible();
  await firstInventoryCard.dblclick();

  await expect(async () => {
    const equippedAfter = await page.locator('[data-testid^="equipment-slot-"].hasItem').count();
    expect(equippedAfter).toBeGreaterThanOrEqual(equippedBefore + 1);
  }).toPass();
});
