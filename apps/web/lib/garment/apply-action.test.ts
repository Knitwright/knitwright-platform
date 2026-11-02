import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { accepted, fabric, rejected, setOption, start } from "./fixtures/specs";
import { validateSpec } from "./spec";
import { garmentSpecSchema } from "./spec-schema";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";

const measure = (pointId: string, value = 5000) => ({
  type: "set-measurement",
  pointId,
  value,
  provenance: "user-edited",
});
const colour = (panelId: string, name = "navy") => ({ panelId, colour: name, provenance: "user-edited" });
const colourway = (id: string, colours: object[] = []) => ({ id, name: `Colourway ${id}`, colours });
const artwork = (id: string, patch: object = {}) => ({
  id,
  name: `Art ${id}`,
  source: { kind: "file", fileId: FILE_ID },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 900,
  height: 900,
  technique: "screen-print",
  provenance: "user-edited",
  ...patch,
});

describe("applyAction, options", () => {
  it("sets an option and leaves the original untouched", () => {
    const before = start("team-jersey");
    const after = accepted(applyAction(before, setOption("sleeve-length", "long"))).spec;
    expect(after.options["sleeve-length"]).toEqual({ choiceId: "long", provenance: "user-edited" });
    expect(before.options["sleeve-length"]?.choiceId).toBe("short");
    expect(after).not.toBe(before);
  });

  it("rejects a choice the type does not offer, in plain words", () => {
    expect(rejected(applyAction(start("crew-tee"), setOption("neckline", "v-neck")))).toBe(
      "V neck is not offered for Neckline on Crew neck tee.",
    );
  });

  it("rejects an option the type does not have", () => {
    expect(rejected(applyAction(start("crew-tee"), setOption("placket", "zip")))).toBe(
      "The option placket does not apply to Crew neck tee.",
    );
  });

  it("rejects an impossible combination with its reason", () => {
    const withV = accepted(applyAction(start("team-jersey"), setOption("neckline", "v-neck"))).spec;
    expect(rejected(applyAction(withV, setOption("placket", "zip")))).toBe(
      "A V neck already opens down the chest, so there is no room for a placket. Choose no placket, or a round neck.",
    );
  });

  it("drops a shoulder width when the sleeve becomes raglan, and says so", () => {
    const withShoulder = accepted(applyAction(start("team-jersey"), measure("shoulder-width"))).spec;
    const result = accepted(applyAction(withShoulder, setOption("sleeve-type", "raglan")));
    expect(result.spec.measurements).toEqual([]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]?.message).toMatch(/no shoulder seam/);
  });

  it("drops a colour for a panel that disappears, and says so", () => {
    const update = { type: "update-colourway", colourway: colourway("main", [colour("neckband", "red")]) };
    const coloured = accepted(applyAction(start("team-jersey"), update)).spec;
    const result = accepted(applyAction(coloured, setOption("collar", "band-collar")));
    expect(result.spec.colourways[0].colours).toEqual([]);
    expect(result.dropped).toEqual([
      {
        kind: "colour",
        id: "neckband",
        parentId: "main",
        message: "The colour for Neckband was removed, because this garment no longer has that panel.",
      },
    ]);
  });
});

