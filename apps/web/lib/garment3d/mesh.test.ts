import { describe, expect, it } from "vitest";
import { buildFlat } from "@/lib/flat/build";
import { TOPS_TYPE_IDS, designWith, madeUpForType, typedIn } from "@/lib/flat/fixtures/designs";
import { boundsOfPoints, flatten } from "@/lib/flat/geometry";
import type { FlatModel, View } from "@/lib/flat/model";
import { buildGarmentMesh, METRES_PER_UNIT, type GarmentMesh, type MeshSheet } from "./mesh";
import { shapeSource } from "./shape";

/**
 * Step 9A task 7: the 3D form is closed, no face is turned inside out, and its width and
 * length stand in the same ratio as the flat's. The measurements are made up for tests.
 */

const draw = (typeId: string, view: View, scale = 1, chestScale = 1): FlatModel => {
  const values = madeUpForType(typeId, {}, scale);
  const chest = { ...values, "chest-width": Math.round((values["chest-width"] as number) * chestScale), "hem-width": Math.round((values["hem-width"] as number) * chestScale) };
  const spec = designWith(typeId, {}, chest);
  return buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" }) as FlatModel;
};

const meshOf = (typeId: string, scale = 1, chestScale = 1): { mesh: GarmentMesh; front: FlatModel; back: FlatModel } => {
  const front = draw(typeId, "front", scale, chestScale);
  const back = draw(typeId, "back", scale, chestScale);
  return { mesh: buildGarmentMesh({ front: shapeSource(front), back: shapeSource(back) }), front, back };
};

type Vec = readonly [number, number, number];
const vertex = (sheet: MeshSheet, i: number): Vec => [sheet.positions[i * 3] as number, sheet.positions[i * 3 + 1] as number, sheet.positions[i * 3 + 2] as number];
const faces = (sheet: MeshSheet): [number, number, number][] =>
  Array.from({ length: sheet.indices.length / 3 }, (_, f) => [sheet.indices[f * 3] as number, sheet.indices[f * 3 + 1] as number, sheet.indices[f * 3 + 2] as number]);
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossOf = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalOf = (sheet: MeshSheet, [a, b, c]: readonly number[]): Vec => {
  const [p, q, r] = [vertex(sheet, a as number), vertex(sheet, b as number), vertex(sheet, c as number)];
  return crossOf(sub(q, p), sub(r, p));
};

/** Faces of both sheets as triples of welded vertex ids: two vertices in the same place are one. */
function welded(mesh: GarmentMesh): [string, string, string][] {
  const id = (v: Vec): string => v.map((n) => n.toFixed(9)).join(",");
  return [mesh.front, mesh.back].flatMap((sheet) => faces(sheet).map((face) => face.map((i) => id(vertex(sheet, i))) as [string, string, string]));
}

const silhouetteBox = (model: FlatModel) => boundsOfPoints(flatten(model.outline.silhouette).flatMap((run) => run.points));

describe.each(TOPS_TYPE_IDS.map((typeId) => [typeId]))("the 3D form of a %s", (typeId) => {
  const { mesh } = meshOf(typeId);

  it("is closed: every edge joins exactly two faces, running opposite ways", () => {
    const directed = new Map<string, number>();
    for (const [a, b, c] of welded(mesh)) {
      for (const [p, q] of [[a, b], [b, c], [c, a]] as const) directed.set(`${p}>${q}`, (directed.get(`${p}>${q}`) ?? 0) + 1);
    }
    for (const [edge, count] of directed) {
      const [p, q] = edge.split(">");
      expect(count, edge).toBe(1);
      expect(directed.get(`${q}>${p}`), `the other side of ${edge}`).toBe(1);
    }
  });

  it("has no inverted or flat faces: the front faces forward and the back faces back", () => {
    for (const face of faces(mesh.front)) {
      const normal = normalOf(mesh.front, face);
      expect(normal[2]).toBeGreaterThan(0);
    }
    for (const face of faces(mesh.back)) expect(normalOf(mesh.back, face)[2]).toBeLessThan(0);
  });

  it("encloses a positive volume, so every face points outwards", () => {
    const volume = [mesh.front, mesh.back].reduce(
      (sum, sheet) =>
        sum +
        faces(sheet).reduce((inner, [a, b, c]) => {
          const [p, q, r] = [vertex(sheet, a), vertex(sheet, b), vertex(sheet, c)];
          const n = crossOf(q, r);
          return inner + (p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) / 6;
        }, 0),
      0,
    );
    expect(volume).toBeGreaterThan(0);
  });
});

