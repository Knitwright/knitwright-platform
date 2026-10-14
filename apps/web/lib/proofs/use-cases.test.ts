import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { decide, sign } from "./use-cases";

const WHO = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-16T08:00:00Z");
const sent = (calls: { steps: readonly (readonly [string, readonly unknown[]])[] }[], at: number) => calls[at]?.steps[0]?.[1][0] as Record<string, unknown>;

describe("decide", () => {
  it("dates the decision today when no date was typed", async () => {
    const { client, calls } = fakeClient({ decide_strike_off: {} });
    await decide(client, WHO, ID, { accept: true, name: "Ana", role: "Print lead", note: "" }, NOW);
    expect(sent(calls, 0)).toMatchObject({ p_on: "2026-10-16", p_accept: true, p_name: "Ana", p_role: "Print lead" });
  });
  it("keeps a typed date", async () => {
    const { client, calls } = fakeClient({ decide_strike_off: {} });
    await decide(client, WHO, ID, { accept: false, name: "Ana", role: "Club", on: "2026-10-10", note: "colour off" }, NOW);
    expect(sent(calls, 0)).toMatchObject({ p_on: "2026-10-10", p_accept: false, p_note: "colour off" });
  });
});

describe("sign", () => {
  it("dates the signature today when no date was typed", async () => {
    const { client, calls } = fakeClient({ add_sign_off: { data: ID } });
    expect(await sign(client, WHO, ID, { role: "club", name: "Bo", note: "" }, NOW)).toBe(ID);
    expect(sent(calls, 0)).toMatchObject({ p_signed_on: "2026-10-16", p_role: "club" });
  });
});
