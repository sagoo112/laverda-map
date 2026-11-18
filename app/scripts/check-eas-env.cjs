// Runs on the EAS worker before installing dependencies. Never print values.
const profile = process.env.EAS_BUILD_PROFILE;
const platform = process.env.EAS_BUILD_PLATFORM;
const problems = [];

if (!profile || !platform) {
  console.error("This check runs inside EAS Build, with EAS_BUILD_PROFILE and EAS_BUILD_PLATFORM.");
  process.exit(1);
}

if (profile !== "development") {
  try {
    const url = new URL(process.env.EXPO_PUBLIC_API_URL?.trim() ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"].includes(url.hostname)
    ) {
      throw new Error("Invalid API origin");
    }
  } catch {
    problems.push(
      "EXPO_PUBLIC_API_URL must be a public HTTPS origin without a route or credentials.",
    );
  }
}

if (platform === "android" && !process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim()) {
  problems.push("GOOGLE_MAPS_ANDROID_API_KEY is required for the Android map.");
}

if (problems.length) {
  console.error(`EAS environment is incomplete for ${profile}/${platform}:`);
  for (const problem of problems) console.error(`- ${problem}`);
  console.error(
    "Set the variables in the matching Expo project environment. See app/EAS-SETUP.md.",
  );
  process.exit(1);
}

console.log(`EAS environment check passed for ${profile}/${platform}.`);