describe("the size of the 3D form", () => {
  it("has the width and the length of the flat, in metres, in the same ratio", () => {
    const { mesh, back } = meshOf("crew-tee");
    const box = silhouetteBox(back);
    expect(mesh.size.width).toBeCloseTo((box.maxX - box.minX) * METRES_PER_UNIT, 6);
    expect(mesh.size.height).toBeCloseTo((box.maxY - box.minY) * METRES_PER_UNIT, 6);
    expect(mesh.size.width / mesh.size.height).toBeCloseTo((box.maxX - box.minX) / (box.maxY - box.minY), 6);
  });

  it("follows a change to the chest in the same ratio as the flat", () => {
    const narrow = meshOf("crew-tee");
    const wide = meshOf("crew-tee", 1, 1.2);
    const flatRatio = (model: FlatModel) => {
      const box = silhouetteBox(model);
      return (box.maxX - box.minX) / (box.maxY - box.minY);
    };
    expect(wide.mesh.size.width / wide.mesh.size.height).toBeGreaterThan(narrow.mesh.size.width / narrow.mesh.size.height);
    expect(wide.mesh.size.width / wide.mesh.size.height).toBeCloseTo(flatRatio(wide.back), 6);
  });

  it("measures the chest across the underarms as the flat does", () => {
    const { mesh, front } = meshOf("crew-tee");
    const left = front.landmarks["underarm-left"] as { x: number };
    const right = front.landmarks["underarm-right"] as { x: number };
    const xs = Array.from({ length: mesh.front.positions.length / 3 }, (_, i) => mesh.front.positions[i * 3] as number);
    const span = (right.x - left.x) * METRES_PER_UNIT;
    // The underarm points are on the outline, so the form has vertices there.
    expect(xs.some((x) => Math.abs(x - span / 2) < 1e-6)).toBe(true);
    expect(xs.some((x) => Math.abs(x + span / 2) < 1e-6)).toBe(true);
  });

  it("is deeper than flat but not as deep as it is wide", () => {
    const { mesh } = meshOf("crew-tee");
    expect(mesh.size.depth).toBeGreaterThan(0.05);
    expect(mesh.size.depth).toBeLessThan(mesh.size.width);
  });

  it("is centred on the origin", () => {
    const { mesh } = meshOf("crew-tee");
    const xs = Array.from({ length: mesh.front.positions.length / 3 }, (_, i) => vertex(mesh.front, i));
    expect(Math.max(...xs.map((v) => v[0])) + Math.min(...xs.map((v) => v[0]))).toBeCloseTo(0, 6);
    expect(Math.max(...xs.map((v) => v[1])) + Math.min(...xs.map((v) => v[1]))).toBeCloseTo(0, 6);
  });
});

describe("texture coordinates", () => {
  const { mesh, front, back } = meshOf("crew-tee");

  it("lie within the picture of each flat", () => {
    for (const uv of [...mesh.front.uvs, ...mesh.back.uvs]) {
      expect(uv).toBeGreaterThanOrEqual(0);
      expect(uv).toBeLessThanOrEqual(1);
    }
  });

  it("put the centre of the hem at the same place in the picture as in the flat", () => {
    const hem = front.landmarks["hem-centre"] as { x: number; y: number };
    const box = silhouetteBox(back);
    const target = [0 - (box.minX + box.maxX) / 2, -(hem.y - (box.minY + box.maxY) / 2)].map((n) => n * METRES_PER_UNIT);
    const index = Array.from({ length: mesh.front.positions.length / 3 }, (_, i) => i).find(
      (i) => Math.abs((mesh.front.positions[i * 3] as number) - (target[0] as number)) < 1e-6 && Math.abs((mesh.front.positions[i * 3 + 1] as number) - (target[1] as number)) < 1e-6,
    );
    expect(index).toBeDefined();
    const u = mesh.front.uvs[(index as number) * 2] as number;
    const v = mesh.front.uvs[(index as number) * 2 + 1] as number;
    const b = front.bounds;
    expect(u).toBeCloseTo((hem.x - b.minX) / (b.maxX - b.minX), 6);
    expect(v).toBeCloseTo(1 - (hem.y - b.minY) / (b.maxY - b.minY), 6);
  });

  it("mirror the back, because the back flat is drawn as seen from behind", () => {
    const b = back.bounds;
    const i = mesh.back.positions.findIndex((_, k) => k % 3 === 0 && (mesh.back.positions[k] as number) === Math.max(...mesh.back.positions.filter((__, j) => j % 3 === 0)));
    const u = mesh.back.uvs[(i / 3) * 2] as number;
    // The rightmost point of the form, seen from the front, is at the left of the back flat.
    expect(u).toBeLessThan((0 - b.minX) / (b.maxX - b.minX));
  });
});

describe("buildGarmentMesh", () => {
  it("gives the same form every time and changes nothing it is given", () => {
    const front = draw("crew-tee", "front");
    const back = draw("crew-tee", "back");
    const before = JSON.stringify([front, back]);
    const first = buildGarmentMesh({ front: shapeSource(front), back: shapeSource(back) });
    expect(buildGarmentMesh({ front: shapeSource(front), back: shapeSource(back) })).toEqual(first);
    expect(JSON.stringify([front, back])).toBe(before);
  });

  it("keeps only what the form needs from the model", () => {
    const front = draw("crew-tee", "front");
    expect(Object.keys(shapeSource(front)).sort()).toEqual(["bounds", "outline"]);
  });

  it("refuses an outline that is not one closed loop", () => {
    const front = shapeSource(draw("crew-tee", "front"));
    expect(() => buildGarmentMesh({ front, back: { ...front, outline: { ...front.outline, silhouette: [] } } })).toThrow(/outline/);
  });
});
