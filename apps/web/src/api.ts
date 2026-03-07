import type {
  AccountOverviewResponse,
  DevGuestLoginResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  InventoryMoveResponse,
  LoginBody,
  LoginResponse,
  PlayerPreferences,
  PlayerState,
  RegisterBody,
  RegisterResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  UpdatePlayerPreferencesBody,
  VerifyEmailBody,
  VerifyEmailResponse
} from "@ebonkeep/shared";
import {
  accountOverviewResponseSchema,
  devGuestLoginResponseSchema,
  forgotPasswordResponseSchema,
  inventoryMoveResponseSchema,
  loginResponseSchema,
  playerPreferencesSchema,
  playerStateSchema,
  registerResponseSchema,
  resetPasswordResponseSchema,
  verifyEmailResponseSchema
} from "@ebonkeep/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function authHeaders(token: string | null): HeadersInit {
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function register(body: RegisterBody): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(error.error || `Registration failed (${response.status})`);
  }
  const data = await response.json();
  return registerResponseSchema.parse(data);
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
    const error = await response.json().catch(() => ({ error: "Login failed" }));
    throw new Error(error.error || `Login failed (${response.status})`);
  }
  const data = await response.json();
  return loginResponseSchema.parse(data);
}

export async function getAccountOverview(token: string): Promise<AccountOverviewResponse> {
  const response = await fetch(`${API_URL}/v1/account/overview`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });
  if (!response.ok) {
    throw new Error(`Account overview failed (${response.status})`);
  }
  const data = await response.json();
  return accountOverviewResponseSchema.parse(data);
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
    const error = await response.json().catch(() => ({ error: "Email verification failed" }));
    throw new Error(error.error || `Email verification failed (${response.status})`);
  }
  const data = await response.json();
  return verifyEmailResponseSchema.parse(data);
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
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed (${response.status})`);
  }
  const data = await response.json();
  return forgotPasswordResponseSchema.parse(data);
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
    const error = await response.json().catch(() => ({ error: "Password reset failed" }));
    throw new Error(error.error || `Password reset failed (${response.status})`);
  }
  const data = await response.json();
  return resetPasswordResponseSchema.parse(data);
}

export async function resendVerificationEmail(token: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/v1/auth/resend-verification`, {
    method: "POST",
    headers: {
      ...authHeaders(token)
    }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to resend verification email" }));
    throw new Error(error.error || `Failed to resend verification email (${response.status})`);
  }
  return await response.json();
}

export async function devGuestLogin(): Promise<DevGuestLoginResponse> {
  const response = await fetch(`${API_URL}/v1/dev/guest-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    throw new Error(`Login failed (${response.status})`);
  }
  const data = await response.json();
  return devGuestLoginResponseSchema.parse(data);
}

export async function fetchPlayerState(token: string): Promise<PlayerState> {
  const response = await fetch(`${API_URL}/v1/player/state`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });
  if (!response.ok) {
    throw new Error(`Player state failed (${response.status})`);
  }
  const data = await response.json();
  return playerStateSchema.parse(data);
}

export async function updatePlayerPreferences(
  token: string,
  body: UpdatePlayerPreferencesBody
): Promise<PlayerPreferences> {
  const response = await fetch(`${API_URL}/v1/player/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Update preferences failed (${response.status})`);
  }
  const data = await response.json();
  return playerPreferencesSchema.parse(data);
}

export async function moveInventoryItem(
  token: string,
  itemId: string,
  fromSlot: string,
  toSlot: string
): Promise<InventoryMoveResponse> {
  const response = await fetch(`${API_URL}/v1/inventory/move-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({
      itemId,
      fromSlot,
      toSlot
    })
  });
  if (!response.ok) {
    throw new Error(`Move item failed (${response.status})`);
  }
  const data = await response.json();
  return inventoryMoveResponseSchema.parse(data);
}

export async function fetchReady(): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/ready`);
  const data = (await response.json()) as Record<string, string>;
  return data;
}

export function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
}
