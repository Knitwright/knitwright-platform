import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { configDefaults, defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));
const alias = {
  "@": root,
  // The real package throws outside a React server build. Tests run in plain Node.
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

/** The tests that make PDF files. They are the slowest in the suite and run alone, after the others. */
const PDF_TESTS = [
  "lib/techpack/exports/pdf/**/*.test.ts",
  "lib/techpack/exports/formats.test.ts",
  "lib/projects/export-download.test.ts",
];

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
        // Joins the tech pack reads to the checks; the end-to-end test of the factory file covers it.
        "lib/validation/design-input.ts",
        // Join the design's reads to the checks and the version save; the end-to-end test of the Ideas panel covers them.
        "lib/variants/gate.ts",
        "lib/variants/service.ts",
        // Joins the gate to the flag, the ledger and the log; the route tests and the end-to-end tests cover it.
        "lib/credits-gate/server.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // Invariant I4: measurement and tech pack maths are held to a higher mark.
        "lib/garment/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "lib/sizing/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The drawing of a garment feeds the tech pack and the exports, so it is held to the same mark.
        "lib/flat/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The tech pack is the product's main output, and the exports are made from it.
        "lib/techpack/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The production outputs (plans/production-outputs.md). Each directory is added by its workstream.
        ...Object.fromEntries(
          ["production", "pattern-library", "fabrics", "cutting", "print", "orders", "releases", "proofs", "artwork-stack", "artwork-intake", "design-import", "guardrails", "ops", "templates", "validation", "design-diff", "variants", "gltf", "credits-gate", "panel-layers", "settings"].map((dir) => [
            `lib/${dir}/**`,
            { lines: 90, functions: 90, branches: 90, statements: 90 },
          ]),
        ),
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
          exclude: [...configDefaults.exclude, ...PDF_TESTS],
          // Ordinary tests run together, and the PDF tests run after them (see the "pdf" project).
          sequence: { groupOrder: 1 },
        },
      },
      {
        resolve: { alias },
        test: {
          // Making a PDF costs a second of processor time, and the default wait for a test is five
          // seconds. With every other test file running at once, a PDF test can take five times as
          // long as it does alone. So these files run one after another, on their own, after the
          // rest. The wait is not raised: a PDF test that is slow on its own still fails.
          name: "pdf",
          environment: "node",
          include: PDF_TESTS,
          fileParallelism: false,
          sequence: { groupOrder: 3 },
        },
      },
      {
        resolve: { alias },
        test: {
          // Needs local Supabase: run `pnpm db:start` at the repository root first.
          name: "db",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Vitest wants a different order for projects that use different numbers of workers.
          sequence: { groupOrder: 2 },
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
