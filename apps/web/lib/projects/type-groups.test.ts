import { describe, expect, it } from "vitest";
import { isOffered } from "@/lib/config/launch-garments";
import { listFamilies, listTypes } from "@/lib/garment";
import { garmentTypeGroups } from "./type-groups";

describe("garmentTypeGroups", () => {
  it("lists every garment type that is offered, once, grouped by the label of its family", () => {
    const groups = garmentTypeGroups();
    const listed = groups.flatMap((group) => group.options.map((option) => option.id));

    expect(listed.sort()).toEqual(listTypes().map((type) => type.id).filter(isOffered).sort());
    expect(listed).not.toContain("leggings");
    expect(groups.map((group) => group.label)).toContain("Tops");
    expect(groups.find((group) => group.label === "Tops")?.options).toContainEqual({ id: "crew-tee", label: "Crew neck tee" });
  });

  it("leaves out a family that has no garment types yet", () => {
    const labels = garmentTypeGroups().map((group) => group.label);

    for (const family of listFamilies()) {
      const hasTypes = listTypes(family.id).some((type) => isOffered(type.id));
      expect(labels.includes(family.label)).toBe(hasTypes);
    }
  });

  it("gives every group at least one option", () => {
    expect(garmentTypeGroups().every((group) => group.options.length > 0)).toBe(true);
  });
});
