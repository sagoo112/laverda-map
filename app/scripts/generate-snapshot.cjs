// Build-time only. api/places.json is the sole seed source; never loaded by the API.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const source = JSON.parse(fs.readFileSync(path.join(root, "api/places.json"), "utf8"));
function allocateIds(entries) {
  const reserved = new Set(entries.map((entry) => entry.id));
  const assigned = new Set();
  const counts = new Map();
  return entries.map((entry) => {
    let occurrence = (counts.get(entry.id) ?? 0) + 1;
    let id = occurrence === 1 ? entry.id : entry.id + "-" + occurrence;
    while (occurrence > 1 && (reserved.has(id) || assigned.has(id)))
      id = entry.id + "-" + ++occurrence;
    counts.set(entry.id, occurrence);
    assigned.add(id);
    return { ...entry, id };
  });
}
const snapshot = {
  schemaVersion: source.schemaVersion,
  generatedAt: source.generatedAt,
  entries: allocateIds(source.entries).filter((entry) => entry.visibility === "public"),
};
const output = path.join(root, "app/tests/fixtures/places.generated.json");
const contents = JSON.stringify(snapshot, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== contents) {
    console.error("Test fixture is stale. Run npm run data:generate.");
    process.exitCode = 1;
  } else console.log("Test public fixture matches the authoritative API seed.");
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, contents);
  console.log("Generated " + snapshot.entries.length + " public entries.");
}
