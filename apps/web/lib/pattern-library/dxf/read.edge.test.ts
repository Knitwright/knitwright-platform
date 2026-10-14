import { describe, expect, it } from "vitest";
import { pieceIdFromName, readDxf } from "./read";

type Item = readonly [number, string | number];
const flat = (items: readonly Item[]): string => items.flatMap(([c, v]) => [String(c), String(v)]).join("\n");

const text = (layer: string, value: string): Item[] => [[0, "TEXT"], [8, layer], [10, 0], [20, 0], [40, 0], [1, value], [7, "STANDARD"]];
const textAt = (layer: string, x: number, y: number, value: string): Item[] => [[0, "TEXT"], [8, layer], [10, x], [20, y], [40, 0], [1, value]];
const poly = (layer: string, points: readonly (readonly [number, number])[], closed = true): Item[] => [
  [0, "POLYLINE"], [8, layer], [66, 1], [70, closed ? 1 : 0],
  ...points.flatMap(([x, y]): Item[] => [[0, "VERTEX"], [8, layer], [10, x], [20, y]]),
  [0, "SEQEND"], [8, layer],
];
const point = (layer: string, x: number, y: number): Item[] => [[0, "POINT"], [8, layer], [10, x], [20, y]];
const line = (layer: string, a: [number, number], b: [number, number]): Item[] => [[0, "LINE"], [8, layer], [10, a[0]], [20, a[1]], [11, b[0]], [21, b[1]]];

const SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100]] as const;

const block = (name: string, body: Item[]): Item[] => [[0, "BLOCK"], [8, "1"], [2, name], [70, 64], [10, 0], [20, 0], ...body, [0, "ENDBLK"], [8, "1"]];

const file = (blocks: Item[], opts: { header?: Item[]; entities?: Item[] } = {}): string =>
  flat([[0, "SECTION"], [2, "HEADER"], ...(opts.header ?? []), [0, "ENDSEC"], [0, "SECTION"], [2, "BLOCKS"], ...blocks, [0, "ENDSEC"], [0, "SECTION"], [2, "ENTITIES"], ...(opts.entities ?? []), [0, "ENDSEC"], [0, "EOF"]]);

const simple = (extra: Item[] = [], name = "pocket_M"): Item[] => block(name, [...text("1", "PIECE NAME: pocket"), ...poly("1", SQUARE), ...extra]);

describe("pieceIdFromName", () => {
  it("drops the words that only describe the cut, and keeps a name made only of them", () => {
    expect(pieceIdFromName("torso front")).toBe("front");
    expect(pieceIdFromName("sleeve full right")).toBe("sleeve");
    expect(pieceIdFromName("Full Left")).toBe("full-left");
    expect(pieceIdFromName("!!!")).toBe("piece");
  });
});

describe("units", () => {
  it.each([["1", 25.4], ["5", 10], ["6", 1000], ["4", 1]])("reads $INSUNITS %s", (code, factor) => {
    const out = readDxf(file(simple(), { header: [[9, "$INSUNITS"], [70, code]] }));
    expect(out.pieces[0].cutOutline[1][0]).toBeCloseTo(100 * factor, 1);
  });

  it("refuses units it does not know, reads UNITS: ENGLISH as inches and METRIC as millimetres", () => {
    expect(() => readDxf(file(simple(), { header: [[9, "$INSUNITS"], [70, 9]] }))).toThrow("not ones the library reads");
    expect(readDxf(file(simple(), { entities: text("1", "UNITS: ENGLISH") })).pieces[0].cutOutline[1][0]).toBeCloseTo(2540, 1);
    expect(readDxf(file(simple(), { entities: text("1", "UNITS: METRIC") })).warnings).toEqual([]);
  });

  it("warns when the file states no units", () => {
    expect(readDxf(file(simple())).warnings).toContain("The file does not state its units, so they were read as millimetres.");
    expect(readDxf(file(simple(), { header: [[9, "$INSUNITS"], [70, 0]] })).warnings).toHaveLength(1);
  });
});

