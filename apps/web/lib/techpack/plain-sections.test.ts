import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { buildArtwork } from "./artwork";
import { buildColourways } from "./colourways";
import { buildLabelling } from "./labelling";
import { buildSignOff } from "./sign-off";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const TBC = { status: "to-be-confirmed" };
const set = (value: string, provenance = "user-edited") => ({ status: "set", value, provenance });

describe("the colourways section", () => {
  it("has a block for each colourway and a row for each panel of the garment", () => {
    const section = buildColourways(start("crew-tee"));
    expect(section.id).toBe("colourways");
    expect(section.colourways).toHaveLength(1);
    expect(section.colourways[0]?.name).toBe("Main colourway");
    expect(section.colourways[0]?.rows.map((row) => row.label)).toEqual([
      "Body front",
      "Body back",
      "Left sleeve",
      "Right sleeve",
      "Neckband",
    ]);
  });

  it("shows every colour code and screen colour as to be confirmed in a new design", () => {
    const section = buildColourways(start("crew-tee"));
    for (const row of section.colourways[0]?.rows ?? []) {
      expect(row.code).toEqual(TBC);
      expect(row.screenColour).toEqual(TBC);
    }
    expect(section.note).toBe("Some colours are still to be confirmed.");
  });

  it("shows the colour code and the screen colour with their source", () => {
    const spec = apply(start("crew-tee"), {
      type: "update-colourway",
      colourway: {
        id: "main",
        name: "Home",
        colours: [{ panelId: "body-front", colour: "Navy 19-4052", swatch: "#1b2a49", provenance: "user-edited" }],
      },
    });
    const front = buildColourways(spec).colourways[0]?.rows[0];
    expect(front?.code).toEqual(set("Navy 19-4052"));
    expect(front?.screenColour).toEqual(set("#1b2a49"));
  });

  it("shows the code as to be confirmed when a panel has a screen colour and no code", () => {
    const spec = apply(start("crew-tee"), {
      type: "update-colourway",
      colourway: { id: "main", name: "Home", colours: [{ panelId: "body-back", colour: "", swatch: "#aa0000", provenance: "user-edited" }] },
    });
    const back = buildColourways(spec).colourways[0]?.rows[1];
    expect(back?.code).toEqual(TBC);
    expect(back?.screenColour).toEqual(set("#aa0000"));
  });

  it("gives the screen colour its own source, apart from the code", () => {
    const spec = apply(start("crew-tee"), {
      type: "update-colourway",
      colourway: { id: "main", name: "Home", colours: [{ panelId: "body-front", colour: "", swatch: "#1b2a49", provenance: "ai-suggested" }] },
    });
    const front = buildColourways(spec).colourways[0]?.rows[0];
    expect(front?.screenColour).toEqual(set("#1b2a49", "ai-suggested"));
    expect(front?.code).toEqual(TBC);
  });

  it("carries the source of a colour that was suggested", () => {
    const spec = apply(start("crew-tee"), {
      type: "update-colourway",
      colourway: { id: "main", name: "Home", colours: [{ panelId: "body-front", colour: "Red", provenance: "read-from-image" }] },
    });
    expect(buildColourways(spec).colourways[0]?.rows[0]?.code).toEqual(set("Red", "read-from-image"));
  });

  it("lists every colourway", () => {
    const spec = apply(start("crew-tee"), { type: "add-colourway", colourway: { id: "away", name: "Away", colours: [] } });
    expect(buildColourways(spec).colourways.map((block) => block.name)).toEqual(["Main colourway", "Away"]);
  });
});

