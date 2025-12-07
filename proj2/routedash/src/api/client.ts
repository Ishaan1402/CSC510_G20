import Constants from "expo-constants";

const API_URL =
  (Constants?.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  (Constants?.manifest?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:4000";

// Module-level token storage for Bearer auth (mobile-compatible)
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

type RequestOptions = RequestInit & {
  requireAuth?: boolean;
};

export const apiFetch = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { headers, requireAuth = true, credentials, ...rest } = options;

  // Build headers with Bearer token if available
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  // Add Bearer token for authenticated requests on mobile
  if (requireAuth && authToken) {
    requestHeaders["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: rest.method ?? "GET",
    credentials: credentials ?? (requireAuth ? "include" : "omit"),
    headers: requestHeaders,
    ...rest,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error ?? "Unexpected API error");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
};

export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiPatch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, {
    ...options,
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T>(path: string, options?: RequestOptions) =>
  apiFetch<T>(path, {
    ...options,
    method: "DELETE",
  });
