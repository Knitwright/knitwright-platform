import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { allowanceMonth } from "@/lib/usage/period";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Usage metering. Plan step 10, tasks 2 to 4, and acceptance criterion M6: AI spend per
 * user, per brand and in total is capped, and the cap holds under parallel requests.
 */

type Reserved = Readonly<{
  ok: boolean;
  event_id?: string;
  refused?: "user" | "brand" | "global";
  global_spent: number;
  alerts: string[];
}>;

const HUGE = 1_000_000_000_000;

type Reserve = Partial<{
  feature: "ai" | "photoreal";
  cost: number;
  userAllowance: number;
  brandAllowance: number;
  ceiling: number;
}>;

const reserve = async (who: Person, brandId: string, options: Reserve = {}): Promise<Reserved> =>
  must(
    await adminClient().rpc("usage_reserve", {
      p_user_id: who.userId,
      p_brand_id: brandId,
      p_feature: options.feature ?? "ai",
      p_cost: options.cost ?? 1,
      p_route: "POST /api/test",
      p_user_allowance: options.userAllowance ?? HUGE,
      p_brand_allowance: options.brandAllowance ?? HUGE,
      p_global_ceiling: options.ceiling ?? HUGE,
    }),
  ) as Reserved;

const refund = async (eventId: string): Promise<boolean> =>
  must(await adminClient().rpc("usage_refund", { p_event_id: eventId })) as boolean;

const setLimit = async (
  subject: "user" | "brand",
  id: string,
  feature: "ai" | "photoreal",
  allowance: number | null,
) =>
  must(
    await adminClient().rpc("usage_set_limit", {
      p_subject: subject,
      p_subject_id: id,
      p_feature: feature,
      p_monthly_allowance: allowance,
    }),
  );

/** A fresh person with a fresh brand, so no counter is shared with another test. */
const newcomer = async (label: string): Promise<{ who: Person; brand: string }> => {
  const who = await person(label);
  return { who, brand: await brandOf(who, `${label} brand`) };
};

