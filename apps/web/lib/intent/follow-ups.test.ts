import { describe, expect, it } from "vitest";
import { applyAction, createSpec, type GarmentSpec, type SpecAction, type Wearer } from "@/lib/garment";
import { amountFollowUp, skippedFollowUp } from "./follow-ups";
import type { FollowUp, FollowUpChoice } from "./outcome";

function start(typeId: string, wearer: Wearer, ...actions: unknown[]): GarmentSpec {
  const made = createSpec(typeId, wearer);
  if (!made.ok) throw new Error(made.reason);
  return actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, made.spec);
}

const option = (optionId: string, choiceId: string) => ({ type: "set-option", optionId, choiceId, provenance: "user-edited" });
const measured = (pointId: string, value: number) => ({ type: "set-measurement", pointId, value, provenance: "user-edited" });
const vNeck = { type: "set-option", optionId: "neckline", choiceId: "v-neck" } as const;

function applyAll(spec: GarmentSpec, actions: readonly SpecAction[]): GarmentSpec {
  return actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, spec);
}

const applies = (choice: FollowUpChoice | undefined): readonly SpecAction[] => {
  if (choice?.kind !== "apply") throw new Error("Not a choice that applies changes.");
  return choice.actions;
};

/** No id is ever shown: every word a person reads is a label or plain English. */
function expectNoIds(followUp: FollowUp): void {
  for (const text of [followUp.text, ...followUp.choices.map((choice) => choice.label)]) {
    expect(text).not.toMatch(/\b(?:band-collar|polo-collar|v-neck|team-jersey|v-neck-tee|sleeve-length|none)\b/);
  }
}

describe("a choice that clashes with another", () => {
  it("says why in plain words and offers one tap that makes both changes", () => {
    const spec = start("team-jersey", "men", option("collar", "band-collar"));
    const followUp = skippedFollowUp(spec, { wire: vNeck, reason: "unused" });
    expect(followUp.text).toMatch(/band collar stands up all the way round the neck/i);
    expect(followUp.choices.map((choice) => choice.label)).toEqual(["Switch to V neck (no collar)"]);
    const after = applyAll(spec, applies(followUp.choices[0]));
    expect(after.options.neckline.choiceId).toBe("v-neck");
    expect(after.options.collar.choiceId).toBe("none");
    expectNoIds(followUp);
  });
});

describe("a choice the garment does not come with", () => {
  it("names the garments that do, each one tap that makes the change", () => {
    const spec = start("polo", "women", option("sleeve-length", "long"));
    const followUp = skippedFollowUp(spec, { wire: vNeck, reason: "unused" });
    expect(followUp.text).toBe("A Polo shirt does not come with V neck for Neckline.");
    expect(followUp.choices.length).toBeGreaterThan(0);
    for (const choice of followUp.choices) {
      expect(choice.label).toMatch(/^Change to /);
      const after = applyAll(spec, applies(choice));
      expect(after.options.neckline.choiceId).toBe("v-neck");
      expect(after.wearer).toBe("women");
    }
    expect(followUp.choices.map((choice) => choice.label)).toContain("Change to Team jersey (no placket)");
    expectNoIds(followUp);
  });
});

describe("any other part that could not be made", () => {
  it("passes on the reason with every id turned into its label", () => {
    const spec = start("crew-tee", "men");
    const followUp = skippedFollowUp(spec, { wire: { type: "remove-measurement", pointId: "chest-width" }, reason: "The chest-width cannot go." });
    expect(followUp).toEqual({ text: "The Chest width cannot go.", choices: [] });
  });
});

describe("a length asked for without an amount", () => {
  it("asks how much, with amounts to tap that become the person's own words", () => {
    const spec = start("team-jersey", "men", measured("sleeve-length", 2200));
    const followUp = amountFollowUp(spec, { type: "ask-amount", pointId: "sleeve-length", direction: "longer" });
    expect(followUp.text).toBe("How much longer should the sleeve length be? It is 22.0 cm now.");
    expect(followUp.choices.slice(0, 3)).toEqual([
      { kind: "say", label: "+1 cm", text: "Make the sleeve length 1 cm longer" },
      { kind: "say", label: "+2 cm", text: "Make the sleeve length 2 cm longer" },
      { kind: "say", label: "+3 cm", text: "Make the sleeve length 3 cm longer" },
    ]);
    const long = followUp.choices[3];
    expect(long?.label).toBe("Long sleeve");
    expect(applyAll(spec, applies(long)).options["sleeve-length"].choiceId).toBe("long");
  });

  it("says plainly when there is nothing to add to, and offers to set the value", () => {
    const spec = start("team-jersey", "men");
    const followUp = amountFollowUp(spec, { type: "ask-amount", pointId: "sleeve-length", direction: "longer" });
    expect(followUp.text).toBe("The sleeve length has no value yet, so it cannot be made longer by an amount. Type the sleeve length you want.");
    expect(followUp.choices[0]).toEqual({ kind: "fill", label: "Type the sleeve length", text: "Set the sleeve length to " });
    expect(followUp.choices.map((choice) => choice.label)).toContain("Long sleeve");
  });

  it("offers only amounts that leave something, and a shorter choice when there is one", () => {
    const spec = start("team-jersey", "men", option("sleeve-length", "long"), measured("sleeve-length", 250));
    const followUp = amountFollowUp(spec, { type: "ask-amount", pointId: "sleeve-length", direction: "shorter" });
    expect(followUp.choices.map((choice) => choice.label)).toEqual(["-1 cm", "-2 cm", "Short sleeve"]);
  });

  it("says so when the design has no such measurement", () => {
    const spec = start("crew-tee", "men");
    const followUp = amountFollowUp(spec, { type: "ask-amount", pointId: "placket-length", direction: "longer" });
    expect(followUp).toEqual({ text: "This design has no Placket length to change.", choices: [] });
  });
});
