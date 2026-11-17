const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  {
    ignores: [
      ".claude/**",
      "dist/**",
      "android/**",
      "ios/**",
      "src/features/places/data/**",
      "tests/**",
      "scripts/**",
    ],
  },
]);
