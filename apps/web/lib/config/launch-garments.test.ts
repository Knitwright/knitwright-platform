import { describe, expect, it } from "vitest";
import { createSpec, getType, listTypes } from "@/lib/garment";
import { LAUNCH_GARMENTS, isOffered, notOfferedChange, notOfferedReason } from "./launch-garments";

const spec = (typeId: string) => {
  const created = createSpec(typeId, "women");
  if (!created.ok) throw new Error(created.reason);
  return created.spec;
};

describe("the launch garments", () => {
  it("names only garment types the registry has, once each", () => {
    for (const id of LAUNCH_GARMENTS) expect(getType(id), id).toBeDefined();
    expect(new Set(LAUNCH_GARMENTS).size).toBe(LAUNCH_GARMENTS.length);
  });

  it("leaves out the second-wave garments of the guide and nothing else", () => {
    const hidden = listTypes().map((type) => type.id).filter((id) => !isOffered(id));
    expect(hidden.sort()).toEqual(["compression-top", "leggings", "sports-bra"]);
  });

  it("does not offer an unknown garment", () => {
    expect(isOffered("kilt")).toBe(false);
  });

  it("says plainly that a hidden garment is not offered yet", () => {
    expect(notOfferedReason("leggings")).toBe("Not offered yet: Leggings.");
    expect(notOfferedReason("kilt")).toBe("Not offered yet: kilt.");
  });
});

describe("notOfferedChange", () => {
  it("refuses a change to a garment that is not offered", () => {
    expect(notOfferedChange(spec("singlet"), [{ type: "change-type", typeId: "sports-bra" }])).toBe("Not offered yet: Sports bra.");
  });

  it("lets a design that already is a hidden garment keep its type", () => {
    expect(notOfferedChange(spec("sports-bra"), [{ type: "change-type", typeId: "sports-bra" }])).toBeNull();
  });

  it("lets a hidden garment change to an offered one, and ignores other changes", () => {
    expect(notOfferedChange(spec("sports-bra"), [{ type: "change-type", typeId: "singlet" }])).toBeNull();
    const fit = { type: "set-option", optionId: "fit", choiceId: "slim" };
    expect(notOfferedChange(spec("crew-tee"), [fit])).toBeNull();
  });
});
