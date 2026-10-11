import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { signupConsentData } from "@/lib/consent/consent";
import { loadMarketingEvents, setMarketingChoice, unsubscribe } from "@/lib/consent/service";
import { signUnsubscribe, unsubscribeKey } from "@/lib/consent/unsubscribe-token";
import { MARKETING_OPT_IN, MARKETING_UNSUBSCRIBE, WORDINGS } from "@/lib/consent/wording";
import { adminClient, anonClient, CAPTCHA_TOKEN, must, person, uniqueEmail, type Person } from "./support";

/**
 * Consent to marketing email (decision 0025, migration 20261011020000): records are a person's
 * own, only the server adds one, and none is ever changed or removed. The isolation suite holds
 * the general rules for the table; this file holds the rest.
 */

type Event = { user_id: string; granted: boolean; source: string; wording: string; wording_version: string };

const eventsOf = async (userId: string): Promise<Event[]> =>
  must(
    await adminClient()
      .from("consent_events")
      .select("user_id, granted, source, wording, wording_version")
      .eq("user_id", userId)
      .order("created_at"),
  ) as Event[];

const record = (userId: string, granted: boolean, version: string, source: string) =>
  adminClient().rpc("record_consent", {
    p_user_id: userId,
    p_purpose: "marketing_email",
    p_granted: granted,
    p_wording_version: version,
    p_source: source,
  });

const KEY = unsubscribeKey("integration-test-secret");

let ada: Person;
let ben: Person;

beforeAll(async () => {
  [ada, ben] = await Promise.all([person("consent-ada"), person("consent-ben")]);
});

describe("record_consent", () => {
  it("records a choice with the words from the database, not the caller's", async () => {
    const someone = await person("consent-words");
    expect(must(await record(someone.userId, true, MARKETING_OPT_IN.version, "settings"))).toBe(true);

    expect(await eventsOf(someone.userId)).toEqual([
      { user_id: someone.userId, granted: true, source: "settings", wording: MARKETING_OPT_IN.text, wording_version: MARKETING_OPT_IN.version },
    ]);
  });

  it("cannot be run by a browser, signed in or not", async () => {
    for (const client of [anonClient(), ada.client]) {
      const { error } = await client.rpc("record_consent", {
        p_user_id: ada.userId,
        p_purpose: "marketing_email",
        p_granted: true,
        p_wording_version: MARKETING_OPT_IN.version,
        p_source: "settings",
      });
      expect(error).not.toBeNull();
    }
    expect(await eventsOf(ada.userId)).toEqual([]);
  });

  it("refuses words it does not know, or words for another purpose", async () => {
    expect((await record(ben.userId, true, "marketing-email-v999", "settings")).error).not.toBeNull();
    expect((await record(ben.userId, true, "logo-rights-v1", "settings")).error).not.toBeNull();
  });

  it("lets the unsubscribe words and an unsubscribe link only ever say no", async () => {
    expect((await record(ben.userId, true, MARKETING_UNSUBSCRIBE.version, "settings")).error).not.toBeNull();
    expect((await record(ben.userId, true, MARKETING_OPT_IN.version, "unsubscribe")).error).not.toBeNull();
    expect(await eventsOf(ben.userId)).toEqual([]);
  });

  it("records a sign-up choice only for someone never asked before", async () => {
    const someone = await person("consent-signup-once");
    expect(must(await record(someone.userId, true, MARKETING_OPT_IN.version, "sign-up"))).toBe(true);
    expect(must(await record(someone.userId, false, MARKETING_OPT_IN.version, "sign-up"))).toBe(false);
    expect((await eventsOf(someone.userId)).map((event) => event.granted)).toEqual([true]);
  });

  it("writes nothing, and fails nothing, for a person who does not exist", async () => {
    expect(must(await record(randomUUID(), false, MARKETING_UNSUBSCRIBE.version, "unsubscribe"))).toBe(false);
  });
});

describe("the records themselves", () => {
  it("show a person only their own choices", async () => {
    must(await record(ben.userId, true, MARKETING_OPT_IN.version, "settings"));

    expect(await loadMarketingEvents(ada.client)).toEqual([]);
    expect((await loadMarketingEvents(ben.client)).map((event) => event.granted)).toEqual([true]);
  });

  it("cannot be changed or removed, even with the server's own key", async () => {
    const someone = await person("consent-locked");
    must(await record(someone.userId, true, MARKETING_OPT_IN.version, "settings"));

    expect((await adminClient().from("consent_events").update({ granted: false }).eq("user_id", someone.userId)).error).not.toBeNull();
    expect((await adminClient().from("consent_events").delete().eq("user_id", someone.userId)).error).not.toBeNull();
    expect((await eventsOf(someone.userId)).map((event) => event.granted)).toEqual([true]);
  });

  it("go when the account is deleted", async () => {
    const someone = await person("consent-deleted");
    must(await record(someone.userId, true, MARKETING_OPT_IN.version, "settings"));

    const deleted = await adminClient().auth.admin.deleteUser(someone.userId);
    expect(deleted.error).toBeNull();
    expect(await eventsOf(someone.userId)).toEqual([]);
  });
});

