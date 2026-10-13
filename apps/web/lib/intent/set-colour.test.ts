import { describe, expect, it } from "vitest";
import { applyAction, createSpec, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { swatchForName } from "./colour-names";
import type { WireAction } from "./reply-schema";
import { toSpecAction } from "./to-spec-action";

function start(...actions: unknown[]): GarmentSpec {
  const made = createSpec("team-jersey", "men");
  if (!made.ok) throw new Error(made.reason);
  return actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, made.spec);
}

type SetColour = Extract<WireAction, { type: "set-colour" }>;

function coloured(spec: GarmentSpec, wire: Omit<SetColour, "type">) {
  const converted = toSpecAction(spec, { type: "set-colour", ...wire });
  if (!converted.ok) throw new Error(converted.reason);
  const action = converted.action as Extract<SpecAction, { type: "update-colourway" }>;
  return action.colourway.colours;
}

const typed = (panelId: string, colour: string, swatch?: string) => ({
  type: "update-colourway",
  colourway: {
    id: "main",
    name: "Main",
    colours: [{ panelId, colour, ...(swatch ? { swatch } : {}), provenance: "user-edited" }],
  },
});

describe("a colour the assistant sets", () => {
  it("sets the factory name and a drawn colour when the colour is given by name", () => {
    const colours = coloured(start(), { panels: ["body-front", "body-back"], colour: "royal blue" });
    expect(colours).toEqual([
      { panelId: "body-front", colour: "royal blue", swatch: swatchForName("royal blue"), provenance: "ai-suggested" },
      { panelId: "body-back", colour: "royal blue", swatch: swatchForName("royal blue"), provenance: "ai-suggested" },
    ]);
  });

  it("draws white as white, so the flat is not left grey", () => {
    const [entry] = coloured(start(), { panels: ["sleeve-left"], colour: "White" });
    expect(entry.swatch).toBe("#ffffff");
    expect(entry.colour).toBe("White");
  });

  it("keeps the drawn colour the assistant gave with a name", () => {
    const [entry] = coloured(start(), { panels: ["body-front"], colour: "navy", swatch: "#101830" });
    expect(entry).toMatchObject({ colour: "navy", swatch: "#101830" });
  });

  it("sets only the drawn colour for a hex code, keeping the factory name already there", () => {
    const spec = start(typed("body-front", "Pantone 286 C"));
    const [entry] = coloured(spec, { panels: ["body-front"], colour: "#1D4FB8" });
    expect(entry).toEqual({ panelId: "body-front", colour: "Pantone 286 C", swatch: "#1d4fb8", provenance: "ai-suggested" });
    const [swatchOnly] = coloured(spec, { panels: ["body-front"], colour: "", swatch: "#00807f" });
    expect(swatchOnly).toMatchObject({ colour: "Pantone 286 C", swatch: "#00807f" });
  });

  it("leaves the name empty for a hex code on a panel that had none", () => {
    const [entry] = coloured(start(), { panels: ["body-front"], colour: "1b2a49" });
    expect(entry).toMatchObject({ colour: "", swatch: "#1b2a49" });
  });

  it("drops an old drawn colour when the name changes to one it has no colour for", () => {
    const spec = start(typed("body-front", "navy", "#1b2a49"));
    const [entry] = coloured(spec, { panels: ["body-front"], colour: "Pantone 286 C" });
    expect(entry).toEqual({ panelId: "body-front", colour: "Pantone 286 C", provenance: "ai-suggested" });
  });

  it("gives a design that passes the checks", () => {
    const spec = start();
    const converted = toSpecAction(spec, { type: "set-colour", panels: ["body-front"], colour: "#abcdef" });
    expect(converted.ok && applyAction(spec, converted.action).ok).toBe(true);
  });
});
