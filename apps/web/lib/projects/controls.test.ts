import { describe, expect, it } from "vitest";
import { applyAction, listTypes, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { optionControls } from "./controls";
import { toneOf } from "./provenance-tone";

const change = (spec: GarmentSpec, optionId: string, choiceId: string, provenance = "user-edited"): GarmentSpec => {
  const result = applyAction(spec, { type: "set-option", optionId, choiceId, provenance });
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

describe("optionControls", () => {
  it("makes one control for every option of the type, in the order the type lists them", () => {
    for (const type of listTypes()) {
      const controls = optionControls(start(type.id));

      expect(controls.map((control) => control.optionId)).toEqual(type.options.map((option) => option.id));
      expect(controls.map((control) => control.label)).toEqual(type.options.map((option) => option.label));
    }
  });

  it("lists the choices the type offers, each with its label and help", () => {
    const controls = optionControls(start("polo"));

    const collar = controls.find((control) => control.optionId === "collar");
    expect(collar?.choices).toEqual([
      expect.objectContaining({
        choiceId: "polo-collar",
        label: "Polo collar",
        help: "A collar that folds over and opens at the front.",
        available: true,
        reason: null,
      }),
    ]);
  });

  it("marks the current choice as selected", () => {
    const spec = change(start("team-jersey"), "hem-shape", "curved");

    const hem = optionControls(spec).find((control) => control.optionId === "hem-shape");

    expect(hem?.choices.filter((choice) => choice.selected).map((choice) => choice.choiceId)).toEqual(["curved"]);
    expect(hem?.provenanceLabel).toBe("Typed in by you");
    expect(hem?.tone).toBe("person");
  });

  it("shows a choice that would break a rule as not available, with the reason", () => {
    const spec = change(start("team-jersey"), "collar", "band-collar");

    const neckline = optionControls(spec).find((control) => control.optionId === "neckline");
    const vNeck = neckline?.choices.find((choice) => choice.choiceId === "v-neck");

    expect(vNeck?.available).toBe(false);
    expect(vNeck?.reason).toContain("band collar");
    expect(neckline?.choices.find((choice) => choice.choiceId === "crew")?.available).toBe(true);
  });

  it("describes a starting choice as worked out, not as a person's", () => {
    const control = optionControls(start("crew-tee"))[0];

    expect(control.provenanceLabel).toBe("Starting choice");
    expect(control.tone).toBe("derived");
    expect(control.suggestion).toBeNull();
    expect(control.choices.some((choice) => choice.selected)).toBe(true);
  });

  it.each(["ai-suggested", "suggested-chart", "read-from-image"] as const)(
    "never shows a %s choice as selected",
    (provenance) => {
      const spec = change(start("team-jersey"), "hem-shape", "curved", provenance);

      const hem = optionControls(spec).find((control) => control.optionId === "hem-shape");

      expect(hem?.choices.some((choice) => choice.selected)).toBe(false);
      expect(hem?.suggestion).toBe("Curved");
      expect(hem?.tone).toBe("suggested");
    },
  );

  it("gives nothing for a garment type that is not in the registry", () => {
    const spec = { ...start("crew-tee"), typeId: "unknown-thing" } as GarmentSpec;

    expect(optionControls(spec)).toEqual([]);
  });

  it("leaves an option with no stored choice with nothing selected", () => {
    const spec = { ...start("crew-tee"), options: {} } as GarmentSpec;

    const control = optionControls(spec)[0];

    expect(control.choices.some((choice) => choice.selected)).toBe(false);
    expect(control.provenanceLabel).toBe("Not chosen yet");
  });
});

describe("a starting choice", () => {
  it("is called a starting choice, and a person's own choice keeps the usual words", () => {
    const untouched = optionControls(start("crew-tee")).find((control) => control.optionId === "fit");
    const chosen = optionControls(change(start("crew-tee"), "fit", "slim")).find((control) => control.optionId === "fit");

    expect(untouched?.provenanceLabel).toBe("Starting choice");
    expect(chosen?.provenanceLabel).toBe("Typed in by you");
  });
});

describe("toneOf", () => {
  it.each([
    ["brand-supplied", "person"],
    ["user-edited", "person"],
    ["suggested-chart", "suggested"],
    ["ai-suggested", "suggested"],
    ["read-from-image", "suggested"],
    ["derived", "derived"],
  ] as const)("styles %s as %s", (provenance, tone) => {
    expect(toneOf(provenance)).toBe(tone);
  });
});
