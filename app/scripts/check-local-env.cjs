// Report readiness, never configuration values or keys. No server is started.
const path = require("node:path");
const root = path.resolve(__dirname, "..");
require("@expo/env").loadProjectEnv(root, { mode: "development", silent: true });
let apiConfigured = false;
try {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL ?? "");
  apiConfigured =
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash;
} catch {
  /* Missing or invalid origin is reported as a boolean below. */
}
console.log(
  JSON.stringify({
    apiConfigured,
    mapsConfigured: !!process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim(),
  }),
);
