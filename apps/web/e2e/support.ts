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

/** Creates a confirmed account directly, for tests that are not about signing up. */
export const createAccount = async (label: string): Promise<string> => {
  const email = uniqueEmail(label);
  const { error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return email;
};

/** Waits for a message with this subject and returns the path of the link in it. */
export const linkFromMail = async (email: string, subject: RegExp): Promise<string> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages } = (await search.json()) as { messages: { ID: string; Subject: string }[] };
    const message = messages.find((mail) => subject.test(mail.Subject));
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

/**
 * Waits until the bot check has passed, which is when the form can be sent. After a
 * failed attempt the form asks for a new check, so this waits for that one.
 */
export const passBotCheck = async (page: Page): Promise<void> => {
  await expect(page.getByRole("main").locator('button[type="submit"]')).toBeEnabled({
    timeout: 30_000,
  });
};

export const signIn = async (page: Page, email: string, password = PASSWORD): Promise<void> => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await passBotCheck(page);
  await page.getByRole("button", { name: "Sign in" }).click();
};
