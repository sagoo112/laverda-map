const fs = require("fs");
const path = require("path");

const INPUT = path.join(process.cwd(), "src", "data", "places.json");
const OUTPUT = path.join(process.cwd(), "src", "data", "places.json"); // overwrite in place
const BACKUP = path.join(process.cwd(), "src", "data", "places.backup.json");

const CC_TLD = new Set([
  "ch","de","at","it","fr","uk","nl","es","se","fi","dk","no","be","au","ca","us"
]);

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n", "utf8"); }

function inferCountryFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = host.split(".");
    const tld = parts[parts.length - 1];
    if (CC_TLD.has(tld)) return tld.toUpperCase();
    // special: co.uk
    if (host.endsWith(".co.uk")) return "GB";
  } catch {}
  return null;
}

function inferType(entry) {
  if (entry.type) return entry.type;

  const c = String(entry.category ?? "").toLowerCase();
  const d = String(entry.description ?? "").toLowerCase();
  const u = String(entry.url ?? "").toLowerCase();
  const tags = Array.isArray(entry.tags) ? entry.tags.map(x => String(x).toLowerCase()) : [];

  const hay = [c,d,u,tags.join(" ")].join(" ");

  if (hay.includes("museum") || hay.includes("museo")) return "museum";
  if (hay.includes("werkstatt") || hay.includes("service") || hay.includes("garage") || hay.includes("shop") || hay.includes("dealer") || hay.includes("parts") || hay.includes("spares") || hay.includes("restoration")) return "service";
  if (hay.includes("club") || hay.includes("clubs") || hay.includes("forum") || tags.includes("club")) return "club";
  if (hay.includes("private") || hay.includes("privat") || hay.includes("collection") || hay.includes("sammlung")) return "private";
  return "other";
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("Missing input:", INPUT);
    process.exit(1);
  }

  const doc = readJson(INPUT);
  if (!doc || !Array.isArray(doc.entries)) {
    console.error("Invalid schema: expected { entries: [...] }");
    process.exit(1);
  }

  // backup
  writeJson(BACKUP, doc);

  const out = {
    ...doc,
    schemaVersion: Math.max(2, Number(doc.schemaVersion || 0)),
    generatedAt: new Date().toISOString(),
    entries: doc.entries.map((e) => {
      const country = (e.country && String(e.country).toUpperCase() !== "UNKNOWN")
        ? String(e.country).toUpperCase()
        : (inferCountryFromUrl(e.url) ?? e.country ?? "unknown");

      const type = inferType(e);

      // keep existing location/navigationUrl
      return {
        ...e,
        country,
        type
      };
    })
  };

  writeJson(OUTPUT, out);

  console.log("Backup written:", BACKUP);
  console.log("Updated written:", OUTPUT);
}

main();
