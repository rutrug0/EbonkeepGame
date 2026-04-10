import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

type PlaywrightGuestClass = "juggernaut" | "sentinel" | "reaver" | "shade" | "arbalist" | "disciple" | "runecaster" | "voidcaster" | "arcanist";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_URL ??
  `http://127.0.0.1:${process.env.TEST_API_PORT ?? "4010"}`;
const LOGIN_RETRYABLE_ERROR_CODES = ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET"];
const LOGIN_RETRY_ATTEMPTS = 5;
const LOGIN_RETRY_DELAY_MS = 1000;

function isRetryableLoginError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return LOGIN_RETRYABLE_ERROR_CODES.some((code) => error.message.includes(code));
}

async function waitForRetryDelay() {
  await new Promise((resolve) => setTimeout(resolve, LOGIN_RETRY_DELAY_MS));
}

export async function loginGuestViaApi(
  request: APIRequestContext,
  guestId: string,
  playerClass: PlaywrightGuestClass = "juggernaut"
) {
  for (let attempt = 1; attempt <= LOGIN_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await request.post(`${apiBaseUrl}/v1/dev/guest-login`, {
        data: {
          guestId,
          class: playerClass
        }
      });
      expect(response.ok()).toBeTruthy();
      return response.json() as Promise<{ accessToken: string; playerId: string; accountId: string }>;
    } catch (error) {
      if (attempt === LOGIN_RETRY_ATTEMPTS || !isRetryableLoginError(error)) {
        throw error;
      }
      await waitForRetryDelay();
    }
  }

  throw new Error("Guest login retry loop exhausted unexpectedly.");
}

export async function loginGuestIntoPage(
  page: Page,
  request: APIRequestContext,
  guestId: string,
  playerClass: PlaywrightGuestClass = "juggernaut"
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
