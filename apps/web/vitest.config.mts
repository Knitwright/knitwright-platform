import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));
const alias = {
  "@": root,
  // The real package throws outside a React server build. Tests run in plain Node.
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

// Local Supabase address and keys, written by `pnpm db:start`. CI sets them directly.
const localEnvFile = fileURLToPath(new URL("./.env.local", import.meta.url));
const localEnv = existsSync(localEnvFile) ? parseEnv(readFileSync(localEnvFile, "utf8")) : {};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      include: ["lib/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/fixtures/**",
        "**/test-deps.ts",
        // These join the framework's request to the tested code and hold no logic of
        // their own. They run only inside Next.js, so the end-to-end tests cover them.
        "lib/server/deps.ts",
        "lib/server/page-guards.ts",
        "lib/server/define-route.ts",
        "lib/server/define-action.ts",
        "lib/**/actions.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // Invariant I4: measurement and tech pack maths are held to a higher mark.
        "lib/garment/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "lib/**/*.test.ts",
            "components/**/*.test.ts",
            "app/**/*.test.ts",
            "tests/architecture/**/*.test.ts",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          // Needs local Supabase: run `pnpm db:start` at the repository root first.
          name: "db",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          env: { ...localEnv, ...process.env },
          testTimeout: 20_000,
          hookTimeout: 20_000,
          // Some files change settings every test shares, such as the sign-up switch.
          fileParallelism: false,
        },
      },
    ],
  },
});
