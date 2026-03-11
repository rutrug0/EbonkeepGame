export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function authHeaders(token: string | null): HeadersInit {
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const error = await response.json().catch(() => ({ error: fallback }));
  return error.error || `${fallback} (${response.status})`;
}
