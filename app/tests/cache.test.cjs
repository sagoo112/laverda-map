require("./register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  removeLegacyDirectory,
  decodeFavorites,
  favoritesKey,
} = require("../src/features/places/cache.ts");
test("old directory snapshots are removed across API origins without erasing bookmarks", async () => {
  let removed;
  await removeLegacyDirectory({
    getAllKeys: async () => [
      "laverda:places:v1:laverda:old-api",
      "laverda:places:v1:laverda:new-api",
      favoritesKey,
      "another-app",
    ],
    multiRemove: async (keys) => {
      removed = keys;
    },
  });
  assert.deepEqual(removed, [
    "laverda:places:v1:laverda:old-api",
    "laverda:places:v1:laverda:new-api",
  ]);
});
test("favorites survive serialization, remove duplicates and reject corrupt storage", () => {
  assert.deepEqual(decodeFavorites('["one","one","two"]'), ["one", "two"]);
  assert.deepEqual(decodeFavorites('[{"id":"x"}]'), []);
  assert.deepEqual(decodeFavorites(null), []);
});