describe("the choice made at sign-up by email", () => {
  const signUpWith = async (data: Record<string, unknown>): Promise<string> => {
    const email = uniqueEmail("consent-otp");
    must(await adminClient().rpc("allow_signup_email", { p_email: email, p_note: "test" }));
    const { error } = await anonClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data, captchaToken: CAPTCHA_TOKEN },
    });
    if (error) throw new Error(error.message);
    const { data: users } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = users.users.find((entry) => entry.email === email);
    if (!user) throw new Error("No account was made.");
    return user.id;
  };

  it("is recorded when the account is made, as a yes or a no", async () => {
    const yes = await signUpWith(signupConsentData(true));
    const no = await signUpWith(signupConsentData(false));

    expect(await eventsOf(yes)).toEqual([
      { user_id: yes, granted: true, source: "sign-up", wording: MARKETING_OPT_IN.text, wording_version: MARKETING_OPT_IN.version },
    ]);
    expect((await eventsOf(no)).map((event) => [event.granted, event.source])).toEqual([[false, "sign-up"]]);
  });

  it("is ignored, never refused, when it is missing, malformed or names unknown words", async () => {
    for (const data of [{}, { marketing_email: "yes" }, { marketing_email: { granted: "true", version: MARKETING_OPT_IN.version } }, { marketing_email: { granted: true, version: MARKETING_UNSUBSCRIBE.version } }, { marketing_email: { granted: true, version: "made-up" } }]) {
      expect(await eventsOf(await signUpWith(data))).toEqual([]);
    }
  });
});

describe("Settings", () => {
  it("records a change and nothing when the answer is the same", async () => {
    const someone = await person("consent-settings");
    const change = (granted: boolean) => setMarketingChoice({ client: someone.client, admin: adminClient(), userId: someone.userId, granted });

    expect(await change(true)).toBe(true);
    expect(await change(true)).toBe(false);
    expect(await change(false)).toBe(true);
    expect((await eventsOf(someone.userId)).map((event) => [event.granted, event.source])).toEqual([
      [true, "settings"],
      [false, "settings"],
    ]);
  });
});

describe("unsubscribe", () => {
  it("records a withdrawal at once for the person a signed link names", async () => {
    const someone = await person("consent-unsub");
    must(await record(someone.userId, true, MARKETING_OPT_IN.version, "settings"));

    await unsubscribe({ admin: adminClient(), token: signUnsubscribe(someone.userId, KEY), key: KEY });

    const events = await eventsOf(someone.userId);
    expect(events.at(-1)).toEqual({
      user_id: someone.userId,
      granted: false,
      source: "unsubscribe",
      wording: MARKETING_UNSUBSCRIBE.text,
      wording_version: MARKETING_UNSUBSCRIBE.version,
    });
  });

  it("records nothing for a link signed with another key", async () => {
    const someone = await person("consent-forged");

    await expect(unsubscribe({ admin: adminClient(), token: signUnsubscribe(someone.userId, unsubscribeKey("other")), key: KEY })).rejects.toThrow(/could not be checked/);
    expect(await eventsOf(someone.userId)).toEqual([]);
  });

  it("succeeds for an account that has since been deleted", async () => {
    await expect(unsubscribe({ admin: adminClient(), token: signUnsubscribe(randomUUID(), KEY), key: KEY })).resolves.toBeUndefined();
  });
});

// The wording table is private, so the API cannot read it. As in append-only-owner.test.ts, this
// reads it through psql in the local database container, and is skipped without Docker.
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";
const psql = (sql: string): string | null => {
  try {
    return execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-F", "|", "-c", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
  } catch {
    return null;
  }
};
const dockerReachable = psql("select 1") !== null;

describe.skipIf(!dockerReachable)("the words in the database", () => {
  it("are the words in lib/consent/wording.ts, version for version", () => {
    const rows = (psql("select version, purpose, wording from private.consent_wordings order by version") ?? "")
      .trim()
      .split("\n")
      .map((line) => line.split("|"));

    expect(rows).toEqual([...WORDINGS].sort((a, b) => a.version.localeCompare(b.version)).map((entry) => [entry.version, entry.purpose, entry.text]));
  });

  it("can never be edited, so an old record keeps its meaning", () => {
    expect(psql("update private.consent_wordings set wording = 'Changed' where version = 'marketing-email-v1'")).toBeNull();
  });
});
