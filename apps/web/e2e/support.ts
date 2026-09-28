import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
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

/**
 * Each test arrives from its own address, so one test cannot use up another's rate
 * limit. Locally the app trusts this header. On the host it is overwritten.
 */
export const test = base.extend<{ ownAddress: void }>({
  ownAddress: [
    async ({ context }, use) => {
      await context.setExtraHTTPHeaders({ "x-real-ip": randomAddress() });
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
export const createAccount = async (label: string): Promise<string> => {
  const email = uniqueEmail(label);
  const created = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  const updated = await admin().auth.admin.updateUserById(created.data.user.id, {
    password: PASSWORD,
    app_metadata: { password_set: true },
  });
  if (updated.error) throw new Error(updated.error.message);
  return email;
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
  await expect(page.locator('[data-bot-check="ready"]')).toBeVisible({ timeout: 30_000 });
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