describe("applyAction, measurements and sizing", () => {
  it("adds a measurement with its provenance, then replaces it", () => {
    const first = accepted(applyAction(start("crew-tee"), measure("chest-width", 5250))).spec;
    expect(first.measurements).toEqual([{ pointId: "chest-width", value: 5250, provenance: "user-edited" }]);
    const again = { ...measure("chest-width", 5300), provenance: "brand-supplied" };
    const spec = accepted(applyAction(first, again)).spec;
    expect(spec.measurements).toEqual([{ pointId: "chest-width", value: 5300, provenance: "brand-supplied" }]);
  });

  it("rejects a point that does not apply and says why", () => {
    expect(rejected(applyAction(start("crew-tee"), measure("collar-height")))).toBe(
      "This garment has no collar, so there is no collar height to measure.",
    );
  });

  it("rejects a value that is not a whole number, and a measurement with no provenance", () => {
    const spec = start("crew-tee");
    expect(rejected(applyAction(spec, measure("chest-width", 52.5)))).toMatch(/not understood/);
    expect(applyAction(spec, { type: "set-measurement", pointId: "chest-width", value: 5000 }).ok).toBe(false);
    expect(applyAction(spec, { ...measure("chest-width"), provenance: "verified" }).ok).toBe(false);
  });

  it("removes a measurement", () => {
    const one = accepted(applyAction(start("crew-tee"), measure("chest-width"))).spec;
    const none = accepted(applyAction(one, { type: "remove-measurement", pointId: "chest-width" })).spec;
    expect(none.measurements).toEqual([]);
  });
});

describe("applyAction, fabrics", () => {
  it("adds a fabric and trims its text", () => {
    const added = fabric("mesh", { name: " Mesh panel " });
    const spec = accepted(applyAction(start("polo"), { type: "add-fabric", fabric: added })).spec;
    expect(spec.fabrics.map((entry) => entry.id)).toEqual(["main", "mesh"]);
    expect(spec.fabrics[1]?.name).toBe("Mesh panel");
  });

  it("updates a fabric and takes its new provenance", () => {
    const added = accepted(applyAction(start("polo"), { type: "add-fabric", fabric: fabric("mesh") })).spec;
    const change = { type: "update-fabric", fabric: fabric("mesh", { provenance: "ai-suggested", weightGsm: 130 }) };
    const spec = accepted(applyAction(added, change)).spec;
    expect(spec.fabrics[1]?.provenance).toBe("ai-suggested");
    expect(spec.fabrics[1]?.weightGsm).toBe(130);
  });

  it("rejects a repeated id, a missing fabric and a fabric with no provenance", () => {
    const spec = start("polo");
    expect(rejected(applyAction(spec, { type: "add-fabric", fabric: fabric("main") }))).toBe(
      "The fabric id main is used more than once.",
    );
    expect(rejected(applyAction(spec, { type: "update-fabric", fabric: fabric("mesh") }))).toBe(
      "There is no fabric with the id mesh.",
    );
    expect(rejected(applyAction(spec, { type: "remove-fabric", id: "mesh" }))).toBe(
      "There is no fabric with the id mesh.",
    );
    const bare = Object.fromEntries(Object.entries(fabric("mesh")).filter(([key]) => key !== "provenance"));
    expect(applyAction(spec, { type: "add-fabric", fabric: bare }).ok).toBe(false);
  });

  it("assigns a fabric to a panel, replaces the assignment, and rejects bad ones", () => {
    const added = accepted(applyAction(start("polo"), { type: "add-fabric", fabric: fabric("mesh") })).spec;
    const one = accepted(applyAction(added, { type: "assign-fabric", panelId: "collar", fabricId: "mesh" })).spec;
    expect(one.panelFabrics).toEqual([{ panelId: "collar", fabricId: "mesh" }]);
    const back = accepted(applyAction(one, { type: "assign-fabric", panelId: "collar", fabricId: "main" })).spec;
    expect(back.panelFabrics).toEqual([{ panelId: "collar", fabricId: "main" }]);
    expect(applyAction(added, { type: "assign-fabric", panelId: "cuffs", fabricId: "mesh" }).ok).toBe(false);
    expect(applyAction(added, { type: "assign-fabric", panelId: "collar", fabricId: "wool" }).ok).toBe(false);
  });

  it("drops a fabric assignment for a panel that disappears after an option change", () => {
    let spec = accepted(applyAction(start("team-jersey"), { type: "add-fabric", fabric: fabric("mesh") })).spec;
    spec = accepted(applyAction(spec, { type: "assign-fabric", panelId: "neckband", fabricId: "mesh" })).spec;
    const result = accepted(applyAction(spec, setOption("collar", "band-collar")));
    expect(result.spec.panelFabrics).toEqual([]);
    expect(result.dropped.map((item) => [item.kind, item.id])).toEqual([["fabric-assignment", "neckband"]]);
  });
});

