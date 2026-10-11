import { describe, expect, it } from "vitest";
import { createSpec, type GarmentSpec } from "@/lib/garment";
import { namedNotOffered, withinLaunch } from "./launch-scope";
import type { IntentOutcome } from "./outcome";

function spec(typeId: string): GarmentSpec {
  const made = createSpec(typeId, "women");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

const toType = (typeId: string) => ({ type: "change-type", typeId }) as const;
const keep = { label: "Keep it", actions: [] };

describe("namedNotOffered", () => {
  it("answers words that name a garment not offered yet", () => {
    expect(namedNotOffered("make it leggings")).toBe("Not offered yet: Leggings. Nothing was changed.");
    expect(namedNotOffered("a compression top for women")).toBe("Not offered yet: Compression top. Nothing was changed.");
  });

  it("is quiet for offered garments, refused ones, and the design's own type", () => {
    expect(namedNotOffered("make it a polo")).toBeNull();
    expect(namedNotOffered("a singlet, not a sports bra")).toBeNull();
    expect(namedNotOffered("make the leggings slim", spec("leggings"))).toBeNull();
  });
});

describe("withinLaunch", () => {
  it("refuses a change or a proposal that makes a garment not offered yet", () => {
    const applied = { kind: "applied", spec: spec("singlet"), actions: [toType("sports-bra")], explanations: ["x"], notes: [] } as IntentOutcome;
    expect(withinLaunch(applied, spec("singlet"))).toEqual({ kind: "rejection", reason: "Not offered yet: Sports bra. Nothing was changed." });
    const proposal = { kind: "proposal", actions: [toType("leggings")] } as const;
    expect(withinLaunch(proposal, spec("crew-tee"))).toMatchObject({ kind: "rejection" });
  });

  it("keeps a change to an offered garment as it is", () => {
    const applied = { kind: "applied", spec: spec("vest"), actions: [toType("vest")], explanations: ["x"], notes: [] } as IntentOutcome;
    expect(withinLaunch(applied, spec("singlet"))).toBe(applied);
  });

  it("takes those choices out of a question, and gives the reason when fewer than two are left", () => {
    const three: IntentOutcome = {
      kind: "question",
      question: "Change the garment type?",
      choices: [{ label: "Sports bra", actions: [toType("sports-bra")] }, { label: "Vest", actions: [toType("vest")] }, keep],
      recommended: 0,
    };
    expect(withinLaunch(three, spec("singlet"))).toEqual({ ...three, choices: [three.choices[1], keep], recommended: 0 });
    const two: IntentOutcome = { ...three, choices: [three.choices[0], keep] };
    expect(withinLaunch(two, spec("singlet"))).toEqual({ kind: "rejection", reason: "Not offered yet: Sports bra. Nothing was changed." });
  });
});
