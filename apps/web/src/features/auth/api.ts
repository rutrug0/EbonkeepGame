import type {
  AccountOverviewResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  LoginBody,
  LoginResponse,
  RegisterBody,
  RegisterResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  VerifyEmailBody,
  VerifyEmailResponse
} from "@ebonkeep/shared/auth";
import {
  accountOverviewResponseSchema,
  forgotPasswordResponseSchema,
  loginResponseSchema,
  registerResponseSchema,
  resetPasswordResponseSchema,
  verifyEmailResponseSchema
} from "@ebonkeep/shared/auth";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function register(body: RegisterBody): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Registration failed"));
  }

  return registerResponseSchema.parse(await response.json());
}

export async function login(body: LoginBody): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Login failed"));
  }

  return loginResponseSchema.parse(await response.json());
}

export async function getAccountOverview(token: string): Promise<AccountOverviewResponse> {
  const response = await fetch(`${API_URL}/v1/account/overview`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Account overview failed (${response.status})`);
  }

  return accountOverviewResponseSchema.parse(await response.json());
}

export async function verifyEmail(body: VerifyEmailBody): Promise<VerifyEmailResponse> {
  const response = await fetch(`${API_URL}/v1/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Email verification failed"));
  }

  return verifyEmailResponseSchema.parse(await response.json());
}

export async function forgotPassword(body: ForgotPasswordBody): Promise<ForgotPasswordResponse> {
  const response = await fetch(`${API_URL}/v1/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Request failed"));
  }

  return forgotPasswordResponseSchema.parse(await response.json());
}

export async function resetPassword(body: ResetPasswordBody): Promise<ResetPasswordResponse> {
  const response = await fetch(`${API_URL}/v1/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Password reset failed"));
  }

  return resetPasswordResponseSchema.parse(await response.json());
}

export async function resendVerificationEmail(token: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/v1/auth/resend-verification`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to resend verification email"));
  }

  return await response.json();
}