describe("applyAction, colourways and artwork", () => {
  it("adds, updates and removes a colourway", () => {
    const added = accepted(applyAction(start("polo"), { type: "add-colourway", colourway: colourway("away") })).spec;
    expect(added.colourways.map((entry) => entry.id)).toEqual(["main", "away"]);
    const change = { type: "update-colourway", colourway: colourway("away", [colour("collar", "white")]) };
    const updated = accepted(applyAction(added, change)).spec;
    expect(updated.colourways[1]?.colours).toEqual([colour("collar", "white")]);
    const removed = accepted(applyAction(updated, { type: "remove-colourway", id: "away" })).spec;
    expect(removed.colourways.map((entry) => entry.id)).toEqual(["main"]);
  });

  it("rejects a repeated colourway id, a missing one, removing the last one and a colour for a missing panel", () => {
    const spec = start("polo");
    expect(rejected(applyAction(spec, { type: "add-colourway", colourway: colourway("main") }))).toBe(
      "The colourway id main is used more than once.",
    );
    expect(rejected(applyAction(spec, { type: "update-colourway", colourway: colourway("nope") }))).toBe(
      "There is no colourway with the id nope.",
    );
    expect(rejected(applyAction(spec, { type: "remove-colourway", id: "nope" }))).toBe(
      "There is no colourway with the id nope.",
    );
    expect(rejected(applyAction(spec, { type: "remove-colourway", id: "main" }))).toBe("Keep at least one colourway.");
    const stray = colourway("away", [colour("cuffs", "red")]);
    expect(applyAction(spec, { type: "add-colourway", colourway: stray }).ok).toBe(false);
  });

  it("adds, updates and removes artwork", () => {
    const added = accepted(applyAction(start("polo"), { type: "add-artwork", artwork: artwork("logo") })).spec;
    expect(added.artwork).toHaveLength(1);
    const move = { type: "update-artwork", artwork: artwork("logo", { anchor: "left-chest", technique: "embroidery" }) };
    const updated = accepted(applyAction(added, move)).spec;
    expect(updated.artwork[0]?.anchor).toBe("left-chest");
    const removed = accepted(applyAction(updated, { type: "remove-artwork", id: "logo" })).spec;
    expect(removed.artwork).toEqual([]);
  });

  it("rejects artwork that is repeated or missing", () => {
    const spec = accepted(applyAction(start("polo"), { type: "add-artwork", artwork: artwork("logo") })).spec;
    expect(rejected(applyAction(spec, { type: "add-artwork", artwork: artwork("logo") }))).toBe(
      "The artwork id logo is used more than once.",
    );
    expect(rejected(applyAction(spec, { type: "update-artwork", artwork: artwork("x") }))).toBe(
      "There is no artwork with the id x.",
    );
    expect(rejected(applyAction(spec, { type: "remove-artwork", id: "x" }))).toBe("There is no artwork with the id x.");
  });
});

