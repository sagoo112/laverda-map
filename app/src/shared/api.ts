const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
export const API_URL = configuredUrl || "https://api.laverdaclub.ch";
let accessToken: string | null = null;
let unauthorized: (() => void) | null = null;
export const setAccessToken = (value: string | null) => {
  accessToken = value;
};
export const onUnauthorized = (callback: (() => void) | null) => {
  unauthorized = callback;
};

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`Server returned HTTP ${status}.`);
  }
}

/** Bound requests, including body reads, and cancel them when a screen unmounts. */
export async function requestJson(
  path: string,
  options: RequestInit = {},
  timeoutMs = 12000,
): Promise<unknown> {
  if (typeof __DEV__ !== "undefined" && !__DEV__ && !API_URL.startsWith("https://")) {
    throw new Error("HTTPS is required for API access.");
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const requestToken = accessToken;
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (requestToken) headers.set("Authorization", "Bearer " + requestToken);
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401 && requestToken && requestToken === accessToken) unauthorized?.();
      throw new ApiError(response.status);
    }
    return await response.json();
  } catch (error) {
    if (timedOut) throw new Error("The server took too long to respond. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
