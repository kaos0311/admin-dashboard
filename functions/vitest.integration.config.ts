import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/test-utils/**/*.integration.test.ts",
      "src/test-utils/**/*.emulator.test.ts",
      "src/golden/**/*.emulator.test.ts",
    ],
    exclude: ["node_modules", "lib"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      FIRESTORE_EMULATOR_HOST: "localhost:8085",
      FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
      GCLOUD_PROJECT: "demo-advanced-home-medical",
    },
  },
});
