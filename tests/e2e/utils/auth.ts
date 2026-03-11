import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_URL ??
  `http://127.0.0.1:${process.env.TEST_API_PORT ?? "4010"}`;

export async function loginGuestViaApi(request: APIRequestContext, guestId: string, playerClass: "warrior" | "mage" | "ranger" = "warrior") {
  const response = await request.post(`${apiBaseUrl}/v1/dev/guest-login`, {
    data: {
      guestId,
      class: playerClass
    }
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ accessToken: string; playerId: string; accountId: string }>;
}

export async function loginGuestIntoPage(
  page: Page,
  request: APIRequestContext,
  guestId: string,
  playerClass: "warrior" | "mage" | "ranger" = "warrior"
) {
  const login = await loginGuestViaApi(request, guestId, playerClass);
  await page.goto("/");
  await page.evaluate((token) => {
    window.localStorage.setItem("ebonkeep.dev.token", token);
  }, login.accessToken);
  await page.reload();
  await expect(page.getByTestId("menu-inventory")).toBeVisible();
  return login;
}

export async function createAuthedPage(browser: Browser, request: APIRequestContext, guestId: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = await loginGuestIntoPage(page, request, guestId);
  return { context, page, login };
}
