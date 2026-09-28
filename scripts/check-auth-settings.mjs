#!/usr/bin/env node
// Checks that a Supabase project enforces what the app relies on. The settings that
// matter are made by hand in the Supabase dashboard, so nothing else verifies them.
//
//   node scripts/check-auth-settings.mjs <project url> <publishable key>
//
// It uses the publishable key only, which is what any visitor's browser holds. It
// creates nothing: every request it sends is one that must be refused.
// Run it after setting up the hosted project and after changing its settings.

const [url, key] = process.argv.slice(2);
if (!url || !key) {
  process.stderr.write("Usage: node scripts/check-auth-settings.mjs <project url> <publishable key>\n");
  process.exit(2);
}

const address = `settings-check-${crypto.randomUUID()}@example.com`;
const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

const post = async (path, body) => {
  const response = await fetch(new URL(path, url), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON. The status alone is used.
  }
  return { status: response.status, json, text };
};

const refused = ({ status }) => status >= 400 && status < 500;
const mentionsCaptcha = ({ text }) => /captcha/i.test(text);

const checks = [
  {
    name: "Sign-up without a bot check is refused",
    fix: "Turn on CAPTCHA protection with Turnstile in Authentication, Attack protection.",
    run: async () => {
      const answer = await post("/auth/v1/otp", { email: address, create_user: true });
      return refused(answer) && mentionsCaptcha(answer);
    },
  },
  {
    name: "Sign-up with a made-up bot check token is refused",
    fix: "The Turnstile secret in Supabase must be the real one, not Cloudflare's test secret.",
    run: async () => {
      const answer = await post("/auth/v1/otp", {
        email: address,
        create_user: true,
        gotrue_meta_security: { captcha_token: "made-up-token" },
      });
      return refused(answer) && mentionsCaptcha(answer);
    },
    // Locally the test secret accepts any token, so this check cannot pass there.
    skipLocally: true,
  },
  {
    name: "Sign-in without a bot check is refused",
    fix: "Turn on CAPTCHA protection with Turnstile in Authentication, Attack protection.",
    run: async () => {
      const answer = await post("/auth/v1/token?grant_type=password", {
        email: address,
        password: "not-a-real-password",
      });
      return refused(answer) && mentionsCaptcha(answer);
    },
  },
  {
    name: "A visitor cannot open sign-up",
    fix: "Apply the migrations: pnpm exec supabase db push.",
    run: async () => refused(await post("/rest/v1/rpc/set_signup_open", { p_open: true })),
  },
  {
    name: "A visitor cannot put an address on the allowed list",
    fix: "Apply the migrations: pnpm exec supabase db push.",
    run: async () =>
      refused(await post("/rest/v1/rpc/allow_signup_email", { p_email: address, p_note: "x" })),
  },
  {
    name: "A visitor cannot call the rate limiter",
    fix: "Apply the migrations: pnpm exec supabase db push.",
    run: async () =>
      refused(
        await post("/rest/v1/rpc/rate_limit_hit", {
          p_key: "settings-check",
          p_limit: 1,
          p_window_seconds: 60,
        }),
      ),
  },
  {
    name: "The sign-up switch exists and can be read",
    fix: "Apply the migrations: pnpm exec supabase db push.",
    run: async () => {
      const answer = await post("/rest/v1/rpc/signup_is_open", {});
      return answer.status === 200 && typeof answer.json === "boolean";
    },
  },
];

const isLocal = /\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
let failures = 0;

for (const check of checks) {
  if (check.skipLocally && isLocal) {
    process.stdout.write(`skip  ${check.name} (not meaningful on a local project)\n`);
    continue;
  }
  let passed = false;
  try {
    passed = await check.run();
  } catch (error) {
    process.stdout.write(`      could not run: ${error instanceof Error ? error.message : error}\n`);
  }
  process.stdout.write(`${passed ? "ok  " : "FAIL"}  ${check.name}\n`);
  if (!passed) {
    failures += 1;
    process.stdout.write(`      To fix: ${check.fix}\n`);
  }
}

process.stdout.write(
  [
    "",
    "Not checked here, because each needs a real bot check to be solved:",
    "  1. The sign-up hook. After setting it, ask for a link with a made-up address on",
    "     /sign-up, then confirm in the dashboard that no user with that address exists.",
    "  2. Anonymous sign-ins. Confirm in the dashboard that they are off.",
    "",
  ].join("\n"),
);

process.exit(failures === 0 ? 0 : 1);
