import { describe, expect, it, vi } from "vitest";
import { createSpec } from "@/lib/garment";
import { createStubProvider } from "@/lib/providers/stub";
import { defaultFactoryProfile } from "@/lib/validation";
import { diffRequest, FAILED, NOT_SWITCHED_ON, type DiffRequestDeps } from "./request";
import { standInDiffProvider } from "./stub";

const made = createSpec("team-jersey", "men");
if (!made.ok) throw new Error(made.reason);

const deps = (provider: DiffRequestDeps["provider"], refund = vi.fn(async () => undefined)): DiffRequestDeps => ({
  spec: made.spec,
  provider,
  profile: defaultFactoryProfile(),
  sign: () => "signed-token",
  draw: (spec) => `drawing:${spec.colourways[0].colours.length}`,
  refund,
});

describe("one request for a diff", () => {
  it("previews and signs, with a drawing before and after, and saves nothing", async () => {
    const answer = await diffRequest("sleeves navy", deps(standInDiffProvider()));
    expect(answer).toMatchObject({ kind: "preview", token: "signed-token", before: "drawing:0", after: "drawing:2" });
  });

  it("refuses an unsupported request in words and keeps the cost (a model answered)", async () => {
    const refund = vi.fn(async () => undefined);
    const answer = await diffRequest("a dragon", deps(standInDiffProvider(), refund));
    expect(answer.kind).toBe("refused");
    expect(refund).not.toHaveBeenCalled();
  });

  it("gives the cost back when no model is switched on", async () => {
    const refund = vi.fn(async () => undefined);
    expect(await diffRequest("slim fit", deps(null, refund))).toEqual({ kind: "refused", reason: NOT_SWITCHED_ON });
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("gives the cost back when the model fails", async () => {
    const refund = vi.fn(async () => undefined);
    expect(await diffRequest("slim fit", deps(createStubProvider([new Error("down")]), refund))).toEqual({ kind: "refused", reason: FAILED });
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("refuses a diff the design cannot take", async () => {
    const bad = createStubProvider([JSON.stringify({ kind: "diff", diff: { kind: "change-option", optionId: "fit", choiceId: "nope" } })]);
    expect((await diffRequest("x", deps(bad))).kind).toBe("refused");
  });

  it("the stand-in reads slim fit and refuses the rest", async () => {
    expect((await diffRequest("slim fit", deps(standInDiffProvider()))).kind).toBe("preview");
    expect((await diffRequest("???", deps(standInDiffProvider()))).kind).toBe("refused");
  });
});
