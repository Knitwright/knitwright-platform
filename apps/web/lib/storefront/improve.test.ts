import { describe, expect, it, vi } from "vitest";
import { createStubProvider } from "@/lib/providers/stub";
import { ModelCallError } from "@/lib/providers/text-model";
import type { UsageMeter } from "@/lib/usage/meter";
import { ALLOWANCE_USED_UP, NOT_CONNECTED, NOTHING_USABLE, UNREACHABLE, improveHash, improveListing, improvePrompt, readImprovement, type ImproveDeps, type ImproveFacts } from "./improve";

const FACTS: ImproveFacts = {
  listingId: "l1", productName: "Home shirt", title: "Home shirt", description: "Navy.", tags: ["kit"], sizes: ["S", "M"], fabric: "mesh-140",
  personalised: true, brandName: "Lions", voice: "bold, warm",
};

const REPLY = JSON.stringify({ title: "Lions Home Shirt 2027", description: "Navy with gold.\n\nNames and numbers.", tags: ["Club Kit", "lions", "club kit"] });

const ENTRY = { inputPerMillion: 3, outputPerMillion: 15 };

function deps(answers: Parameters<typeof createStubProvider>[0], over: Partial<ImproveDeps> = {}) {
  const meter = { reserve: vi.fn(async () => ({ ok: true as const, eventId: "e1" })), refund: vi.fn(async () => true) } satisfies UsageMeter;
  const spend = vi.fn(async () => ({ ok: true as const, charged: true, price: 2, balance: 98 }));
  const giveBack = vi.fn(async () => undefined);
  const provider = createStubProvider(answers);
  return { deps: { model: { provider, entry: ENTRY }, meter, spend, giveBack, who: { brandId: "b", userId: "u" }, route: "test", ...over } satisfies ImproveDeps, meter, spend, giveBack, provider };
}

describe("Improve listing", () => {
  it("hands the model the facts as data and tells it to invent none", () => {
    const prompt = improvePrompt(FACTS);
    expect(prompt.system).toContain("You invent no fact");
    expect(JSON.parse(prompt.user)).toMatchObject({ brand: { name: "Lions", voiceAndTone: "bold, warm" }, product: { sizes: ["S", "M"], fabric: "mesh-140", namesAndNumbers: true } });
    expect(JSON.parse(improvePrompt({ ...FACTS, voice: "" }).user).brand.voiceAndTone).toBeNull();
  });

  it("reads a reply, cleaned and held to each field's limit", () => {
    expect(readImprovement(REPLY)).toEqual({ title: "Lions Home Shirt 2027", description: "Navy with gold.\n\nNames and numbers.", tags: ["club kit", "lions"] });
    expect(readImprovement(`\`\`\`json\n${REPLY}\n\`\`\``)?.title).toBe("Lions Home Shirt 2027");
    expect(readImprovement(JSON.stringify({ title: "x".repeat(300), description: "d", tags: [] }))?.title).toHaveLength(140);
    expect(readImprovement("not json")).toBeNull();
    expect(readImprovement(JSON.stringify({ title: "only" }))).toBeNull();
    expect(readImprovement(JSON.stringify({ title: " ", description: "d", tags: [] }))).toBeNull();
  });

  it("keys the charge on the words, so the same words are not charged twice", () => {
    expect(improveHash(FACTS)).toBe(improveHash({ ...FACTS, sizes: ["XL"] }));
    expect(improveHash(FACTS)).not.toBe(improveHash({ ...FACTS, title: "Other" }));
  });

  it("reserves, charges, calls and answers the new words with the credits used", async () => {
    const { deps: d, spend, meter } = deps([REPLY]);
    const result = await improveListing(d, FACTS);
    expect(result).toMatchObject({ ok: true, model: "stub-model", credits: { charged: true, price: 2, balance: 98 } });
    expect(spend).toHaveBeenCalledWith(improveHash(FACTS), "e1");
    expect(meter.refund).not.toHaveBeenCalled();
  });

  it("says it is not connected without a model, and asks nothing", async () => {
    const { deps: d, meter } = deps([], { model: null });
    await expect(improveListing(d, FACTS)).resolves.toEqual({ ok: false, reason: NOT_CONNECTED });
    expect(meter.reserve).not.toHaveBeenCalled();
  });

  it("refuses when the allowance or the credits run out, charging nothing", async () => {
    const used = deps([REPLY], { meter: { reserve: vi.fn(async () => ({ ok: false as const, refused: "brand" as const })), refund: vi.fn(async () => true) } });
    await expect(improveListing(used.deps, FACTS)).resolves.toEqual({ ok: false, reason: ALLOWANCE_USED_UP });
    const broke = deps([REPLY], { spend: vi.fn(async () => ({ ok: false as const, reason: "insufficient" as const, price: 2, balance: 1 })) });
    const result = await improveListing(broke.deps, FACTS);
    expect(result).toEqual({ ok: false, reason: "Improving a listing costs 2 credits and the balance is 1. Buy credits or upgrade your plan." });
    expect(broke.meter.refund).toHaveBeenCalledWith("e1");
    expect(broke.provider.requests).toHaveLength(0);
  });

  it("gives everything back when nothing usable came, or the model could not be reached", async () => {
    const empty = deps(["no json here"]);
    await expect(improveListing(empty.deps, FACTS)).resolves.toEqual({ ok: false, reason: NOTHING_USABLE });
    expect(empty.meter.refund).toHaveBeenCalledWith("e1");
    expect(empty.giveBack).toHaveBeenCalledWith(improveHash(FACTS));

    const down = deps([new ModelCallError("down")]);
    await expect(improveListing(down.deps, FACTS)).resolves.toEqual({ ok: false, reason: UNREACHABLE });
    expect(down.giveBack).toHaveBeenCalled();

    const free = deps(["no json"], { spend: vi.fn(async () => ({ ok: true as const, charged: false, price: 2, balance: 0 })) });
    await improveListing(free.deps, FACTS);
    expect(free.giveBack).not.toHaveBeenCalled();
  });

  it("gives back and throws a fault that is not the model's", async () => {
    const bug = new TypeError("bug");
    const broken = deps([() => { throw bug; }]);
    await expect(improveListing(broken.deps, FACTS)).rejects.toBe(bug);
    expect(broken.meter.refund).toHaveBeenCalled();
  });
});
