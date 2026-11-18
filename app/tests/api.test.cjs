require("./register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.EXPO_PUBLIC_API_URL = " https://api.example.test/// ";
const {
  API_URL,
  requestJson,
  ApiError,
  setAccessToken,
  onUnauthorized,
} = require("../src/shared/api.ts");

test("API URL normalization and request/response contract", async (t) => {
  assert.equal(API_URL, "https://api.example.test");
  t.mock.method(global, "fetch", async (url, options) => {
    assert.equal(url, "https://api.example.test/api/v1/tenants/laverda/places");
    assert.equal(options.headers.get("Accept"), "application/json");
    return new Response(JSON.stringify({ entries: [] }));
  });
  assert.deepEqual(await requestJson("/api/v1/tenants/laverda/places"), { entries: [] });
});

test("HTTP failures retain their status instead of appearing as wrong passwords", async (t) => {
  t.mock.method(global, "fetch", async () => new Response("{}", { status: 503 }));
  await assert.rejects(
    requestJson("/auth/unlock"),
    (error) => error instanceof ApiError && error.status === 503,
  );
});

test("requests time out and abort the underlying fetch", async (t) => {
  let signal;
  t.mock.method(
    global,
    "fetch",
    (_url, options) =>
      new Promise((_resolve, reject) => {
        signal = options.signal;
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
  );
  await assert.rejects(requestJson("/health", {}, 10), /too long/);
  assert.equal(signal.aborted, true);
});

test("unmount/retry cancellation is forwarded and does not become a timeout", async (t) => {
  t.mock.method(
    global,
    "fetch",
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("cancelled")), {
          once: true,
        });
      }),
  );
  const controller = new AbortController();
  const request = requestJson("/health", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /cancelled/);
});

test("invalid JSON is rejected rather than treated as a successful unlock", async (t) => {
  t.mock.method(global, "fetch", async () => new Response("<html>not JSON</html>"));
  await assert.rejects(requestJson("/auth/unlock"), SyntaxError);
});

test("authenticated requests send the bearer token and revoke on a current-session 401", async (t) => {
  let revoked = 0;
  setAccessToken("a".repeat(64));
  onUnauthorized(() => revoked++);
  try {
    t.mock.method(global, "fetch", async (_url, options) => {
      assert.equal(options.headers.get("Authorization"), "Bearer " + "a".repeat(64));
      return new Response("{}", { status: 401 });
    });
    await assert.rejects(requestJson("/api/v1/tenants/laverda/places"), ApiError);
    assert.equal(revoked, 1);
  } finally {
    setAccessToken(null);
    onUnauthorized(null);
  }
});

test("a late unauthorized response cannot revoke a newer sign-in", async (t) => {
  let revoked = 0;
  let finish;
  setAccessToken("a".repeat(64));
  onUnauthorized(() => revoked++);
  try {
    t.mock.method(global, "fetch", () => new Promise((resolve) => (finish = resolve)));
    const pending = requestJson("/api/v1/tenants/laverda/places");
    setAccessToken("b".repeat(64));
    finish(new Response("{}", { status: 401 }));
    await assert.rejects(pending, ApiError);
    assert.equal(revoked, 0);
  } finally {
    setAccessToken(null);
    onUnauthorized(null);
  }
});
