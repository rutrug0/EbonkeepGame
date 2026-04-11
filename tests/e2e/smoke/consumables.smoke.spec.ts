import { expect, test } from "@playwright/test";

import { loginGuestViaApi } from "../utils/auth";
import { seedConsumableInventoryItem } from "../utils/db";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_URL ??
  `http://127.0.0.1:${process.env.TEST_API_PORT ?? "4010"}`;

test("dragging a consumable onto portrait consumes stack and activates effect @smoke", async ({ page, request }) => {
  const guestId = `smoke-consume-${Date.now()}`;
  const login = await loginGuestViaApi(request, guestId);

  const seededConsumable = await seedConsumableInventoryItem(login.playerId, "consumable_wardens_tonic", 2);

  await page.goto("/");
  await page.evaluate((token) => {
    window.localStorage.setItem("ebonkeep.dev.token", token);
  }, login.accessToken);
  await page.reload();
  await expect(page.getByTestId("menu-inventory")).toBeVisible();

  await page.getByTestId("menu-inventory").click();
  await page.getByRole("button", { name: /consumables/i }).click();

  const consumableCard = page.getByTestId(`inventory-card-${seededConsumable.id}`);
  await expect(consumableCard).toBeVisible();

  const portraitDropTarget = page.getByTestId("character-portrait-drop-target");
  await expect(portraitDropTarget).toBeVisible();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await consumableCard.dispatchEvent("dragstart", { dataTransfer });
  await portraitDropTarget.dispatchEvent("dragenter", { dataTransfer });
  await portraitDropTarget.dispatchEvent("dragover", { dataTransfer });
  await portraitDropTarget.dispatchEvent("drop", { dataTransfer });
  await consumableCard.dispatchEvent("dragend", { dataTransfer });

  const activeConsumableCells = page.locator(".activeConsumableCell");
  await expect(activeConsumableCells).toHaveCount(1);

  await activeConsumableCells.first().hover();
  await expect(page.locator(".activeConsumableTooltipHeader h4")).toContainText([seededConsumable.displayName]);

  const stateResponse = await request.get(`${apiBaseUrl}/v1/player/state`, {
    headers: {
      Authorization: `Bearer ${login.accessToken}`
    }
  });
  expect(stateResponse.ok()).toBeTruthy();

  const stateBody = await stateResponse.json();
  const consumedInventoryEntry = (stateBody.inventory as Array<{ id: string; quantity?: number }>).find(
    (item) => item.id === seededConsumable.id
  );
  expect(consumedInventoryEntry?.quantity).toBe(1);
  expect(
    (stateBody.activeConsumables as Array<{ itemCode: string }>).some(
      (activeConsumable) => activeConsumable.itemCode === seededConsumable.itemCode
    )
  ).toBeTruthy();
});