describe("usage_reserve", () => {
  let who: Person;
  let brand: string;

  beforeAll(async () => {
    ({ who, brand } = await newcomer("meter"));
  });

  it("succeeds exactly 10 times when 100 reservations race for an allowance of 10", async () => {
    const { who: racer, brand: racerBrand } = await newcomer("racer");

    const results = await Promise.all(
      Array.from({ length: 100 }, () => reserve(racer, racerBrand, { userAllowance: 10 })),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(10);
    expect(results.filter((result) => !result.ok).every((r) => r.refused === "user")).toBe(true);
    const events = must(
      await adminClient().from("usage_events").select("id").eq("user_id", racer.userId),
    );
    expect(events).toHaveLength(10);
  });

  it("refuses a user over their allowance, and names the user as the reason", async () => {
    const { who: one, brand: oneBrand } = await newcomer("user-cap");

    expect((await reserve(one, oneBrand, { cost: 3, userAllowance: 5 })).ok).toBe(true);
    const refused = await reserve(one, oneBrand, { cost: 3, userAllowance: 5 });

    expect(refused).toMatchObject({ ok: false, refused: "user" });
  });

  it("refuses a brand over its allowance, whichever member spends", async () => {
    const { who: owner, brand: shared } = await newcomer("brand-cap");

    expect((await reserve(owner, shared, { cost: 4, brandAllowance: 5 })).ok).toBe(true);
    expect(await reserve(owner, shared, { cost: 2, brandAllowance: 5 })).toMatchObject({
      ok: false,
      refused: "brand",
    });
  });

  it("keeps photoreal images in an allowance of their own", async () => {
    const { who: one, brand: oneBrand } = await newcomer("photo");

    expect((await reserve(one, oneBrand, { cost: 5, userAllowance: 5 })).ok).toBe(true);
    expect((await reserve(one, oneBrand, { cost: 1, userAllowance: 5 })).ok).toBe(false);
    expect(
      (await reserve(one, oneBrand, { feature: "photoreal", cost: 5, userAllowance: 5 })).ok,
    ).toBe(true);
    expect(
      (await reserve(one, oneBrand, { feature: "photoreal", cost: 1, userAllowance: 5 })).ok,
    ).toBe(false);
  });

  it("refuses everyone once the day's total reaches the safety ceiling", async () => {
    const first = await reserve(who, brand);
    const ceiling = first.global_spent;

    expect(await reserve(who, brand, { ceiling })).toMatchObject({ ok: false, refused: "global" });
  });

  it("raises the half alert once when the total crosses half the ceiling", async () => {
    const spent = (await reserve(who, brand)).global_spent;
    const ceiling = 2 * spent + 2 + Math.floor(Math.random() * 1000) * 2;
    const toHalf = ceiling / 2 - spent;

    const crossing = await reserve(who, brand, { cost: toHalf, ceiling });
    const after = await reserve(who, brand, { ceiling });

    expect(crossing.ok).toBe(true);
    expect(crossing.alerts).toEqual(["half"]);
    expect(after.alerts).toEqual([]);
  });

  it("raises the full alert once when the ceiling is reached or refuses a call", async () => {
    const spent = (await reserve(who, brand)).global_spent;
    const ceiling = spent + 1 + Math.floor(Math.random() * 1000);
    const toFull = ceiling - spent;

    const reaching = await reserve(who, brand, { cost: toFull, ceiling });
    const refused = await reserve(who, brand, { ceiling });

    expect(reaching.ok).toBe(true);
    expect(reaching.alerts).toEqual(["half", "full"]);
    expect(refused).toMatchObject({ ok: false, refused: "global", alerts: [] });
  });

  it("uses a limit stored for the user or the brand in place of the configured one", async () => {
    const { who: one, brand: oneBrand } = await newcomer("override");
    await setLimit("user", one.userId, "ai", 2);

    expect((await reserve(one, oneBrand, { cost: 2, userAllowance: 100 })).ok).toBe(true);
    expect(await reserve(one, oneBrand, { cost: 1, userAllowance: 100 })).toMatchObject({
      ok: false,
      refused: "user",
    });

    await setLimit("user", one.userId, "ai", null);
    await setLimit("brand", oneBrand, "ai", 3);
    expect(await reserve(one, oneBrand, { cost: 2, userAllowance: 100 })).toMatchObject({
      ok: false,
      refused: "brand",
    });
  });

  it("refuses a brand the user does not belong to", async () => {
    const { brand: theirs } = await newcomer("stranger");

    const { error } = await adminClient().rpc("usage_reserve", {
      p_user_id: who.userId,
      p_brand_id: theirs,
      p_feature: "ai",
      p_cost: 1,
      p_route: "POST /api/test",
      p_user_allowance: HUGE,
      p_brand_allowance: HUGE,
      p_global_ceiling: HUGE,
    });

    expect(error).not.toBeNull();
  });

  it("rejects a cost that is not positive and a feature it does not know", async () => {
    const bad = [
      { p_feature: "ai", p_cost: 0 },
      { p_feature: "ai", p_cost: -5 },
      { p_feature: "video", p_cost: 1 },
    ];
    for (const fields of bad) {
      const { error } = await adminClient().rpc("usage_reserve", {
        p_user_id: who.userId,
        p_brand_id: brand,
        p_route: "POST /api/test",
        p_user_allowance: HUGE,
        p_brand_allowance: HUGE,
        p_global_ceiling: HUGE,
        ...fields,
      });
      expect(error).not.toBeNull();
    }
  });
});

describe("usage_refund", () => {
  it("gives the cost back once, so the allowance can be spent again", async () => {
    const { who, brand } = await newcomer("refund");
    const spent = await reserve(who, brand, { cost: 5, userAllowance: 5 });
    expect((await reserve(who, brand, { cost: 5, userAllowance: 5 })).ok).toBe(false);

    expect(await refund(spent.event_id as string)).toBe(true);
    expect(await refund(spent.event_id as string)).toBe(false);

    expect((await reserve(who, brand, { cost: 5, userAllowance: 5 })).ok).toBe(true);
    expect((await reserve(who, brand, { cost: 1, userAllowance: 5 })).ok).toBe(false);
    const event = must(
      await adminClient()
        .from("usage_events")
        .select("refunded_at")
        .eq("id", spent.event_id as string)
        .single(),
    );
    expect(event.refunded_at).not.toBeNull();
  });
});

describe("who may call the meter", () => {
  let who: Person;
  let brand: string;

  beforeAll(async () => {
    ({ who, brand } = await newcomer("caller"));
  });

  it("lets no browser reserve, refund or set a limit", async () => {
    for (const client of [anonClient(), who.client]) {
      const reserved = await client.rpc("usage_reserve", {
        p_user_id: who.userId,
        p_brand_id: brand,
        p_feature: "ai",
        p_cost: 1,
        p_route: "POST /api/test",
        p_user_allowance: HUGE,
        p_brand_allowance: HUGE,
        p_global_ceiling: HUGE,
      });
      const limited = await client.rpc("usage_set_limit", {
        p_subject: "user",
        p_subject_id: who.userId,
        p_feature: "ai",
        p_monthly_allowance: HUGE,
      });
      const refunded = await client.rpc("usage_refund", {
        p_event_id: "00000000-0000-0000-0000-000000000000",
      });
      expect([reserved.error, limited.error, refunded.error].every(Boolean)).toBe(true);
    }
  });

  it("keeps the running totals out of reach of the API", async () => {
    expect((await who.client.from("usage_counters").select("*")).error).not.toBeNull();
  });

  it("shows a member their own allowance, but lets them not change it", async () => {
    await setLimit("user", who.userId, "photoreal", 7);
    await setLimit("brand", brand, "photoreal", 9);

    await who.client.from("usage_limits").update({ monthly_allowance: HUGE }).eq("brand_id", brand);
    await who.client
      .from("usage_limits")
      .update({ monthly_allowance: HUGE })
      .eq("user_id", who.userId);

    const seen = must(
      await who.client.from("usage_limits").select("feature, monthly_allowance, user_id, brand_id"),
    );
    expect(seen.map((row) => row.monthly_allowance).sort()).toEqual([7, 9]);
  });
});

// The running totals live in the private schema, out of the API's reach, so these tests
// read and set them through the database container, as the deletion tests do.
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

const psql = (sql: string): string =>
  execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  }).trim();

