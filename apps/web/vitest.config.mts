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
  // The marketing export's PDF (plan v5 L4, decision 0094): one page per artboard.
  "lib/marketing/export/pdf.test.ts",
  "lib/techpack/exports/formats.test.ts",
  "lib/projects/export-download.test.ts",
  // The production package writes a PDF for every size and reads several back (decision 0070).
  "lib/kpp/**/*.test.ts",
  // The quote is one PDF per test, read back page by page (plan v5 Z6, decision 0106).
  "lib/quotes/document.test.ts",
  // Each of these pushes a full-size picture (up to 6000 x 8000 px) through sharp and the whole
  // print pipeline, and says so in its own file: 270-310 s apiece under coverage on a shared
  // runner, against a 600 s budget. That headroom is spent by contention, not by the work: the
  // files passed for months in the "unit" project and began timing out once wave 2 grew the suite
  // past 18,000 tests. They belong here, where the slow files run one at a time after the rest.
  "lib/print/acceptance/**/*.test.ts",
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
        // Join the AI Studio pages to the session's reads and the variants' gate (decision 0141); the workflow
        // engines they hand over are tested on their own, and the end-to-end test of AI Studio covers the joins.
        "lib/ai-studio/server.ts",
        "lib/ai-studio/remix-service.ts",
        // Joins the gate to the flag, the ledger and the log; the route tests and the end-to-end tests cover it.
        "lib/credits-gate/server.ts",
        // Join the media tables, storage and the design's reads to the media code; the database tests and the end-to-end test cover them.
        "lib/media/service.ts",
        "lib/media/design.ts",
        // Joins the request to the session, the settings, the library and the credits; the database and end-to-end tests cover it.
        "lib/pattern-service/server.ts",
        // Joins the comment tables and functions to the routes; the database tests and the end-to-end test of comments cover it.
        "lib/comments/service.ts",
        // Two lines joining the package to the tech pack generator and to the environment; nothing
        // calls either yet (decision 0070), and the generator has its own tests.
        "lib/kpp/sources/techpack.ts",
        // Joins the production package to the design, the catalogue, the factory rows, the brand's print settings,
        // the drafter and the print builder, and holds no rules of its own: `input/**`, `sources/rows.ts` and
        // `sources/print.ts` have those and are tested, and the route test and the end-to-end tests cover the
        // joining (plan v5 X5/X5b, decision 0070 revision 3).
        "lib/kpp/sources/server.ts",
        // One line each joining the files-service seam to the environment; `filesServiceFrom` has its own tests
        // and there is no service to call (decision 0070, plan v5 X5b).
        "lib/files-service/server.ts",
        // Joins the screens to the database, the configured model and the meter; the database and end-to-end tests cover it.
        "lib/moderation/server.ts",
        // Joins the factory tables to the server's own client and holds the one service of the process; the
        // database tests and the ops page cover it (plan v5 X6, decision 0071).
        "lib/factory/server.ts",
        // Joins the factory's job packet to the database, storage and the ops file builders; the database and end-to-end tests cover it.
        "lib/job-packet/server.ts",
        // Join the studio home and the catalogue to the database: one gathers the home's reads, the other hands the
        // catalogue's price book the server's own client. Both hold no logic of their own; the database and
        // end-to-end tests cover them (plan v5 Y1, decision 0074).
        "lib/home/load.ts",
        "lib/home/reads.ts",
        // Join the inspiration board to the environment, the session, the providers and the database; the database
        // tests and the panel cover them (plan v5 Z1, decision 0082).
        "lib/inspiration/server.ts",
        "lib/inspiration/store.ts",
        // Joins the make pages to the design, the article, the golden samples and the factory rows; the rules it
        // calls are tested on their own, and the database and end-to-end tests cover the joining (plan v5 Y7).
        "lib/make/server.ts",
        // Join the benchmark screens to the outside world: one gathers the comparison, the catalogue and the design's
        // own shape, the other hands over the database, the configured model, the usage meter and the limiter. Every
        // rule they hand over is tested on its own, and the database and end-to-end tests cover the joining (plan v5
        // Z3, decision 0084).
        "lib/benchmarks/load.ts",
        "lib/benchmarks/server.ts",
        // Joins the invite functions to the server's own client; the database tests and the end-to-end test of the
        // share popover cover it (plan v5 Y8, decision 0081).
        "lib/share/invite-service.ts",
        // Joins the collection screens to the plan, the brand's products, the factory tiers and the destination's
        // rows; the counters, the landed cost and the line plan are tested on their own, and the database and
        // end-to-end tests cover the joining (plan v5 Z4, decision 0085).
        "lib/collections/server.ts",
        // Joins the launch screens to the launch tables, the artboard presets and the brand's credits; the board
        // table, the canvas graph, the run estimate and the artboard maths are tested on their own, and the
        // database and end-to-end tests cover the joining (plan v5 L1, decision 0091).
        "lib/launch/server.ts",
        // Joins the one canvas to the launch tables and the design reads; the address, the mapping, the boxes and
        // the store are tested on their own, and the database and end-to-end tests cover the joining (plan v6 E1,
        // decision 0145).
        "lib/canvas/server.ts",
        // Joins the garment inspector to the design, catalogue, validation and price reads; `garment.ts` is tested on
        // its own and the end-to-end test of the garment inspector covers the joining (plan v6 E3, decision 0147).
        "lib/inspector/server.ts",
        // Joins the flow screens to the launch canvas, the credit ledger and the flow tables; the
        // order, the estimate, the refunds, the artwork check and the summary are tested on their
        // own, and the database and end-to-end tests cover the joining (plan v5 L6, decision 0096).
        "lib/flows/server.ts",
        // Joins the flow capabilities to the design reads, the bucket, the usage meter and the moderation
        // screen; the capabilities and the registry are tested on their own with memory ports
        // (`lib/flows/real/registry.test.ts`), and the end-to-end tests cover the joining (decision 0133).
        "lib/flows/real/server.ts",
        // Join the market panel and the translated tech pack to the outside world: one gathers the market's
        // own row and the production settings, the other reads the translation library. The tax treatment,
        // the market summary and the dictionary are tested on their own, and the database and end-to-end
        // tests cover the joining (plan v5 O3, decision 0104).
        "lib/markets/server.ts",
        "lib/translate/server.ts",
        // Joins crest-to-kit to the catalogue and the picture decoder; the pipeline it hands over is tested on
        // its own, and the route test and the end-to-end test cover the joining (plan v5 Z6, decision 0106).
        "lib/crest-to-kit/server.ts",
        // Joins a quote to the factory rows: the tiers, the cut-off and the market rules. Every rule it hands
        // over is tested on its own, and the route test and the end-to-end test cover the joining (plan v5 Z6,
        // decision 0106).
        "lib/quotes/server.ts",
        // Joins the Store contract to the brand's products, the two hand-off tables, the factory's tiers and
        // dates, the personalisation rows and the club's kit. Every rule it hands over is pure and tested on
        // its own; the database test and the route tests cover the joining (plan v5 O2, decision 0106).
        "lib/store-contract/server.ts",
        // Joins the Orders area to the factory rows; the discounts, the delivery date and the summary are tested
        // on their own, and the database and end-to-end tests cover the joining (plan v6 P5, decision 0143).
        "lib/order-desk/server.ts",
        // Joins the Tech pack and Order boards to the design, catalogue and order reads; the summaries and the
        // canvas rules are tested on their own, and the end-to-end tests cover the joining (plan v6 E4, decision 0148).
        "lib/order-boards/server.ts",
        // Join the payment tables, the processor, the order doors and the ledger (decision 0152); the rules are in
        // lib/payments' tested files, and the database and end-to-end tests cover these joins.
        "lib/payments/db.ts",
        "lib/payments/server.ts",
        "lib/payments/ops-read.ts",
        // Joins the Products pages to the catalogue's rows, the factory model and the production settings; every
        // rule it hands over is pure and tested on its own, and the end-to-end tests cover the joining (plan v6 P4,
        // decision 0142).
        "lib/products/server.ts",
        // Join the Templates, Mockups and Marketing pages to the library rows, the brand's designs and the
        // mockup renderer; the rows, categories, cards and concepts they hand over are tested on their own, and
        // the end-to-end tests cover the joining (plan v6 P2, decision 0140).
        "lib/templates/feed/server.ts",
        "lib/mockups/gallery/server.ts",
        "lib/marketing/gallery/server.ts",
        // Join the channel tables, the Shopify chosen by the environment, C1's payments, the order gates and the
        // product reads (decision 0155); every rule they hand over is tested in lib/channels' own files, and the
        // database and end-to-end tests cover these joins.
        "lib/channels/db.ts",
        "lib/channels/server.ts",
        "lib/channels/terms.ts",
        "lib/channels/exports.ts",
        "lib/channels/fulfilment.ts",
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
        // Two-click reorder from the club's order history (plan v4 W4-F, decision 0065).
        "lib/clubs/reorder/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The production package is what a factory makes the garment from (plan v5 X5, decision 0070).
        "lib/kpp/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The editor shell decides what the Form toolbar may offer, so it is held to the same mark (plan v5 Y2, decision 0075).
        "lib/editor/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "lib/files-service/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The repeat maker lays out what goes on a print file, so it is held to the same mark (plan v5 Y8, decision 0081).
        "lib/repeat/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The map from the registry's option keys to the catalogue's codes: a factory file names options by it
        // (plan v5 section 6 item 3, decision 0099).
        "lib/option-codes/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The committee link and the roster sign-up are public pages a club's own people use without an
        // account, so they are held to the same mark (plan v5 Z7, decision 0087).
        "lib/clubs/signup/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // The roster purge removes players' names on a schedule (plan v6 D5, decision 0136).
        "lib/clubs/roster-retention/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "lib/share/committee/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        ...Object.fromEntries(
          [
            "ai-studio",
            "artwork-intake",
            "artwork-stack",
            "benchmarks",
            "brand-runs",
            "brand-studio",
            "canvas",
            "catalogue",
            "channels",
            "collections",
            "colour",
            "comments",
            "compliance",
            "credits-gate",
            "crest-to-kit",
            "cutting",
            "design-diff",
            "design-import",
            "design-object",
            "designers",
            "editor-chrome",
            "fabrics",
            "factory",
            "flows",
            "gltf",
            "guardrails",
            "home",
            "inspiration",
            "job-packet",
            "launch",
            "launch-panels",
            "launch-start",
            "make",
            "marketing",
            "markets",
            "media",
            "media-check",
            "mockups",
            "moderation",
            "ops",
            "order-boards",
            "order-desk",
            "orders",
            "panel-layers",
            "parametric",
            "pattern-library",
            "pattern-service",
            "payments",
            "pickers",
            "plans",
            "print",
            "production",
            "products",
            "projects-page",
            "prompt-bar",
            "proofs",
            "quotes",
            "releases",
            "rulebook",
            "settings",
            "shell",
            "shoots",
            "store-contract",
            "team",
            "teamwear",
            "templates",
            "translate",
            "validation",
            "variants",
          
          ].map((dir) => [
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
