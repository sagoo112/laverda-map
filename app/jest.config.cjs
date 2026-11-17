module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/tests"],
  testTimeout: 15000,
  modulePathIgnorePatterns: ["<rootDir>/.claude"],
  testMatch: ["<rootDir>/tests/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.cjs"],
};
