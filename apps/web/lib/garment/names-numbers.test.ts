import { describe, expect, it } from "vitest";
import { applyAction, createSpec, garmentSpecSchema, getType, type GarmentSpec, type NamesAndNumbers } from "./index";
import { namesAndNumbersSchema, placesFor, usualPlaces } from "./names-numbers";

function spec(typeId: string): GarmentSpec {
  const made = createSpec(typeId, "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

const marks = (places: NamesAndNumbers["places"]): NamesAndNumbers => ({
  places,
  colour: "",
  sampleName: "PLAYER",
  sampleNumber: "10",
  provenance: "user-edited",
});

const BACK = [{ place: "back-name" }, { place: "back-number" }] as const;

describe("the places for names and numbers", () => {
  it("puts names and numbers on tops, and a number on the leg of bottoms", () => {
    const tee = getType("team-jersey")!;
    const shorts = getType("shorts")!;
    expect(placesFor(tee, spec("team-jersey").options)).toEqual(["back-name", "back-number", "front-number"]);
    expect(placesFor(shorts, spec("shorts").options)).toEqual(["leg-number"]);
    expect(usualPlaces(tee, spec("team-jersey").options)).toEqual(["back-name", "back-number"]);
  });
});

describe("the names and numbers of a design", () => {
  it("adds and removes them, and the design stays valid", () => {
    const added = applyAction(spec("team-jersey"), { type: "set-names-numbers", namesAndNumbers: marks([...BACK]) });
    expect(added.ok && added.spec.namesAndNumbers?.places).toEqual(BACK);
    if (!added.ok) return;
    expect(garmentSpecSchema.safeParse(added.spec).success).toBe(true);
    const removed = applyAction(added.spec, { type: "remove-names-numbers" });
    expect(removed.ok && Object.hasOwn(removed.spec, "namesAndNumbers")).toBe(false);
  });

  it("leaves heights, style, colour and technique unset unless given: nothing is guessed", () => {
    const parsed = namesAndNumbersSchema.parse(marks([{ place: "back-number" }]));
    expect(parsed.places[0].height).toBeUndefined();
    expect(parsed.style).toBeUndefined();
    expect(parsed.technique).toBeUndefined();
  });

  it("refuses a place the garment does not have, a repeated place, and a sample number above 99", () => {
    expect(applyAction(spec("crew-tee"), { type: "set-names-numbers", namesAndNumbers: marks([{ place: "leg-number" }]) }).ok).toBe(false);
    expect(namesAndNumbersSchema.safeParse(marks([{ place: "back-name" }, { place: "back-name" }])).success).toBe(false);
    expect(namesAndNumbersSchema.safeParse({ ...marks([...BACK]), sampleNumber: "100" }).success).toBe(false);
    expect(applyAction(spec("crew-tee"), { type: "remove-names-numbers" }).ok).toBe(false);
  });

  it("keeps only the places the new garment has when the type changes, and says what went", () => {
    const added = applyAction(spec("team-jersey"), {
      type: "set-names-numbers",
      namesAndNumbers: marks([...BACK, { place: "front-number" }]),
    });
    if (!added.ok) throw new Error(added.reason);
    const shorts = applyAction(added.spec, { type: "change-type", typeId: "shorts" });
    expect(shorts.ok && Object.hasOwn(shorts.spec, "namesAndNumbers")).toBe(false);
    expect(shorts.ok && shorts.dropped.filter((entry) => entry.kind === "names-numbers")).toHaveLength(3);
    const tee = applyAction(added.spec, { type: "change-type", typeId: "polo" });
    expect(tee.ok && tee.spec.namesAndNumbers?.places).toHaveLength(3);
  });

  it("reads a design saved before names and numbers existed", () => {
    expect(garmentSpecSchema.safeParse(spec("polo")).success).toBe(true);
  });
});
