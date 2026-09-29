import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { buildComponents } from "./components";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const fabric = (id: string, patch: object = {}): SpecAction => ({
  type: "add-fabric",
  fabric: {
    id,
    name: "Mesh",
    composition: "",
    construction: "",
    weightGsm: null,
    finish: "",
    consumption: "",
    stretch: "not-set",
    provenance: "user-edited",
    ...patch,
  },
});

const TBC = { status: "to-be-confirmed" };

describe("the component list, fabric", () => {
  it("puts every panel that shares the first fabric on one line", () => {
    const section = buildComponents(start("crew-tee"));
    expect(section.id).toBe("components");
    expect(section.fabrics).toHaveLength(1);
    expect(section.fabrics[0]?.panels.map((panel) => panel.label)).toEqual([
      "Body front",
      "Body back",
      "Left sleeve",
      "Right sleeve",
      "Neckband",
    ]);
  });

  it("shows a fabric nobody described as to be confirmed, never as a number", () => {
    const line = buildComponents(start("crew-tee")).fabrics[0];
    expect(line?.name).toEqual({ status: "set", value: "Main fabric", provenance: "user-edited" });
    expect(line?.composition).toEqual(TBC);
    expect(line?.construction).toEqual(TBC);
    expect(line?.weight).toEqual(TBC);
    expect(line?.finish).toEqual(TBC);
    expect(line?.stretch).toEqual(TBC);
    expect(line?.consumption).toEqual(TBC);
  });

  it("shows each detail with the source of the fabric", () => {
    const spec = apply(start("crew-tee"), {
      type: "update-fabric",
      fabric: {
        id: "main",
        name: "Interlock",
        composition: "Cotton",
        construction: "Interlock knit",
        weightGsm: 180,
        finish: "Enzyme washed",
        consumption: "1.2 m",
        stretch: "two-way",
        provenance: "brand-supplied",
      },
    });
    const line = buildComponents(spec).fabrics[0];
    const from = (value: string) => ({ status: "set", value, provenance: "brand-supplied" });
    expect(line).toMatchObject({
      name: from("Interlock"),
      composition: from("Cotton"),
      construction: from("Interlock knit"),
      weight: from("180 gsm"),
      finish: from("Enzyme washed"),
      consumption: from("1.2 m"),
      stretch: from("Two-way stretch"),
    });
  });

  it("says a fabric with no stretch has none, and a fabric with stretch not set is to be confirmed", () => {
    const none = apply(start("crew-tee"), { type: "update-fabric", fabric: { ...(start("crew-tee").fabrics[0]), stretch: "none" } });
    expect(buildComponents(none).fabrics[0]?.stretch).toMatchObject({ value: "No stretch" });
    const four = apply(start("crew-tee"), { type: "update-fabric", fabric: { ...(start("crew-tee").fabrics[0]), stretch: "four-way" } });
    expect(buildComponents(four).fabrics[0]?.stretch).toMatchObject({ value: "Four-way stretch" });
  });

  it("gives panels that use another fabric a line of their own, and names them", () => {
    const withMesh = apply(start("crew-tee"), fabric("mesh"));
    const spec = apply(apply(withMesh, { type: "assign-fabric", panelId: "sleeve-left", fabricId: "mesh" }), {
      type: "assign-fabric",
      panelId: "sleeve-right",
      fabricId: "mesh",
    });
    const lines = buildComponents(spec).fabrics;
    expect(lines.map((line) => line.fabricId)).toEqual(["main", "mesh"]);
    expect(lines[0]?.panels.map((panel) => panel.label)).toEqual(["Body front", "Body back", "Neckband"]);
    expect(lines[1]?.panels.map((panel) => panel.label)).toEqual(["Left sleeve", "Right sleeve"]);
  });

  it("leaves out a fabric that no panel uses", () => {
    const spec = apply(start("crew-tee"), fabric("spare"));
    expect(buildComponents(spec).fabrics.map((line) => line.fabricId)).toEqual(["main"]);
  });

  it("follows the fabric of a panel that names the first fabric explicitly", () => {
    const spec = apply(start("crew-tee"), { type: "assign-fabric", panelId: "body-front", fabricId: "main" });
    expect(buildComponents(spec).fabrics).toHaveLength(1);
  });
});

describe("the component list, rib, thread, labels and trims", () => {
  it("lists what a crew tee implies, each with its details to be confirmed", () => {
    const others = buildComponents(start("crew-tee")).others;
    expect(others.map((line) => line.slotId)).toEqual([
      "main-thread",
      "brand-label",
      "care-label",
      "size-label",
      "rib-neckband",
    ]);
    for (const line of others) {
      expect(line.name).toEqual(TBC);
      expect(line.details).toEqual(TBC);
      expect(line.quantity).toEqual(TBC);
    }
  });

  it("groups them by kind and names the panels a rib is used on", () => {
    const others = buildComponents(start("crew-tee")).others;
    expect(others.map((line) => line.kindLabel)).toEqual(["Thread", "Label", "Label", "Label", "Rib"]);
    expect(others.find((line) => line.slotId === "rib-neckband")?.panels.map((panel) => panel.label)).toEqual(["Neckband"]);
  });

  it("lists buttons for a buttoned placket with their details to be confirmed, though nobody described them", () => {
    const buttons = buildComponents(start("polo")).others.find((line) => line.slotId === "buttons");
    expect(buttons).toMatchObject({ label: "Buttons", kindLabel: "Trim", name: TBC, details: TBC, quantity: TBC });
  });

  it("lists a zip instead of buttons when the placket is a zip", () => {
    const zipped = apply(start("polo"), { type: "set-option", optionId: "placket", choiceId: "zip", provenance: "user-edited" });
    const ids = buildComponents(zipped).others.map((line) => line.slotId);
    expect(ids).toContain("zip");
    expect(ids).not.toContain("buttons");
  });

  it("shows what the user wrote, with its source, and a quantity as free text", () => {
    const spec = apply(start("polo"), {
      type: "set-component",
      component: { id: "buttons", name: "Shell buttons", details: "", quantity: "4 per garment", provenance: "user-edited" },
    });
    const line = buildComponents(spec).others.find((entry) => entry.slotId === "buttons");
    expect(line?.name).toEqual({ status: "set", value: "Shell buttons", provenance: "user-edited" });
    expect(line?.details).toEqual(TBC);
    expect(line?.quantity).toEqual({ status: "set", value: "4 per garment", provenance: "user-edited" });
  });

  it("shows a suggested component with the source of the suggestion", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-component",
      component: { id: "main-thread", name: "Polyester", details: "", quantity: "", provenance: "ai-suggested" },
    });
    expect(buildComponents(spec).others[0]?.name).toEqual({ status: "set", value: "Polyester", provenance: "ai-suggested" });
  });

  it("says what is missing in the note", () => {
    expect(buildComponents(start("crew-tee")).note).toBe("Some details are still to be confirmed.");
  });

  it("gives every line a plain sentence that says what it is", () => {
    for (const line of buildComponents(start("polo")).others) expect(line.help.endsWith(".")).toBe(true);
  });
});
