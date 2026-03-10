import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("guest login bootstrap works @smoke", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("guest-login-button").click();
  await expect(page.getByTestId("menu-inventory")).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await expect(page.locator(".playerCardCurrencyValue.ducats")).toBeVisible();
});
