const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
export const API_URL = configuredUrl || null;

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
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
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
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { Accept: "application/json", ...options.headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(response.status);
    return await response.json();
  } catch (error) {
    if (timedOut) throw new Error("The server took too long to respond. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