const dockerReachable = (() => {
  try {
    psql("select 1");
    return true;
  } catch {
    return false;
  }
})();

/** Owner decision 2026-09-30: allowances start again each calendar month (UTC). */
describe("monthly allowances", () => {
  it("counts a call in the calendar month, and the safety ceiling in the day", async () => {
    const { who: one, brand: oneBrand } = await newcomer("month");
    const before = new Date();

    const reserved = await reserve(one, oneBrand, { cost: 2 });

    const [event] = must(
      await adminClient().from("usage_events").select("day, period").eq("id", reserved.event_id ?? ""),
    ) as { day: string; period: string }[];
    expect(event.period).toBe(allowanceMonth(before));
    expect(event.day).toBe(before.toISOString().slice(0, 10));
  });

  it.skipIf(!dockerReachable)("keeps what was spent earlier in the month, on another day", async () => {
    const { who: one, brand: oneBrand } = await newcomer("earlier");
    // What an earlier day of this month left: 9 of an allowance of 10.
    psql(
      `insert into private.usage_counters (scope, day, spent) values ` +
        `('user:${one.userId}:ai', date_trunc('month', now() at time zone 'utc')::date, 9)`,
    );

    expect((await reserve(one, oneBrand, { cost: 1, userAllowance: 10 })).ok).toBe(true);
    expect(await reserve(one, oneBrand, { cost: 1, userAllowance: 10 })).toMatchObject({
      ok: false,
      refused: "user",
    });
  });

  it.skipIf(!dockerReachable)("does not count what was spent last month", async () => {
    const { who: one, brand: oneBrand } = await newcomer("lastmonth");
    psql(
      `insert into private.usage_counters (scope, day, spent) values ` +
        `('user:${one.userId}:ai', (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date, 10)`,
    );

    expect((await reserve(one, oneBrand, { cost: 10, userAllowance: 10 })).ok).toBe(true);
  });

  it.skipIf(!dockerReachable)("gives back a refund to the month's total", async () => {
    const { who: one, brand: oneBrand } = await newcomer("refund-month");
    const first = await reserve(one, oneBrand, { cost: 10, userAllowance: 10 });

    expect(await refund(first.event_id ?? "")).toBe(true);

    expect(
      psql(
        `select spent from private.usage_counters where scope = 'user:${one.userId}:ai' ` +
          `and day = date_trunc('month', now() at time zone 'utc')::date`,
      ),
    ).toBe("0");
    expect((await reserve(one, oneBrand, { cost: 10, userAllowance: 10 })).ok).toBe(true);
  });

  it.skipIf(!dockerReachable)("refunds an event counted per day, before monthly allowances, from its day", async () => {
    const { who: one, brand: oneBrand } = await newcomer("old-event");
    const today = new Date().toISOString().slice(0, 10);
    psql(
      `insert into private.usage_counters (scope, day, spent) values ('user:${one.userId}:ai', '${today}', 4) ` +
        `on conflict (scope, day) do update set spent = 4`,
    );
    const eventId = psql(
      `insert into public.usage_events (brand_id, user_id, feature, cost, day, route) ` +
        `values ('${oneBrand}', '${one.userId}', 'ai', 4, '${today}', 'POST /api/old') returning id`,
    ).split(/\s+/)[0];

    expect(await refund(eventId)).toBe(true);
    expect(psql(`select spent from private.usage_counters where scope = 'user:${one.userId}:ai' and day = '${today}'`)).toBe("0");
  });
});
