require("./register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cacheKey,
  encodeCache,
  decodeCache,
  decodeFavorites,
} = require("../src/features/places/cache.ts");
test("cache is versioned and tenant scoped and only persists public records", () => {
  const snapshot = {
    fetchedAt: "2026-09-22T12:00:00.000Z",
    entries: [
      { id: "public", visibility: "public" },
      { id: "private", visibility: "private" },
    ],
  };
  assert.deepEqual(decodeCache(encodeCache(snapshot)), {
    fetchedAt: snapshot.fetchedAt,
    entries: [snapshot.entries[0]],
  });
  assert.notEqual(cacheKey("https://production.test"), cacheKey("http://localhost"));
  assert.ok(cacheKey(null).includes("laverda"));
});
test("corrupt, old-version, cross-tenant and invalid-date cache is ignored", () => {
  for (const raw of [
    null,
    "bad",
    "{}",
    JSON.stringify({ version: 0, tenant: "laverda", entries: [] }),
    JSON.stringify({
      version: 1,
      tenant: "another-club",
      fetchedAt: "2026-09-22T12:00:00Z",
      entries: [],
    }),
    JSON.stringify({ version: 1, tenant: "laverda", fetchedAt: "bad", entries: [] }),
  ])
    assert.equal(decodeCache(raw), null);
});
test("favorites survive serialization, remove duplicates and reject corrupt storage", () => {
  assert.deepEqual(decodeFavorites('["one","one","two"]'), ["one", "two"]);
  assert.deepEqual(decodeFavorites('[{"id":"x"}]'), []);
  assert.deepEqual(decodeFavorites(null), []);
});
