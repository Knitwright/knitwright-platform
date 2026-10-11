import { randomUUID } from "node:crypto";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Helpers for end-to-end tests. They need local Supabase: `pnpm db:start`. */

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run "pnpm db:start" first.`);
  return value;
};

const admin = () =>
  createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const upTo = (max: number): number => Math.floor(Math.random() * max);

const randomAddress = (): string => `10.${upTo(256)}.${upTo(256)}.${1 + upTo(254)}`;

/** Cloudflare's published always-pass test site key and the token its widget produces. */
const TEST_SITE_KEY = "1x00000000000000000000AA";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/**
 * Stands in for Cloudflare's widget script in the browser. With the test site key the
 * real widget only ever hands out the dummy token, but it takes 2 to 8 seconds of round
 * trips to Cloudflare to do so, and sometimes more than 30. This hands out the same token
 * at once. The server still sends it to Cloudflare, with the test secret, as it would in
 * production. Any other site key fails, so a wrong key still shows up in the tests.
 */
const WIDGET_STAND_IN = `(() => {
  const widgets = new Map();
  let next = 0;
  window.turnstile = {
    render(container, options) {
      const id = "stand-in-" + (next += 1);
      if (options.sitekey !== ${JSON.stringify(TEST_SITE_KEY)}) {
        setTimeout(() => options["error-callback"] && options["error-callback"]("110100"), 0);
        return id;
      }
      const field = document.createElement("input");
      field.type = "hidden";
      field.name = options["response-field-name"] || "cf-turnstile-response";
      field.value = ${JSON.stringify(DUMMY_TOKEN)};
      container.appendChild(field);
      widgets.set(id, field);
      setTimeout(() => options.callback && options.callback(field.value), 0);
      return id;
    },
    remove(id) {
      widgets.get(id)?.remove();
      widgets.delete(id);
    },
  };
})();`;

/** Serves WIDGET_STAND_IN to every page of a context. A route set on a page wins over it. */
export const standInForBotCheck = async (context: BrowserContext): Promise<void> => {
  await context.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: WIDGET_STAND_IN }),
  );
};

type Fixtures = Readonly<{ ownAddress: void; realBotCheck: boolean; botCheck: void }>;

/**
 * Each test arrives from its own address, so one test cannot use up another's rate
 * limit. Locally the app trusts this header. On the host it is overwritten.
 *
 * The bot check's browser script is replaced by WIDGET_STAND_IN unless a test sets
 * `test.use({ realBotCheck: true })`. A context a test opens itself needs
 * `standInForBotCheck` too.
 */
export const test = base.extend<Fixtures>({
  ownAddress: [
    async ({ context }, use) => {
      await context.setExtraHTTPHeaders({ "x-real-ip": randomAddress() });
      await use();
    },
    { auto: true },
  ],
  realBotCheck: [false, { option: true }],
  botCheck: [
    async ({ context, realBotCheck }, use) => {
      if (!realBotCheck) await standInForBotCheck(context);
      await use();
    },
    { auto: true },
  ],
});

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const PASSWORD = "correct-horse-battery";

export const uniqueEmail = (label: string): string =>
  `${label}-${randomUUID()}@e2e.knitwright.local`;

/** Lets one address register while sign-up is closed, as an invitation would. */
export const invite = async (email: string): Promise<void> => {
  const { error } = await admin().rpc("allow_signup_email", { p_email: email, p_note: "e2e" });
  if (error) throw new Error(error.message);
};

/**
 * Creates a confirmed account with PASSWORD, for tests that are not about signing up.
 * The password is set in a second step: confirmation removes any password an account
 * already carried.
 */
export const createAccount = async (
  label: string,
  options: { brand?: string | null } = {},
): Promise<string> => {
  const email = uniqueEmail(label);
  const created = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  const userId = created.data.user.id;
  const updated = await admin().auth.admin.updateUserById(userId, {
    password: PASSWORD,
    app_metadata: { password_set: true },
  });
  if (updated.error) throw new Error(updated.error.message);

  // Most tests are about someone who is already set up, so they get a brand.
  const brand = options.brand === undefined ? `${label} brand` : options.brand;
  if (brand !== null) await createBrandFor(userId, brand);
  return email;
};

/** Gives a user a brand directly, as the server may. Returns the brand id. */
export const createBrandFor = async (userId: string, name: string): Promise<string> => {
  const brand = await admin()
    .from("brands")
    .insert({ name, created_by: userId })
    .select("id")
    .single();
  if (brand.error) throw new Error(brand.error.message);
  const membership = await admin()
    .from("memberships")
    .insert({ brand_id: brand.data.id, user_id: userId, role: "owner" });
  if (membership.error) throw new Error(membership.error.message);
  return brand.data.id;
};

export const accountExists = async (email: string): Promise<boolean> => {
  const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users.some((user) => user.email === email);
};

type Mail = Readonly<{ ID: string; Subject: string }>;

const mailFor = async (email: string): Promise<Mail[]> => {
  const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  if (!search.ok) throw new Error(`Mail catcher answered ${search.status}`);
  return ((await search.json()) as { messages: Mail[] }).messages;
};

export const mailCount = async (email: string): Promise<number> => (await mailFor(email)).length;

/** Waits for a message with this subject and returns the path of the link in it. */
export const linkFromMail = async (email: string, subject: RegExp): Promise<string> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const message = (await mailFor(email)).find((mail) => subject.test(mail.Subject));
    if (message) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${message.ID}`);
      const { HTML } = (await detail.json()) as { HTML: string };
      const href = /href="([^"]*token_hash=[^"]*)"/.exec(HTML)?.[1];
      if (!href) throw new Error("The message holds no link.");
      const url = new URL(href.replaceAll("&amp;", "&"));
      return `${url.pathname}${url.search}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No message matching ${subject} arrived for ${email}.`);
};

