import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authHeaders, registerUser } from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("auth routes", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;

  beforeAll(async () => {
    context = await createApiTestContext();
  });

  beforeEach(async () => {
    await context.resetState();
  });

  afterAll(async () => {
    await context.close();
  });

  it("registers, verifies, logs in, and returns account overview", async () => {
    const registration = await registerUser(context.app, {
      username: "warden_alpha",
      email: "warden_alpha@example.com"
    });

    expect(registration.response.statusCode).toBe(200);

    const account = await context.prisma.account.findUniqueOrThrow({
      where: { email: registration.payload.email }
    });
    expect(account.emailVerifyToken).toBeTruthy();

    const overviewBefore = await context.app.inject({
      method: "GET",
      url: "/v1/account/overview",
      headers: authHeaders(registration.body.accessToken)
    });
    expect(overviewBefore.statusCode).toBe(200);
    expect(overviewBefore.json().emailVerified).toBe(false);

    const verifyResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/verify-email",
      payload: {
        token: account.emailVerifyToken
      }
    });
    expect(verifyResponse.statusCode).toBe(200);

    const loginResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: registration.payload.email,
        password: registration.payload.password
      }
    });
    expect(loginResponse.statusCode).toBe(200);

    const overviewAfter = await context.app.inject({
      method: "GET",
      url: "/v1/account/overview",
      headers: authHeaders(loginResponse.json().accessToken)
    });
    expect(overviewAfter.statusCode).toBe(200);
    expect(overviewAfter.json().emailVerified).toBe(true);
  });

  it("rejects duplicate usernames and duplicate emails", async () => {
    await registerUser(context.app, {
      username: "duplicate_user",
      email: "first@example.com"
    });

    const duplicateUsername = await registerUser(context.app, {
      username: "duplicate_user",
      email: "second@example.com"
    });
    expect(duplicateUsername.response.statusCode).toBe(409);

    const duplicateEmail = await registerUser(context.app, {
      username: "other_user",
      email: "first@example.com"
    });
    expect(duplicateEmail.response.statusCode).toBe(409);
  });

  it("supports forgot-password and reset-password token flows", async () => {
    const registration = await registerUser(context.app, {
      username: "forgot_user",
      email: "forgot_user@example.com"
    });

    const missingEmailResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/forgot-password",
      payload: {
        email: "missing@example.com"
      }
    });
    expect(missingEmailResponse.statusCode).toBe(200);

    const forgotResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/forgot-password",
      payload: {
        email: registration.payload.email
      }
    });
    expect(forgotResponse.statusCode).toBe(200);

    const account = await context.prisma.account.findUniqueOrThrow({
      where: { email: registration.payload.email }
    });
    expect(account.resetPasswordToken).toBeTruthy();

    const invalidResetResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/reset-password",
      payload: {
        token: "invalid-token",
        newPassword: "newpassword123"
      }
    });
    expect(invalidResetResponse.statusCode).toBe(400);

    const resetResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/reset-password",
      payload: {
        token: account.resetPasswordToken,
        newPassword: "newpassword123"
      }
    });
    expect(resetResponse.statusCode).toBe(200);

    const loginResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: registration.payload.email,
        password: "newpassword123"
      }
    });
    expect(loginResponse.statusCode).toBe(200);
  });

  it("rejects expired verification and reset tokens", async () => {
    const registration = await registerUser(context.app, {
      username: "expired_user",
      email: "expired_user@example.com"
    });

    await context.prisma.account.update({
      where: { email: registration.payload.email },
      data: {
        emailVerifyExpiry: new Date(Date.now() - 60_000),
        resetPasswordToken: "expired-reset",
        resetPasswordExpiry: new Date(Date.now() - 60_000)
      }
    });

    const account = await context.prisma.account.findUniqueOrThrow({
      where: { email: registration.payload.email }
    });

    const verifyResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/verify-email",
      payload: {
        token: account.emailVerifyToken
      }
    });
    expect(verifyResponse.statusCode).toBe(400);

    const resetResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auth/reset-password",
      payload: {
        token: "expired-reset",
        newPassword: "anotherpassword123"
      }
    });
    expect(resetResponse.statusCode).toBe(400);
  });
});