describe("applyAction, wearer and type", () => {
  it("changes the wearer, and rejects one that does not exist", () => {
    const spec = accepted(applyAction(start("polo"), { type: "change-wearer", wearer: "youth" })).spec;
    expect(spec.wearer).toBe("youth");
    expect(applyAction(start("polo"), { type: "change-wearer", wearer: "kids" }).ok).toBe(false);
  });

  it("keeps what still applies when the type changes and reports what it dropped", () => {
    let spec = start("team-jersey");
    for (const action of [
      setOption("sleeve-length", "long"),
      setOption("sleeve-type", "raglan"),
      setOption("collar", "band-collar"),
      setOption("fit", "slim", "ai-suggested"),
      measure("chest-width"),
      measure("collar-height"),
    ]) {
      spec = accepted(applyAction(spec, action)).spec;
    }
    const result = accepted(applyAction(spec, { type: "change-type", typeId: "crew-tee" }));
    expect(result.spec.typeId).toBe("crew-tee");
    expect(result.spec.options.fit).toEqual({ choiceId: "slim", provenance: "ai-suggested" });
    expect(result.spec.options["sleeve-length"]).toEqual({ choiceId: "short", provenance: "derived" });
    expect(result.spec.options["sleeve-type"]?.choiceId).toBe("set-in");
    expect(result.spec.options.collar?.choiceId).toBe("none");
    expect(result.spec.measurements.map((entry) => entry.pointId)).toEqual(["chest-width"]);
    const text = result.dropped.map((item) => item.message).join(" ");
    expect(text).toMatch(/Sleeve length/);
    expect(text).toMatch(/Collar height/);
    expect(validateSpec(result.spec).ok).toBe(true);
  });

  it("removes options the new type does not have", () => {
    const withZip = accepted(applyAction(start("team-jersey"), setOption("placket", "zip"))).spec;
    const result = accepted(applyAction(withZip, { type: "change-type", typeId: "crew-tee" }));
    expect(Object.keys(result.spec.options)).not.toContain("placket");
    expect(result.dropped.map((item) => item.id)).toContain("placket");
  });

  it("resets choices that would make an impossible combination", () => {
    const result = accepted(applyAction(start("team-jersey"), { type: "change-type", typeId: "polo" }));
    expect(result.spec.options.collar?.choiceId).toBe("polo-collar");
    expect(result.spec.options.placket).toEqual({ choiceId: "buttons", provenance: "derived" });
    expect(result.dropped.map((item) => item.id)).toContain("placket");
  });

  it("changes to the same type without dropping anything", () => {
    expect(accepted(applyAction(start("polo"), { type: "change-type", typeId: "polo" })).dropped).toEqual([]);
  });

  it("rejects an unknown type", () => {
    expect(rejected(applyAction(start("polo"), { type: "change-type", typeId: "kilt" }))).toBe(
      "There is no garment type called kilt.",
    );
  });
});

/**
 * The founder's own marks and the base article the design sits on (review of plan v5, item D-5).
 * What is proved here is that the design keeps them, and that reading a stored design back gives
 * them again: that is the reload a person does.
 */