/** Waits until the bot check for the current attempt has passed. */
export const passBotCheck = async (page: Page): Promise<void> => {
  await expect(page.locator('[data-bot-check="ready"]')).toBeVisible();
};

/** The one-sentence problem at the top of a form. */
export const summary = (page: Page) => page.locator("[data-form-summary]");

export const signIn = async (page: Page, email: string, password = PASSWORD): Promise<void> => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await passBotCheck(page);
  await page.getByRole("button", { name: "Sign in" }).click();
};

export interface DownloadRecord {
  readonly spec_version: number;
  readonly format: string;
  readonly view: string | null;
  readonly user_id: string;
}

/** The downloads recorded for a design, oldest first, read with the server's own key. */
export const downloadRecords = async (projectId: string): Promise<DownloadRecord[]> => {
  const { data, error } = await admin()
    .from("export_downloads")
    .select("spec_version, format, view, user_id")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data as DownloadRecord[];
};

/** Makes an account a platform admin, as the owner does by hand in the database (decision 0024). */
export const makePlatformAdmin = async (email: string): Promise<void> => {
  const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  const user = data.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`No account for ${email}.`);
  const added = await admin().from("platform_admins").insert({ user_id: user.id });
  if (added.error) throw new Error(added.error.message);
};\n\n/** The id of the account with this address, read with the server's own key. */
export const userIdOf = async (email: string): Promise<string> => {
  const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === email);
  if (!user) throw new Error(`No account for ${email}.`);
  return user.id;
};

export interface ConsentRecord {
  readonly granted: boolean;
  readonly source: string;
  readonly wording_version: string;
}

/** A person's marketing email choices, oldest first, read with the server's own key. */
export const consentRecords = async (userId: string): Promise<ConsentRecord[]> => {
  const { data, error } = await admin()
    .from("consent_events")
    .select("granted, source, wording_version")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data as ConsentRecord[];
};