describe("the artwork section", () => {
  const art = (patch: object = {}): SpecAction => ({
    type: "add-artwork",
    artwork: {
      id: "crest",
      name: "Club crest",
      source: { kind: "text", text: "FC United" },
      panelId: "body-front",
      anchor: "left-chest",
      offsetX: 150,
      offsetY: -50,
      width: 800,
      height: 400,
      rotationDegrees: 10,
      technique: "screen-print",
      provenance: "user-edited",
      ...patch,
    },
  });

  it("says there is none, and lists nothing", () => {
    const section = buildArtwork(start("crew-tee"));
    expect(section.id).toBe("artwork");
    expect(section.items).toEqual([]);
    expect(section.note).toBe("No artwork has been added to this design.");
  });

  it("shows name, panel, place, position, size, turn, technique and words, each with its source", () => {
    const item = buildArtwork(apply(start("crew-tee"), art())).items[0];
    expect(item).toMatchObject({
      id: "crest",
      name: set("Club crest"),
      panel: set("Body front"),
      anchor: set("Left chest, the wearer's left"),
      across: { status: "set", value: "1.5", tenthsMm: 150, provenance: "user-edited" },
      down: { status: "set", value: "-0.5", tenthsMm: -50, provenance: "user-edited" },
      width: { value: "8.0", tenthsMm: 800 },
      height: { value: "4.0", tenthsMm: 400 },
      rotation: set("10 degrees"),
      technique: set("Screen print"),
      content: { kind: "text", text: set("FC United") },
    });
  });

  it("shows a picture by the name of the artwork, and keeps the file only as a key, never as a value", () => {
    const fileId = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";
    const item = buildArtwork(apply(start("crew-tee"), art({ source: { kind: "file", fileId } }))).items[0];
    expect(item?.content).toEqual({ kind: "file", fileId, description: set("Picture: Club crest") });
    expect(JSON.stringify(item?.name) + JSON.stringify(item?.panel)).not.toContain(fileId);
    const cells = Object.values(item?.content ?? {}).filter((entry) => typeof entry === "object");
    expect(JSON.stringify(cells)).not.toContain(fileId);
  });

  it("keeps the turn as a number of degrees beside the words", () => {
    const item = buildArtwork(apply(start("crew-tee"), art())).items[0];
    expect(item?.rotation).toEqual({ status: "set", value: "10 degrees", provenance: "user-edited", number: 10, unit: "degrees" });
    const flat = buildArtwork(apply(start("crew-tee"), art({ rotationDegrees: 0 }))).items[0];
    expect(flat?.rotation).toMatchObject({ number: 0, value: "0 degrees" });
  });

  it("gives every part of a piece of artwork the source of the artwork: position and size too", () => {
    const item = buildArtwork(apply(start("crew-tee"), art({ provenance: "read-from-image" }))).items[0];
    for (const cell of [item?.across, item?.down, item?.width, item?.height, item?.rotation, item?.technique, item?.anchor, item?.panel]) {
      expect(cell).toMatchObject({ status: "set", provenance: "read-from-image" });
    }
  });

  it("names every technique in plain words", () => {
    for (const [technique, words] of [
      ["sublimation", "Sublimation"],
      ["transfer", "Transfer"],
      ["embroidery", "Embroidery"],
    ] as const) {
      const item = buildArtwork(apply(start("crew-tee"), art({ technique }))).items[0];
      expect(item?.technique).toEqual(set(words));
    }
  });

  it("carries a source that is a suggestion", () => {
    const item = buildArtwork(apply(start("crew-tee"), art({ provenance: "ai-suggested" }))).items[0];
    expect(item?.name).toEqual(set("Club crest", "ai-suggested"));
  });

  it("says a turn of one degree in the singular", () => {
    const item = buildArtwork(apply(start("crew-tee"), art({ rotationDegrees: 1 }))).items[0];
    expect(item?.rotation).toMatchObject(set("1 degree"));
  });
});

describe("the labels and packing section", () => {
  it("has the five fields in order, all to be confirmed until the user enters them", () => {
    const section = buildLabelling(start("crew-tee"));
    expect(section.id).toBe("labelling");
    expect(section.rows.map((row) => row.label)).toEqual([
      "Care instructions",
      "Composition label",
      "Country of origin",
      "How to fold",
      "How to bag",
    ]);
    for (const row of section.rows) expect(row.value).toEqual(TBC);
    expect(section.note).toBe("Some details are still to be confirmed.");
  });

  it("shows what the user wrote with its source", () => {
    const spec = apply(start("crew-tee"), { type: "set-labelling", field: "origin", text: "Portugal", provenance: "user-edited" });
    expect(buildLabelling(spec).rows[2]?.value).toEqual(set("Portugal"));
  });

  it("carries the source of a label field, so a suggestion stays a suggestion", () => {
    const spec = apply(start("crew-tee"), { type: "set-labelling", field: "care", text: "Wash cold", provenance: "ai-suggested" });
    expect(buildLabelling(spec).rows[0]?.value).toEqual(set("Wash cold", "ai-suggested"));
  });

  it("has no note once every field is filled in", () => {
    let spec = start("crew-tee");
    for (const field of ["care", "composition", "origin", "fold", "bag"] as const) {
      spec = apply(spec, { type: "set-labelling", field, text: "Filled in", provenance: "user-edited" });
    }
    expect(buildLabelling(spec).note).toBeNull();
  });
});

describe("the sign-off section", () => {
  it("is empty and says nobody has checked the specification yet", () => {
    expect(buildSignOff()).toEqual({
      id: "sign-off",
      title: "Sign-off",
      note: null,
      statement: "Nobody has checked this specification yet.",
      name: TBC,
      date: TBC,
    });
  });
});
