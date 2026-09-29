import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { browserActionSchema } from "./browser-action";
import {
  ANCHOR_CHOICES,
  TECHNIQUE_CHOICES,
  artworkRows,
  buildArtworkAction,
  defaultArtworkForm,
  fieldsFromArtwork,
  parseOffsetCm,
  parseRotation,
  placeableParts,
  removeArtworkAction,
  withPart,
  type ArtworkForm,
} from "./artwork-controls";

const FILE = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
const ID = "b1b1b1b1-0000-4000-8000-000000000001";

const form = (patch: Partial<ArtworkForm> = {}): ArtworkForm => ({
  ...defaultArtworkForm(start("crew-tee"), { kind: "file", fileId: FILE }),
  ...patch,
});

const applyTo = (spec: GarmentSpec, request: ReturnType<typeof buildArtworkAction>): GarmentSpec => {
  if (request.kind !== "action") throw new Error(`Expected an action, got: ${request.reason}`);
  const parsed = browserActionSchema.parse(request.action);
  const result = applyAction(spec, parsed);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

describe("parseOffsetCm", () => {
  it("reads centimetres with a sign, a point or a comma, and up to two decimals", () => {
    expect(parseOffsetCm("2.5")).toEqual({ ok: true, tenths: 250 });
    expect(parseOffsetCm("-1,25")).toEqual({ ok: true, tenths: -125 });
    expect(parseOffsetCm("0")).toEqual({ ok: true, tenths: 0 });
    expect(parseOffsetCm(" 3 ")).toEqual({ ok: true, tenths: 300 });
  });

  it("refuses text that is not a length and lengths that are far too large", () => {
    for (const bad of ["", "abc", "1.234", "--1", "1e3"]) expect(parseOffsetCm(bad).ok, bad).toBe(false);
    expect(parseOffsetCm("100000").ok).toBe(false);
  });
});

describe("parseRotation", () => {
  it("reads whole degrees from 0 to 359", () => {
    expect(parseRotation("0")).toEqual({ ok: true, degrees: 0 });
    expect(parseRotation("359")).toEqual({ ok: true, degrees: 359 });
    expect(parseRotation(" 45 ")).toEqual({ ok: true, degrees: 45 });
  });

  it("refuses everything else with a plain sentence", () => {
    for (const bad of ["", "-1", "360", "1.5", "ninety"]) {
      expect(parseRotation(bad)).toEqual({ ok: false, reason: "Enter whole degrees from 0 to 359." });
    }
  });
});

describe("placeableParts", () => {
  it("lists only the panels that can carry artwork, with their places, in the registry's words", () => {
    const parts = placeableParts(start("crew-tee"));
    expect(parts.map((part) => part.panelId)).toEqual(["body-front", "body-back", "sleeve-left", "sleeve-right"]);
    expect(parts[0]?.anchors.map((anchor) => anchor.label)).toContain("Centre chest");
  });

  it("gives the same choices for the select boxes as the registry has", () => {
    expect(ANCHOR_CHOICES(start("crew-tee"), "body-back").map((anchor) => anchor.id)).toEqual(["upper-back", "centre-back", "lower-back"]);
    expect(ANCHOR_CHOICES(start("crew-tee"), "neckband")).toEqual([]);
    expect(TECHNIQUE_CHOICES.map((choice) => choice.id)).toEqual(["sublimation", "transfer", "screen-print", "embroidery"]);
    expect(TECHNIQUE_CHOICES.map((choice) => choice.label)).toContain("Screen print");
  });
});

describe("defaultArtworkForm", () => {
  it("starts on the front of the chest, 8 cm wide, with no move and no turn", () => {
    expect(form()).toMatchObject({ panelId: "body-front", anchorId: "centre-chest", widthCm: "8", offsetXCm: "0", offsetYCm: "0", rotation: "0" });
  });

  it("uses the shape of the picture when it is known", () => {
    const wide = defaultArtworkForm(start("crew-tee"), { kind: "file", fileId: FILE }, { width: 400, height: 200 });
    expect(wide.widthCm).toBe("8");
    expect(wide.heightCm).toBe("4");
  });
});

describe("buildArtworkAction", () => {
  const spec = start("crew-tee");

  it("adds a picture with its place, size and turn in tenths of a millimetre, stamped by the server as typed in", () => {
    const next = applyTo(spec, buildArtworkAction(spec, form({ name: "Club badge", offsetXCm: "-2", offsetYCm: "1.5", widthCm: "6", heightCm: "4.5", rotation: "10" }), ID));
    expect(next.artwork).toEqual([
      {
        id: ID,
        name: "Club badge",
        source: { kind: "file", fileId: FILE },
        panelId: "body-front",
        anchor: "centre-chest",
        offsetX: -200,
        offsetY: 150,
        width: 600,
        height: 450,
        rotationDegrees: 10,
        technique: "screen-print",
        provenance: "user-edited",
      },
    ]);
  });

  it("adds text artwork", () => {
    const text = defaultArtworkForm(spec, { kind: "text", text: "HOME" });
    const next = applyTo(spec, buildArtworkAction(spec, { ...text, name: "Words" }, ID));
    expect(next.artwork[0]?.source).toEqual({ kind: "text", text: "HOME" });
  });

  it("names the artwork after its place when no name is given", () => {
    const next = applyTo(spec, buildArtworkAction(spec, form({ name: "  " }), ID));
    expect(next.artwork[0]?.name).toBe("Logo on Body front");
  });

  it("updates artwork that is already there, keeping what it is", () => {
    const first = applyTo(spec, buildArtworkAction(spec, form({ name: "Badge" }), ID));
    const edit = { ...fieldsFromArtwork(first.artwork[0]!), widthCm: "9", heightCm: "9", rotation: "90" };
    const next = applyTo(first, buildArtworkAction(first, edit, ID, "update"));
    expect(next.artwork).toHaveLength(1);
    expect(next.artwork[0]).toMatchObject({ width: 900, height: 900, rotationDegrees: 90, name: "Badge", source: { kind: "file", fileId: FILE } });
  });

  it("refuses with a plain sentence and names the field: size, move, turn, place", () => {
    const cases: [Partial<ArtworkForm>, string][] = [
      [{ widthCm: "" }, "Enter a width in centimetres, such as 8."],
      [{ heightCm: "0" }, "Enter a height in centimetres, such as 5."],
      [{ offsetXCm: "abc" }, "Enter how far to move it across in centimetres, such as 2 or -2."],
      [{ offsetYCm: "abc" }, "Enter how far to move it down in centimetres, such as 2 or -2."],
      [{ rotation: "400" }, "Enter whole degrees from 0 to 359."],
      [{ anchorId: "nowhere" }, "Choose a place on the part."],
      [{ panelId: "neckband" }, "Choose a part that can carry artwork."],
    ];
    for (const [patch, reason] of cases) expect(buildArtworkAction(spec, form(patch), ID)).toEqual({ kind: "problem", reason });
  });

  it("refuses a name that is too long, and does not change the design", () => {
    const frozen = JSON.stringify(spec);
    expect(buildArtworkAction(spec, form({ name: "x".repeat(61) }), ID)).toEqual({ kind: "problem", reason: "Use 60 characters or fewer." });
    expect(JSON.stringify(spec)).toBe(frozen);
  });

  it("refuses text that is empty", () => {
    const text = defaultArtworkForm(spec, { kind: "text", text: "" });
    expect(buildArtworkAction(spec, text, ID).kind).toBe("problem");
  });
});

describe("artworkRows and removal", () => {
  const spec = start("crew-tee");
  const first = applyTo(spec, buildArtworkAction(spec, form({ name: "Badge" }), ID));

  it("describes each piece of artwork in words", () => {
    const [row] = artworkRows(first);
    expect(row).toMatchObject({ id: ID, name: "Badge", partLabel: "Body front", placeLabel: "Centre chest", kindLabel: "Picture" });
    expect(row?.fields.widthCm).toBe("8");
    expect(artworkRows(spec)).toEqual([]);
  });

  it("removes artwork by id", () => {
    const next = applyTo(first, removeArtworkAction(ID));
    expect(next.artwork).toEqual([]);
  });
});

describe("withPart", () => {
  it("moves the form to another part and starts at the first place on it", () => {
    const moved = withPart(start("crew-tee"), form({ anchorId: "left-chest" }), "body-back");
    expect(moved).toMatchObject({ panelId: "body-back", anchorId: "upper-back" });
  });

  it("leaves the form alone for a part that cannot carry artwork", () => {
    const original = form();
    expect(withPart(start("crew-tee"), original, "neckband")).toBe(original);
  });
});
