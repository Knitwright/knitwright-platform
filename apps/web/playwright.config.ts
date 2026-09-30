import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Local Supabase address and keys, written by `pnpm db:start`. CI sets them directly.
const localEnvFile = join(__dirname, ".env.local");
const localEnv = existsSync(localEnvFile) ? parseEnv(readFileSync(localEnvFile, "utf8")) : {};
const env = { ...localEnv, ...process.env, NEXT_PUBLIC_SITE_URL: baseURL } as Record<
  string,
  string
>;
// The tests read the same values to reach the database and the mail catcher.
Object.assign(process.env, env);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  /*
   * Four workers on a machine with twelve logical cores: the app, the database, the mail
   * catcher and the browsers share it. In CI the runner decides.
   */
  workers: process.env.CI ? undefined : 4,
  /* A whole test may take a sign-in and several saves. */
  timeout: 60_000,
  /*
   * One wait for text, a field or a redirect. The bot check's browser script is a stand-in
   * (see e2e/support.ts), so no wait includes Cloudflare's widget, but a save or a first
   * paint can still take more than Playwright's default 5 seconds while other work shares
   * the machine.
   */
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env,
  },
});