describe("applyAction, the founder's own marks", () => {
  const pom = (patch: object = {}) => ({
    type: "set-extra-pom",
    pom: {
      id: "m1",
      tool: "measure-line",
      label: "Pocket opening",
      note: null,
      points: [
        { panelId: "body-front", xMm: 0, yMm: 0 },
        { panelId: "body-front", xMm: 120, yMm: 0 },
      ],
      lengthMm: 120,
      drawnOn: "2d",
      provenance: "user-edited",
      ...patch,
    },
  });
  const callout = (patch: object = {}) => ({
    type: "set-callout",
    callout: {
      id: "c1",
      label: "Hem finish",
      note: "Twin needle, 6 mm",
      points: [{ panelId: "body-front", xMm: 30, yMm: 40 }],
      drawnOn: "2d",
      provenance: "user-edited",
      ...patch,
    },
  });

  it("keeps a point of measure a person drew, with its own name and its measured length", () => {
    const after = accepted(applyAction(start("team-jersey"), pom())).spec;
    expect(after.extraPoms).toEqual([
      {
        id: "m1",
        tool: "measure-line",
        label: "Pocket opening",
        note: null,
        points: [
          { panelId: "body-front", xMm: 0, yMm: 0 },
          { panelId: "body-front", xMm: 120, yMm: 0 },
        ],
        lengthMm: 120,
        drawnOn: "2d",
        provenance: "user-edited",
      },
    ]);
  });

  it("keeps a callout a person drew, with the note that goes to the factory", () => {
    const after = accepted(applyAction(start("team-jersey"), callout())).spec;
    expect(after.callouts?.[0]?.note).toBe("Twin needle, 6 mm");
  });

  it("survives being written out and read back, which is what a reload does", () => {
    const drawn = accepted(applyAction(start("team-jersey"), pom())).spec;
    const both = accepted(applyAction(drawn, callout())).spec;
    const reloaded = garmentSpecSchema.parse(JSON.parse(JSON.stringify(both)));
    expect(reloaded.extraPoms?.[0]?.label).toBe("Pocket opening");
    expect(reloaded.extraPoms?.[0]?.lengthMm).toBe(120);
    expect(reloaded.callouts?.[0]?.label).toBe("Hem finish");
  });

  it("replaces a mark with the same id rather than keeping two of it", () => {
    const once = accepted(applyAction(start("team-jersey"), pom())).spec;
    const twice = accepted(applyAction(once, pom({ label: "Pocket opening, again", lengthMm: 140 }))).spec;
    expect(twice.extraPoms).toHaveLength(1);
    expect(twice.extraPoms?.[0]?.lengthMm).toBe(140);
  });

  it("leaves the list out again when the last mark is taken off, as a design that never had one", () => {
    const drawn = accepted(applyAction(start("team-jersey"), pom())).spec;
    const gone = accepted(applyAction(drawn, { type: "remove-extra-pom", id: "m1" })).spec;
    expect(gone.extraPoms).toBeUndefined();
    expect("extraPoms" in gone).toBe(false);
  });

  it("says plainly that a mark it is asked to remove is not there", () => {
    expect(rejected(applyAction(start("team-jersey"), { type: "remove-callout", id: "c9" }))).toBe("There is no callout with the id c9.");
  });

  it("refuses a mark with no place picked, and a callout that carries a length", () => {
    expect(applyAction(start("team-jersey"), pom({ points: [] })).ok).toBe(false);
    expect(applyAction(start("team-jersey"), callout({ lengthMm: 10 })).ok).toBe(false);
  });

  it("keeps a point of measure and a callout apart, even when they share an id", () => {
    const drawn = accepted(applyAction(start("team-jersey"), pom())).spec;
    const both = accepted(applyAction(drawn, callout({ id: "m1" }))).spec;
    expect(both.extraPoms).toHaveLength(1);
    expect(both.callouts).toHaveLength(1);
  });

  it("stores the base article and the parameters chosen inside its approved ranges", () => {
    const article = { baseArticleCode: "TJS-SS-01", productionClass: "A" as const, parameters: { body_length_offset: 20 } };
    const after = accepted(applyAction(start("team-jersey"), { type: "set-article", article })).spec;
    expect(after.article).toEqual(article);
    const reloaded = garmentSpecSchema.parse(JSON.parse(JSON.stringify(after)));
    expect(reloaded.article?.parameters).toEqual({ body_length_offset: 20 });
  });

  it("refuses an article code that is not a catalogue code", () => {
    const article = { baseArticleCode: "nope", productionClass: "A", parameters: {} };
    expect(applyAction(start("team-jersey"), { type: "set-article", article }).ok).toBe(false);
  });
});

describe("applyAction, bad input", () => {
  it("rejects things that are not actions", () => {
    for (const action of [null, undefined, 7, "set-option", {}, { type: "explode" }, { type: "set-option" }]) {
      expect(rejected(applyAction(start("polo"), action))).toMatch(/not understood/);
    }
  });

  it("rejects extra fields on an action", () => {
    expect(applyAction(start("polo"), { ...setOption("fit", "slim"), extra: 1 }).ok).toBe(false);
  });

  it("returns a frozen spec that passes validation", () => {
    const result = accepted(applyAction(start("polo"), setOption("fit", "relaxed")));
    expect(validateSpec(result.spec).ok).toBe(true);
    expect(Object.isFrozen(result.spec)).toBe(true);
  });

  it("refuses an option change when the type of a stored spec no longer exists", () => {
    const spec = { ...start("polo"), typeId: "kilt" };
    expect(rejected(applyAction(spec, setOption("fit", "slim")))).toBe("There is no garment type called kilt.");
  });
});
