import { expect, test } from "@playwright/test";

test("merchant buy and sell flow works @smoke", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("menu-merchant").click();

  const merchantOffer = page.locator('[data-testid^="merchant-offer-"]').first();
  await expect(merchantOffer).toBeVisible();
  await merchantOffer.dblclick();

  const sellCard = page.locator('[data-testid^="merchant-player-item-"]').first();
  await expect(sellCard).toBeVisible();
  await sellCard.dblclick();

  await expect(page.getByText(/Merchant Inventory/i)).toBeVisible();
});
