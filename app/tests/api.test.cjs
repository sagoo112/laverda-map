require("./register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.EXPO_PUBLIC_API_URL = " https://api.example.test/// ";
const { API_URL, requestJson, ApiError } = require("../src/shared/api.ts");

test("API URL normalization and request/response contract", async (t) => {
  assert.equal(API_URL, "https://api.example.test");
  t.mock.method(global, "fetch", async (url, options) => {
    assert.equal(url, "https://api.example.test/api/v1/tenants/laverda/places");
    assert.equal(options.headers.Accept, "application/json");
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
