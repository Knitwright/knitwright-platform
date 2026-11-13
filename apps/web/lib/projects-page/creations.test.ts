import { describe, expect, it } from "vitest";
import { filterFromQuery, lifestyleOf, sceneOf, shapeOf, visibleCreations } from "./creations";

const ID = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;

const scene = sceneOf({ id: ID(1), launch_project_id: ID(2), aspect: "9:16", output_file_id: ID(3), finished_at: "2026-11-05T00:00:00Z" });
const lifestyle = lifestyleOf({ id: ID(4), file_id: ID(5), width: 1600, height: 900, created_at: "2026-11-06T00:00:00Z", media_sets: { project_id: ID(6) } });

describe("AI creations", () => {
  it("reads a shoot as a garment-locked scene that opens its launch canvas", () => {
    expect(scene).toMatchObject({ source: "scene", shape: "tall", garmentLocked: true, href: `/project/${ID(2)}`, fileId: ID(3) });
  });

  it("reads a lifestyle picture with the shape of its size, opening its design", () => {
    expect(lifestyle).toMatchObject({ source: "lifestyle", shape: "wide", garmentLocked: false, href: `/project/${ID(6)}` });
  });

  it("gives every size a shape, and square when the size is unknown", () => {
    expect(shapeOf(null, 100)).toBe("square");
    expect(shapeOf(1000, 1000)).toBe("square");
    expect(shapeOf(800, 1000)).toBe("portrait");
    expect(shapeOf(500, 1000)).toBe("tall");
    expect(shapeOf(2000, 1000)).toBe("wide");
    expect(sceneOf({ id: ID(1), launch_project_id: ID(2), aspect: "odd", output_file_id: ID(3), finished_at: "x" }).shape).toBe("square");
  });

  it("filters, newest first", () => {
    const all = [scene, lifestyle];
    expect(visibleCreations(all, "all").map((c) => c.id)).toEqual([ID(4), ID(1)]);
    expect(visibleCreations(all, "scenes").map((c) => c.id)).toEqual([ID(1)]);
    expect(visibleCreations(all, "lifestyle").map((c) => c.id)).toEqual([ID(4)]);
    expect(visibleCreations(all, "locked").map((c) => c.id)).toEqual([ID(1)]);
  });

  it("reads the filter from the address", () => {
    expect(filterFromQuery("locked")).toBe("locked");
    expect(filterFromQuery(["scenes"])).toBe("scenes");
    expect(filterFromQuery("liked")).toBe("all");
  });
});
