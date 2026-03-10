import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { loginGuestViaApi } from "../utils/auth";

const authFile = path.resolve("tests/e2e/.auth/guest.json");

test("create reusable guest auth state", async ({ page, request }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const login = await loginGuestViaApi(request, "playwright-guest");

  await page.goto("/");
  await page.evaluate((token) => {
    window.localStorage.setItem("ebonkeep.dev.token", token);
  }, login.accessToken);
  await page.reload();

  await expect(page.getByTestId("menu-inventory")).toBeVisible();
  await page.context().storageState({ path: authFile });
});
