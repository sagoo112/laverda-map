require("./register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  emptyProposal,
  createProposal,
  contactConfigured,
} = require("../src/features/club/proposal.ts");
const { parseEntries } = require("../src/features/places/schema.ts");
const form = {
  ...emptyProposal,
  senderName: "Example rider",
  senderEmail: "rider@example.org",
  name: "Example club",
  country: "ch",
  url: "https://example.org",
};
test("proposal attachment is import-compatible and separates contact details", () => {
  const p = createProposal(
    { ...form, tags: "Laverda, Club, Laverda", mode: "exact", latitude: "46.8", longitude: "8.2" },
    "new-entry",
  );
  assert.deepEqual(parseEntries(JSON.parse(p.json)), [p.entry]);
  assert.equal(p.entry.visibility, "hidden");
  assert.equal(p.entry.verified, false);
  assert.equal(p.entry.status, "pending");
  assert.equal(p.entry.country, "CH");
  assert.deepEqual(p.entry.tags, ["Laverda", "Club"]);
  assert.equal(p.entry.location.lat, 46.8);
  assert.ok(!p.json.includes("rider@example.org"));
  assert.ok(!p.json.includes("Example rider"));
});
test("invalid proposal fields are rejected before opening an email draft", () => {
  for (const patch of [
    { name: "" },
    { country: "Switzerland" },
    { senderEmail: "invalid" },
    { url: "javascript:alert(1)" },
    { navigationUrl: "https://user:pass@example.org" },
    { lastCheckedAt: "2026-02-30" },
    { mode: "exact", latitude: "91", longitude: "5" },
    { mode: "approx", latitude: "0" },
    { mode: "none", latitude: "1" },
    { priority: "1.5" },
  ]) {
    assert.throws(() => createProposal({ ...form, ...patch }));
  }
});
test("placeholder recipient is never treated as a configured club address", () => {
  assert.equal(contactConfigured, false);
});