describe("what a piece says about itself", () => {
  const read = (extra: Item[], name?: string) => readDxf(file(simple([...extra, ...text("1", "UNITS: METRIC")], name)));

  it("takes its size from SIZE, else from the block name, else from the file's sample size", () => {
    expect(read([...text("1", "SIZE: L")]).pieces[0].sizeLabel).toBe("L");
    expect(read([]).pieces[0].sizeLabel).toBe("M");
    const noSuffix = readDxf(file([...block("pocket", [...text("1", "PIECE NAME: pocket"), ...poly("1", SQUARE)])], { entities: [...text("1", "SAMPLE SIZE: 46"), ...text("1", "UNITS: METRIC")] }));
    expect(noSuffix.pieces[0].sizeLabel).toBe("46");
    const none = readDxf(file(block("pocket", [...poly("1", SQUARE)]), { entities: text("1", "UNITS: METRIC") }));
    expect(none.pieces).toEqual([]);
    expect(none.warnings).toContain('"pocket" does not say which size it is, so it was left out.');
  });

  it("reads the quantity: cut and mirrored, a single number, nothing, and an odd mirrored count", () => {
    expect(read(text("1", "QUANTITY: 1,1")).pieces[0]).toMatchObject({ quantity: 2, mirroredPair: true });
    expect(read(text("1", "QUANTITY: 2,0")).pieces[0]).toMatchObject({ quantity: 2, mirroredPair: false });
    expect(read(text("1", "QUANTITY: 3")).pieces[0]).toMatchObject({ quantity: 3, mirroredPair: false });
    expect(read(text("1", "QUANTITY: x,y")).pieces[0]).toMatchObject({ quantity: 1, mirroredPair: false });
    const odd = read(text("1", "QUANTITY: 2,1"));
    expect(odd.pieces[0]).toMatchObject({ quantity: 3, mirroredPair: false });
    expect(odd.warnings).toContain("A piece says it is cut mirrored but in an odd number; it was read as not mirrored.");
  });

  it("warns when a piece is not marked CUT, and about layers it does not use", () => {
    const out = read([...text("1", "ANNOTATION: STITCH"), ...point("9", 0, 0), ...point("9", 1, 1), ...point("10", 2, 2)]);
    expect(out.warnings).toContain('"pocket" is marked "STITCH" rather than CUT.');
    expect(out.warnings).toContain('"pocket": layer 9 holds 2 items this library does not use. They were left out.');
    expect(out.warnings).toContain('"pocket": layer 10 holds 1 item this library does not use. They were left out.');
  });

  it("leaves out a piece with no cut line, and a piece that is not a valid piece, and says so", () => {
    const none = readDxf(file(block("a_M", text("1", "PIECE NAME: a")), { entities: text("1", "UNITS: METRIC") }));
    expect(none.warnings).toEqual(expect.arrayContaining(['"a" has no cut line on layer 1, so it was left out.', "No pieces were found in the file."]));
    const invalid = read(text("1", "QUANTITY: 30,0"));
    expect(invalid.pieces).toEqual([]);
    expect(invalid.warnings.some((w) => w.startsWith('"pocket" could not be read as a pattern piece'))).toBe(true);
  });

  it("keeps two pieces of one name and size apart", () => {
    const two = readDxf(file([...simple(text("1", "SIZE: M"), "pocket_a"), ...simple(text("1", "SIZE: M"), "pocket_b")], { entities: text("1", "UNITS: METRIC") }));
    expect(two.pieces.map((p) => p.id)).toEqual(["pocket", "pocket-2"]);
  });
});

describe("the lines of a piece", () => {
  const read = (extra: Item[]) => readDxf(file(simple([...extra, ...text("1", "UNITS: METRIC")]))).pieces[0];

  it("reads a sew line as proof the cut line holds allowance, unless the piece says otherwise", () => {
    const sew = poly("14", [[10, 10], [90, 10], [90, 90], [10, 90]]);
    expect(read(sew)).toMatchObject({ outlineKind: "with-seam-allowance", sewLine: [[10, 10], [90, 10], [90, 90], [10, 90]] });
    expect(read([...sew, ...text("1", "OUTLINE: without-seam-allowance")]).outlineKind).toBe("without-seam-allowance");
    expect(read(text("1", "OUTLINE: nonsense")).outlineKind).toBe("unknown");
  });

  it("reads the fold, the grain (layer 7, else 5), internal lines and seam allowances", () => {
    const piece = read([...line("6", [0, 0], [100, 0]), ...line("5", [10, 50], [90, 50]), ...poly("8", [[50, 0], [50, 100]], false), ...line("8", [0, 50], [100, 50]),
      ...text("1", "SEAM ALLOWANCE: side-seam 6.00 knitwright-default"), ...text("1", "SEAM ALLOWANCE: hem 10.00 odd"), ...text("1", "SEAM ALLOWANCE: neck not-stated"), ...text("1", "SEAM ALLOWANCE: bad x"), ...text("1", "SEAM ALLOWANCE:")]);
    expect(piece.onFold).toBe(true);
    expect(piece.foldLine).toEqual({ from: [0, 0], to: [100, 0] });
    expect(piece.grainLine).toEqual({ from: [10, 50], to: [90, 50] });
    expect(piece.internalLines).toEqual([[[50, 0], [50, 100]], [[0, 50], [100, 50]]]);
    expect(piece.seamAllowance).toEqual([
      { seamId: "side-seam", mm: 6, source: "knitwright-default" },
      { seamId: "hem", mm: 10, source: "pattern-file" },
      { seamId: "neck", mm: null, source: "not-stated" },
    ]);
  });

  it("reads a line with no position as no line", () => {
    expect(read([[0, "LINE"], [8, "7"]]).grainLine).toBeNull();
  });
});

describe("landmarks and notches written into a file", () => {
  const read = (extra: Item[]) => readDxf(file(simple([...extra, ...text("1", "UNITS: METRIC")]))).pieces[0];

  it("take landmarks from LANDMARK lines, ignoring unknown names and bad numbers", () => {
    const piece = read([...text("2", "LANDMARK: hps 10 20"), ...text("2", "LANDMARK: nope 1 1"), ...text("2", "LANDMARK: underarm x y")]);
    expect(piece.landmarks).toEqual({ hps: [10, 20] });
  });

  it("read a notch with its seam and count, merge close unlabelled points, and give the seam they lie on", () => {
    const labelled = [...point("4", 50, 0), ...textAt("4", 50, 0, "NOTCH: shoulder 2")];
    expect(read(labelled).notches).toEqual([{ seamId: "shoulder", at: [50, 0], count: 2 }]);
    const loose = read([...point("4", 50, 0), ...point("4", 51, 0), ...point("4", 80, 0)]);
    expect(loose.notches).toEqual([{ seamId: "unassigned", at: [50, 0], count: 2 }, { seamId: "unassigned", at: [80, 0], count: 1 }]);
  });
});
