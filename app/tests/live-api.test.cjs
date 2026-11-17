require("./register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEntries } = require("../src/features/places/schema.ts");
const { normalizePlaces } = require("../src/features/places/model.ts");
const snapshot = require("../src/features/places/data/places.generated.json");
test(
  "live PHP/MariaDB response matches the generated mobile contract",
  { skip: !process.env.LAVERDA_TEST_API_URL },
  async () => {
    const response = await fetch(
      process.env.LAVERDA_TEST_API_URL.replace(/\/+$/, "") + "/api/v1/tenants/laverda/places",
    );
    assert.equal(response.status, 200);
    const entries = parseEntries(await response.json());
    const expected = parseEntries(snapshot);
    assert.equal(entries.length, expected.length);
    entries.forEach((entry, index) => {
      for (const [field, value] of Object.entries(expected[index]))
        assert.deepEqual(entry[field], value, index + "." + field);
    });
    assert.equal(normalizePlaces(entries).length, expected.length);
  },
);
