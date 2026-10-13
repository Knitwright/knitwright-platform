import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyAction, createSpec, type GarmentSpec } from "@/lib/garment";
import { OUTCOME_KINDS, isNeverSilent, type IntentOutcome } from "./outcome";
import { MAX_REPLY_LENGTH, resolveIntent } from "./resolve";

function start(typeId: string, ...actions: unknown[]): GarmentSpec {
  const made = createSpec(typeId, "men");
  if (!made.ok) throw new Error(made.reason);
  return actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, made.spec);
}

const changes = (...actions: object[]) => JSON.stringify({ kind: "changes", actions });
const option = (optionId: string, choiceId: string) => ({ type: "set-option", optionId, choiceId });

function run(utterance: string, spec: GarmentSpec, raw: string): IntentOutcome {
  return resolveIntent({ utterance, spec, raw });
}

function expectKind<K extends IntentOutcome["kind"]>(outcome: IntentOutcome, kind: K): Extract<IntentOutcome, { kind: K }> {
  expect(outcome.kind).toBe(kind);
  expect(isNeverSilent(outcome)).toBe(true);
  return outcome as Extract<IntentOutcome, { kind: K }>;
}

describe("reading a model reply", () => {
  it("applies a stated change, marks it as suggested by the assistant, and explains it", () => {
    const spec = start("team-jersey");
    const outcome = expectKind(run("raglan sleeves please", spec, changes(option("sleeve-type", "raglan"))), "applied");
    expect(outcome.spec.options["sleeve-type"]).toEqual({ choiceId: "raglan", provenance: "ai-suggested" });
    expect(outcome.explanations).toEqual(["Sleeve type changed from Set in to Raglan."]);
    expect(outcome.actions).toEqual([
      { type: "set-option", optionId: "sleeve-type", choiceId: "raglan", provenance: "ai-suggested" },
    ]);
  });

  it("finds the reply inside a code fence or after some prose", () => {
    const spec = start("crew-tee");
    const fenced = "Sure!\n```json\n" + changes(option("fit", "slim")) + "\n```";
    expect(run("slim fit", spec, fenced).kind).toBe("applied");
    const prose = "Here you go: " + changes(option("fit", "slim")) + " Hope that helps {";
    expect(run("slim fit", spec, prose).kind).toBe("applied");
  });

  it("rejects plain text, broken JSON, an unknown shape and a reply that is too long", () => {
    const spec = start("crew-tee");
    for (const raw of ["I made it slim.", "{\"kind\": \"changes\", \"actions\": [", "{\"kind\":\"dance\"}", "[]", "", "x".repeat(MAX_REPLY_LENGTH + 1)]) {
      expectKind(run("slim fit", spec, raw), "rejection");
    }
  });

  it("rejects an action the editor does not have, and never drops it quietly", () => {
    const spec = start("crew-tee");
    const outcome = expectKind(
      run("slim fit and a hood", spec, changes(option("fit", "slim"), { type: "add-hood" })),
      "rejection",
    );
    expect(outcome.reason).toMatch(/add-hood/);
    expect(outcome.reason).toMatch(/Nothing was changed/);
  });

  it("rejects an action with fields it should not have, such as its own source", () => {
    const spec = start("crew-tee");
    const raw = changes({ ...option("fit", "slim"), provenance: "brand-supplied" });
    expectKind(run("slim fit", spec, raw), "rejection");
  });

  it("rejects an impossible combination with the registry's reason, and applies nothing", () => {
    const spec = start("team-jersey", { type: "set-option", optionId: "neckline", choiceId: "v-neck", provenance: "user-edited" });
    const outcome = expectKind(run("add a zip placket", spec, changes(option("placket", "zip"))), "rejection");
    expect(outcome.reason).toMatch(/V neck already opens down the chest/);
  });

  it("applies all of a batch or none of it", () => {
    const spec = start("team-jersey", { type: "set-option", optionId: "neckline", choiceId: "v-neck", provenance: "user-edited" });
    const raw = changes(option("fit", "slim"), option("placket", "zip"));
    expectKind(run("slim fit with a zip", spec, raw), "rejection");
  });

  it("says so when the change asks for nothing new", () => {
    const spec = start("crew-tee", { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" });
    const outcome = expectKind(run("slim fit", spec, changes(option("fit", "slim"))), "rejection");
    expect(outcome.reason).toMatch(/already/);
  });

  it("does not relabel a person's own choice as the assistant's when the model repeats it", () => {
    const spec = start("crew-tee", { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "user-edited" });
    const measured = start("crew-tee", { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "user-edited" });
    expectKind(run("slim fit", spec, changes(option("fit", "slim"))), "rejection");
    expectKind(run("chest 52 cm", measured, changes({ type: "set-measurement", pointId: "chest-width", cm: 52 })), "rejection");
    const outcome = expectKind(run("slim fit, curved hem", spec, changes(option("fit", "slim"), option("hem-shape", "curved"))), "applied");
    expect(outcome.spec.options.fit.provenance).toBe("user-edited");
  });

  it("passes on a question with its choices after checking each choice can be made", () => {
    const spec = start("crew-tee");
    const raw = JSON.stringify({
      kind: "question",
      question: "Which fit do you want?",
      choices: [
        { label: "Slim", actions: [option("fit", "slim")] },
        { label: "Relaxed", actions: [option("fit", "relaxed")] },
      ],
      recommended: 1,
    });
    const outcome = expectKind(run("change the fit", spec, raw), "question");
    expect(outcome.recommended).toBe(1);
    expect(outcome.choices[0].actions).toEqual([
      { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" },
    ]);
  });

  it("rejects a question that offers a choice that cannot be made", () => {
    const spec = start("crew-tee");
    const raw = JSON.stringify({
      kind: "question",
      question: "Which sleeve?",
      choices: [
        { label: "Raglan", actions: [option("sleeve-type", "raglan")] },
        { label: "Set in", actions: [] },
      ],
    });
    expectKind(run("change the sleeves", spec, raw), "rejection");
  });

  describe("a question's choices keep the same rules as a change", () => {
    const question = (choices: object[], recommended = 0) =>
      JSON.stringify({ kind: "question", question: "How much longer?", choices, recommended });
    const length = (cm: number) => ({ type: "set-measurement", pointId: "body-length", cm });
    const measurementsIn = (outcome: IntentOutcome): unknown[] =>
      outcome.kind === "question" ? outcome.choices.flatMap((choice) => choice.actions).filter((action) => action.type === "set-measurement") : [];

    it("drops a choice holding a number the person did not type, so no such number reaches a proposal", () => {
      const spec = start("crew-tee");
      const raw = question([
        { label: "74 cm", actions: [length(74)] },
        { label: "80 cm", actions: [length(80)] },
        { label: "Leave it", actions: [] },
      ]);
      const outcome = expectKind(run("make it a bit longer", spec, raw), "rejection");
      expect(outcome.reason).toMatch(/How much longer\?/);
      expect(outcome.reason).toMatch(/Nothing was changed/);
    });

    it("keeps the choices that pass, and moves the recommendation with them", () => {
      const spec = start("crew-tee");
      const raw = question(
        [
          { label: "74 cm", actions: [length(74)] },
          { label: "Relaxed", actions: [option("fit", "relaxed")] },
          { label: "Leave it", actions: [] },
        ],
        2,
      );
      const outcome = expectKind(run("make it a bit longer", spec, raw), "question");
      expect(outcome.choices.map((choice) => choice.label)).toEqual(["Relaxed", "Leave it"]);
      expect(outcome.recommended).toBe(1);
      expect(measurementsIn(outcome)).toEqual([]);
    });

    it("recommends the first choice left when the recommended one was dropped", () => {
      const raw = question(
        [
          { label: "Relaxed", actions: [option("fit", "relaxed")] },
          { label: "Leave it", actions: [] },
          { label: "74 cm", actions: [length(74)] },
        ],
        2,
      );
      expect(expectKind(run("make it a bit longer", start("crew-tee"), raw), "question").recommended).toBe(0);
    });

    it("keeps a number the person typed", () => {
      const raw = question([
        { label: "74 cm", actions: [length(74)] },
        { label: "Leave it", actions: [] },
      ]);
      expect(measurementsIn(expectKind(run("body length 74 cm?", start("crew-tee"), raw), "question"))).toHaveLength(1);
    });

    it("drops a choice that changes the construction without its label naming the change", () => {
      const raw = question([
        { label: "Keep it as it is", actions: [option("neckline", "v-neck")] },
        { label: "Slim", actions: [option("fit", "slim")] },
        { label: "V neck", actions: [option("neckline", "v-neck")] },
      ]);
      const outcome = expectKind(run("change it a little", start("team-jersey"), raw), "question");
      expect(outcome.choices.map((choice) => choice.label)).toEqual(["Slim", "V neck"]);
    });

    it("drops a choice the editor cannot read", () => {
      const raw = question([{ label: "A hood", actions: [{ type: "add-hood" }] }, { label: "Slim", actions: [option("fit", "slim")] }, { label: "Leave it" }]);
      expect(expectKind(run("change it", start("crew-tee"), raw), "question").choices.map((choice) => choice.label)).toEqual(["Slim", "Leave it"]);
    });
  });

  it("rejects a question whose recommendation is not one of its choices", () => {
    const raw = JSON.stringify({
      kind: "question",
      question: "Which?",
      choices: [{ label: "A" }, { label: "B" }],
      recommended: 5,
    });
    expectKind(run("hm", start("crew-tee"), raw), "rejection");
  });

  it("passes on the model's own rejection, with its whitespace tidied", () => {
    const raw = JSON.stringify({ kind: "rejection", reason: "That is not\nabout the garment." });
    expect(run("weather?", start("crew-tee"), raw)).toEqual({ kind: "rejection", reason: "That is not about the garment." });
  });
});

describe("the ambiguity rules", () => {
  it("asks before a change of garment type that was not named", () => {
    const spec = start("crew-tee");
    const raw = changes({ type: "change-type", typeId: "long-sleeve-tee" });
    const outcome = expectKind(run("give it long sleeves", spec, raw), "question");
    expect(outcome.question).toMatch(/Crew neck tee to Long sleeve tee/);
    expect(outcome.choices[0].actions).toEqual([{ type: "change-type", typeId: "long-sleeve-tee" }]);
    expect(outcome.choices[1].actions).toEqual([]);
    expect(outcome.recommended).toBe(0);
  });

  it("applies a change of garment type that was named", () => {
    const outcome = expectKind(run("make it a polo", start("crew-tee"), changes({ type: "change-type", typeId: "polo" })), "applied");
    expect(outcome.spec.typeId).toBe("polo");
    expect(outcome.notes.length).toBeGreaterThanOrEqual(0);
  });

  it("asks before a construction change that was not named, and keeps the rest as the other choice", () => {
    const spec = start("team-jersey");
    const raw = changes(option("fit", "slim"), option("sleeve-type", "raglan"));
    const outcome = expectKind(run("make it sportier and slim", spec, raw), "question");
    expect(outcome.question).toMatch(/Sleeve type from Set in to Raglan/);
    expect(outcome.choices[0].actions).toHaveLength(2);
    expect(outcome.choices[1].actions).toEqual([
      { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" },
    ]);
  });

  it("asks when the named type was refused in the same breath", () => {
    const raw = changes({ type: "change-type", typeId: "polo" }, option("placket", "zip"));
    expectKind(run("don't make it a polo, just add a zip", start("crew-tee"), raw), "question");
  });

  it("asks before a change of wearer that was not named", () => {
    const raw = changes({ type: "change-wearer", wearer: "youth" });
    expectKind(run("make it for my son", start("crew-tee"), raw), "question");
    expectKind(run("make it for kids", start("crew-tee"), raw), "applied");
  });

  it("does not ask about a style change such as the fit", () => {
    expectKind(run("make it sportier", start("crew-tee"), changes(option("fit", "slim"))), "applied");
  });

  it("offers garment types that have a choice this type lacks", () => {
    const spec = start("crew-tee");
    const outcome = expectKind(run("long sleeves please", spec, changes(option("sleeve-length", "long"))), "question");
    const labels = outcome.choices.map((choice) => choice.label);
    expect(labels).toContain("Change to Long sleeve tee");
    expect(labels).toContain("Change to Polo shirt");
    expect(labels.at(-1)).toBe("Keep it as a Crew neck tee");
    expect(outcome.choices.at(-1)?.actions).toEqual([]);
    for (const choice of outcome.choices) {
      const applied = choice.actions.reduce<GarmentSpec | null>((current, action) => {
        if (!current) return null;
        const result = applyAction(current, action);
        return result.ok ? result.spec : null;
      }, spec);
      expect(applied).not.toBeNull();
    }
  });

  it("rejects a choice this type lacks when no other type can take the whole request", () => {
    const spec = start("v-neck-tee");
    const outcome = expectKind(run("add a band collar", spec, changes(option("collar", "band-collar"))), "rejection");
    expect(outcome.reason).toMatch(/Band collar/);
  });
});

describe("numbers the person did not give", () => {
  const measure = (pointId: string, cm: number) => ({ type: "set-measurement", pointId, cm });

  it("applies a measurement the person typed", () => {
    const outcome = expectKind(run("chest width 52.5 cm", start("crew-tee"), changes(measure("chest-width", 52.5))), "applied");
    expect(outcome.spec.measurements).toEqual([{ pointId: "chest-width", value: 5250, provenance: "ai-suggested" }]);
  });

  it("accepts a change by an amount the person typed, in centimetres, millimetres or inches", () => {
    const spec = start("crew-tee", { type: "set-measurement", pointId: "body-length", value: 7000, provenance: "user-edited" });
    expectKind(run("2 cm longer", spec, changes(measure("body-length", 72))), "applied");
    expectKind(run("take 5 mm off", spec, changes(measure("body-length", 69.5))), "applied");
    expectKind(run("add an inch, so 1 inch longer", spec, changes(measure("body-length", 72.54))), "applied");
  });

  it("rejects a measurement the person did not give", () => {
    const outcome = expectKind(run("use a standard chest", start("crew-tee"), changes(measure("chest-width", 52))), "rejection");
    expect(outcome.reason).toMatch(/never guessed/);
  });

  it("rejects a fabric weight the person did not give, and applies one they did", () => {
    const raw = changes({ type: "change-fabric", changes: { weightGsm: 180 } });
    expectKind(run("make it heavier", start("crew-tee"), raw), "rejection");
    expectKind(run("180 gsm", start("crew-tee"), raw), "applied");
  });

  it("rejects a measurement for a point this garment does not have", () => {
    expectKind(run("placket length 14 cm", start("crew-tee"), changes(measure("placket-length", 14))), "rejection");
  });
});

describe("colours, fabric and labels", () => {
  it("colours the named panels in the first colourway, keeping the others", () => {
    const spec = start("crew-tee");
    const raw = changes(
      { type: "set-colour", panels: ["body-front", "body-back"], colour: "navy" },
      { type: "set-colour", panels: ["sleeve-left", "sleeve-right"], colour: "white", swatch: "#ffffff" },
    );
    const outcome = expectKind(run("navy body, white sleeves", spec, raw), "applied");
    expect(outcome.spec.colourways[0].colours).toEqual([
      { panelId: "body-front", colour: "navy", swatch: "#1b2a49", provenance: "ai-suggested" },
      { panelId: "body-back", colour: "navy", swatch: "#1b2a49", provenance: "ai-suggested" },
      { panelId: "sleeve-left", colour: "white", swatch: "#ffffff", provenance: "ai-suggested" },
      { panelId: "sleeve-right", colour: "white", swatch: "#ffffff", provenance: "ai-suggested" },
    ]);
  });

  it("rejects a colour for a colourway or panel the design does not have", () => {
    const spec = start("crew-tee");
    expectKind(run("navy", spec, changes({ type: "set-colour", panels: ["collar"], colour: "navy" })), "rejection");
    const other = { type: "set-colour", panels: ["body-front"], colour: "navy", colourwayId: "nope" };
    expectKind(run("navy", spec, changes(other)), "rejection");
  });

  it("changes the first fabric or a named one, and sets labelling", () => {
    const spec = start("crew-tee");
    const raw = changes(
      { type: "change-fabric", changes: { composition: "100% cotton" } },
      { type: "set-labelling", field: "origin", text: "Portugal" },
    );
    const outcome = expectKind(run("100% cotton, made in Portugal", spec, raw), "applied");
    expect(outcome.spec.fabrics[0].composition).toBe("100% cotton");
    expect(outcome.spec.labelling.origin).toEqual({ text: "Portugal", provenance: "ai-suggested" });
    const missing = changes({ type: "change-fabric", fabricId: "nope", changes: { composition: "wool" } });
    expectKind(run("wool", spec, missing), "rejection");
  });
});

describe("any reply at all", () => {
  const specs = [start("crew-tee"), start("polo"), start("team-jersey")];
  const known = ["set-option", "change-type", "change-wearer", "set-measurement", "remove-measurement", "set-colour", "change-fabric", "set-labelling"];
  const words = fc.constantFrom("fit", "slim", "polo", "raglan", "collar", "polo-collar", "none", "zip", "long", "navy", "chest-width", "body-front", "team-jersey", "women", "{", "}", "[", "\"", ":");
  const anyAction = fc.record(
    {
      type: fc.oneof(fc.constantFrom(...known), fc.string()),
      optionId: fc.oneof(words, fc.string()),
      choiceId: fc.oneof(words, fc.string()),
      typeId: words,
      wearer: words,
      pointId: words,
      cm: fc.oneof(fc.double(), fc.integer()),
      panels: fc.array(words),
      colour: fc.string(),
      changes: fc.anything(),
      field: words,
      text: fc.string(),
    },
    { requiredKeys: ["type"] },
  );
  const reply = fc.oneof(
    fc.string(),
    fc.json(),
    fc.anything().map((value) => JSON.stringify(value) ?? ""),
    fc.array(anyAction, { maxLength: 6 }).map((actions) => JSON.stringify({ kind: "changes", actions })),
    fc
      .tuple(fc.string(), fc.array(fc.record({ label: fc.string(), actions: fc.array(anyAction, { maxLength: 2 }) }), { maxLength: 5 }), fc.integer())
      .map(([question, choices, recommended]) => JSON.stringify({ kind: "question", question, choices, recommended })),
    fc.string().map((reason) => JSON.stringify({ kind: "rejection", reason })),
    fc.tuple(fc.string(), fc.json(), fc.string()).map(([before, body, after]) => `${before}\`\`\`json\n${body}\n\`\`\`${after}`),
    fc.json().map((body) => body.slice(0, Math.max(0, body.length - 1))),
  );

  it("always gives exactly one of the three outcomes, never silent, and never throws", () => {
    fc.assert(
      fc.property(fc.constantFrom(...specs), fc.string(), reply, (spec, utterance, raw) => {
        const outcome = resolveIntent({ utterance, spec, raw });
        expect(OUTCOME_KINDS).toContain(outcome.kind);
        expect(isNeverSilent(outcome)).toBe(true);
        if (outcome.kind === "applied") expect(applyAction(outcome.spec, { type: "change-wearer", wearer: outcome.spec.wearer }).ok).toBe(true);
      }),
      { numRuns: 1500 },
    );
  });
});
