#!/usr/bin/env node
// Writes the local Supabase address and keys into apps/web/.env.local.
// Lines for other variables are kept as they are. Run by `pnpm db:start`.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "apps/web/.env.local");

const parse = (text) =>
  Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
      .filter(Boolean)
      .map(([, name, value]) => [name, value.replace(/^"(.*)"$/, "$1")]),
  );

const status = parse(
  execSync("pnpm exec supabase status -o env", {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);

for (const name of ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"]) {
  if (!status[name]) {
    throw new Error(`Local Supabase did not report ${name}. Is it running? Try "pnpm db:start".`);
  }
}

const managed = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
};

const defaults = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  // Cloudflare's published test key. It always passes.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  // Locally no host writes the caller's address, so tests send this header themselves.
  CLIENT_ADDRESS_HEADER: "x-real-ip",
};

const existing = existsSync(target) ? readFileSync(target, "utf8").split(/\r?\n/) : [];
const present = new Set(Object.keys(parse(existing.join("\n"))));

const kept = existing
  .filter((line) => !(line.split("=")[0].trim() in managed))
  .join("\n")
  .trimEnd();

const added = [
  ...Object.entries(defaults).filter(([name]) => !present.has(name)),
  ...Object.entries(managed),
].map(([name, value]) => `${name}=${value}`);

writeFileSync(target, `${[kept, ...added].filter(Boolean).join("\n")}\n`, "utf8");
process.stdout.write(`Wrote ${Object.keys(managed).join(", ")} to apps/web/.env.local\n`);
