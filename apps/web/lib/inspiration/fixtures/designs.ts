import { applyAction, createSpec, type GarmentSpec } from "@/lib/garment";

/** Designs the inspiration tests work on. Deterministic: no clock, no randomness, no network. */

export function jersey(): GarmentSpec {
  const made = createSpec("team-jersey", "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

const must = (result: ReturnType<typeof applyAction>): GarmentSpec => {
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

/** A jersey with a pattern, so a style swap has something to swap. */
export const withPattern = (style: "hoops" | "fade" = "hoops"): GarmentSpec =>
  must(applyAction(jersey(), { type: "set-kit-pattern", kitPattern: { style, colours: [{ colour: "navy", swatch: "#1b2a49" }], provenance: "user-edited" } }));

/** A jersey carrying an uploaded crest, so a test can see that the crest is still the only picture afterwards. */
export function withCrest(fileId = "11111111-1111-4111-8111-111111111111"): GarmentSpec {
  return must(
    applyAction(withPattern(), {
      type: "add-artwork",
      artwork: {
        id: "crest",
        name: "Club crest",
        source: { kind: "file", fileId },
        panelId: "body-front",
        anchor: "centre-chest",
        offsetX: 0,
        offsetY: 100,
        width: 1000,
        height: 1000,
        rotationDegrees: 0,
        technique: "sublimation",
        provenance: "user-edited",
      },
    }),
  );
}
