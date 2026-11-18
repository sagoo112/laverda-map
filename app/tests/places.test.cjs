require("./register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEntries } = require("../src/features/places/schema.ts");
const {
  normalizePlaces,
  isMappable,
  filterPlaces,
  sortPlaces,
  distanceKm,
  countryName,
} = require("../src/features/places/model.ts");
const { webUrl } = require("../src/shared/urls.ts");
const source = require("./fixtures/places.generated.json");
const seed = require("../../api/places.json");

test("generated snapshot preserves every public seed field and allocated ID", () => {
  const entries = parseEntries(source);
  assert.equal(entries.length, 43);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 43);
  entries.forEach((entry, i) =>
    assert.deepEqual({ ...entry, id: seed.entries[i].id }, seed.entries[i]),
  );
  assert.ok(entries.some((entry) => entry.id === "www-laverdamania-net-f806fe-2"));
});
test("invalid enums, dates, coordinate pairs, field types and duplicate IDs are rejected", () => {
  for (const payload of [
    {},
    null,
    { entries: null },
    { entries: [null] },
    [{ id: " " }],
    [{ id: "x", type: "admin" }],
    [{ id: "x", visibility: "PUBLIC" }],
    [{ id: "x", tags: [false] }],
    [{ id: "x", verified: "false" }],
    [{ id: "x", lastCheckedAt: "2026-02-30" }],
    [{ id: "x", location: { lat: 91, lng: 8, mode: "exact" } }],
    [{ id: "x" }, { id: "x" }],
  ]) {
    assert.throws(() => parseEntries(payload), /Invalid places/);
  }
  assert.deepEqual(parseEntries({ entries: [] }), []);
  assert.equal(parseEntries([{ id: "x", url: null, location: null, tags: null }]).length, 1);
});
test("normalization keeps coordinates and only includes explicitly public entries", () => {
  const entries = parseEntries(source);
  normalizePlaces(entries).forEach((place, index) =>
    assert.deepEqual(place.location, entries[index].location),
  );
  const inputs = ["public", "private", "hidden", null, undefined].map((visibility, i) => ({
    id: String(i),
    type: "private",
    visibility,
  }));
  assert.equal(normalizePlaces(inputs).length, 1);
});
test("online and country-only resources never become navigable map pins", () => {
  const places = normalizePlaces(parseEntries(source));
  for (const place of places) {
    if (
      place.location?.mode === "country-centroid" ||
      ["blog", "forum", "registry"].includes(place.type)
    ) {
      assert.equal(isMappable(place), false);
      assert.equal(place.navigationUrl, null);
    }
  }
  assert.ok(places.filter(isMappable).length > 0);
});
test("search, categories, bookmarks and deterministic ordering compose", () => {
  const places = normalizePlaces(parseEntries(source));
  const club = places.find((place) => place.type === "club" && place.country === "CH");
  assert.ok(filterPlaces(places, "CH", "club", [club.id]).some((place) => place.id === club.id));
  assert.deepEqual(filterPlaces(places, "does-not-exist", "all"), []);
  assert.deepEqual(
    sortPlaces([...places].reverse()).map((place) => place.id),
    sortPlaces(places).map((place) => place.id),
  );
  assert.deepEqual(filterPlaces(places, "", "all", []), []);
});
test("distance sorting is stable and never places online resources nearest", () => {
  const places = normalizePlaces(parseEntries(source));
  const target = places.find(isMappable);
  const origin = { latitude: target.location.lat, longitude: target.location.lng };
  assert.equal(distanceKm(origin, origin), 0);
  assert.ok(
    Math.abs(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111.195) <
      0.01,
  );
  const sorted = sortPlaces(places, origin);
  assert.equal(sorted[0].id, target.id);
  assert.equal(isMappable(sorted.at(-1)), false);
});

test("search understands country names, combined keywords and accents without altering source data", () => {
  const places = normalizePlaces(parseEntries(source));
  const matches = filterPlaces(places, "mori switzerland", "all");
  assert.equal(matches.length, 1);
  assert.match(matches[0].name, /Möri/);
  assert.equal(countryName("CH"), "Switzerland");
  assert.ok(filterPlaces(places, "Konstanz Oberlohnstrasse", "all").length > 0);
  assert.ok(filterPlaces(places, "laverdamania.net", "blog").length > 0);
  assert.equal(countryName("unknown"), "Location not specified");
});

test("all seeded countries and country-name search work without native Intl.DisplayNames", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, "DisplayNames");
  try {
    Object.defineProperty(Intl, "DisplayNames", { configurable: true, value: undefined });
    const places = normalizePlaces(parseEntries(source));
    for (const country of new Set(places.map((place) => place.country))) {
      assert.notEqual(countryName(country), country);
    }
    assert.equal(filterPlaces(places, "mori switzerland", "all").length, 1);
    assert.equal(countryName("XX"), "XX");
  } finally {
    Object.defineProperty(Intl, "DisplayNames", descriptor);
  }
});
test("unsafe URL schemes and embedded credentials cannot be opened", () => {
  for (const url of [
    null,
    "",
    "javascript:alert(1)",
    "file:///private",
    "intent://x",
    "https://user:secret@example.org",
    "not a url",
  ])
    assert.equal(webUrl(url), null);
  assert.equal(webUrl("https://example.org/path?q=1"), "https://example.org/path?q=1");
});
