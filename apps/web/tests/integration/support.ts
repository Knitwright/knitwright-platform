import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers for tests that run against local Supabase. Start it with `pnpm db:start`
 * from the repository root before running `pnpm test:db`.
 */

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Integration tests need local Supabase: run "pnpm db:start" and copy the keys it prints into apps/web/.env.local.`,
    );
  }
  return value;
};

const options = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Full access. Stands in for the server's own client. */
export const adminClient = (): SupabaseClient =>
  createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), options);

/** What a browser with no session can reach. */
export const anonClient = (): SupabaseClient =>
  createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    options,
  );

/** Any token passes locally, because the local stack uses Cloudflare's test secret. */
export const CAPTCHA_TOKEN = "local-test-token";

export const PASSWORD = "correct-horse-battery";

export const uniqueEmail = (label = "user"): string =>
  `${label}-${randomUUID()}@test.knitwright.local`;

export const uniqueKey = (label = "key"): string => `${label}:${randomUUID()}`;

/** The data of a call that must not fail. */
export const must = <T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> => {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
};

/** Signs up through the public API, as a browser would. Returns the error message, if any. */
export const signUp = async (email: string): Promise<string | null> => {
  const { error } = await anonClient().auth.signUp({
    email,
    password: PASSWORD,
    options: { captchaToken: CAPTCHA_TOKEN },
  });
  return error ? error.message : null;
};

export const userExists = async (email: string): Promise<boolean> => {
  const { data, error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users.some((user) => user.email === email);
};

/**
 * Creates a confirmed account with PASSWORD, as the server may. The password is set in
 * a second step: confirmation removes any password an account already carried.
 */
export const createConfirmedUser = async (label: string): Promise<string> => {
  const email = uniqueEmail(label);
  const created = await adminClient().auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  const updated = await adminClient().auth.admin.updateUserById(created.data.user.id, {
    password: PASSWORD,
  });
  if (updated.error) throw new Error(updated.error.message);
  return email;
};

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailSummary = Readonly<{ ID: string; Subject: string }>;

/** Every message the local mail catcher holds for an address, newest first. */
export const mailFor = async (email: string): Promise<MailSummary[]> => {
  const response = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!response.ok) throw new Error(`Mail catcher answered ${response.status}`);
  const body = (await response.json()) as { messages: MailSummary[] };
  return body.messages;
};

/** Waits for a message with this subject and returns the link in it. */
export const linkFromMail = async (email: string, subject: RegExp): Promise<URL> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const message = (await mailFor(email)).find((mail) => subject.test(mail.Subject));
    if (message) {
      const response = await fetch(`${MAILPIT}/api/v1/message/${message.ID}`);
      const { HTML } = (await response.json()) as { HTML: string };
      const href = /href="([^"]*token_hash=[^"]*)"/.exec(HTML)?.[1];
      if (!href) throw new Error("The message holds no confirmation link.");
      return new URL(href.replaceAll("&amp;", "&"));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No message matching ${subject} arrived for ${email}.`);
};

type StoredCookie = Readonly<{ value: string; options: Readonly<Record<string, unknown>> }>;

/** Keeps a session in memory, as a browser's cookies would. */
export const cookieJar = () => {
  const jar = new Map<string, StoredCookie>();
  return {
    getAll: () => [...jar].map(([name, { value }]) => ({ name, value })),
    setAll: (
      cookies: readonly { name: string; value: string; options?: Record<string, unknown> }[],
    ) => {
      for (const { name, value, options = {} } of cookies) {
        if (value) jar.set(name, { value, options });
        else jar.delete(name);
      }
    },
    size: () => jar.size,
    /** How each cookie was set: whether scripts can read it, and so on. */
    options: () => [...jar.values()].map((cookie) => cookie.options),
  };
};

export const settings = (siteUrl = "http://localhost:3000") => ({
  NEXT_PUBLIC_SITE_URL: siteUrl,
  NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  SUPABASE_SECRET_KEY: required("SUPABASE_SECRET_KEY"),
});

export type Person = Readonly<{
  email: string;
  userId: string;
  /** Acts as this person, as their browser would. Row level security applies. */
  client: SupabaseClient;
}>;

/** A confirmed, signed-in person with no brands yet. */
export const person = async (label: string): Promise<Person> => {
  const email = await createConfirmedUser(label);
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
    options: { captchaToken: CAPTCHA_TOKEN },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Sign-in returned no user.");
  return { email, userId: data.user.id, client };
};

/** Creates a brand as this person and returns its id. */
export const brandOf = async (owner: Person, name: string): Promise<string> =>
  must(await owner.client.rpc("create_brand", { p_name: name }));
