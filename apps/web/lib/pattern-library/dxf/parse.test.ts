import { describe, expect, it } from "vitest";
import { DxfSyntaxError, MAX_DXF_BYTES, parseDxf } from "./parse";

const pairs = (...items: (string | number)[]): string => items.join("\n");

const minimal = pairs(
  0, "SECTION", 2, "HEADER", 9, "$INSUNITS", 70, 4, 9, "$INSUNITS", 70, 5, 0, "ENDSEC",
  0, "SECTION", 2, "BLOCKS", 0, "BLOCK", 8, 1, 2, "piece_M", 0, "POLYLINE", 8, 1, 70, 1, 0, "VERTEX", 8, 1, 10, 0, 20, 0, 0, "VERTEX", 8, 1, 10, 5, 20, 0, 0, "SEQEND", 8, 1, 0, "ENDBLK", 0, "ENDSEC",
  0, "SECTION", 2, "ENTITIES", 0, "TEXT", 8, 1, 1, "STYLE NAME: x", 0, "ENDSEC", 0, "EOF",
);

describe("parseDxf", () => {
  it("reads the header, the blocks with their polylines and the entities", () => {
    const doc = parseDxf(minimal);
    expect(doc.header).toEqual({ $INSUNITS: "4" });
    expect(doc.blocks.map((b) => b.name)).toEqual(["piece_M"]);
    expect(doc.blocks[0].entities[0]).toMatchObject({ type: "POLYLINE", layer: "1", vertices: [[0, 0], [5, 0]] });
    expect(doc.entities[0]).toMatchObject({ type: "TEXT", layer: "1" });
  });

  it("reads a file written with Windows line endings", () => {
    expect(parseDxf(minimal.replaceAll("\n", "\r\n")).blocks).toHaveLength(1);
  });

  it("keeps a polyline whose SEQEND is missing, and gives an entity with no layer the layer 0", () => {
    const doc = parseDxf(pairs(0, "SECTION", 2, "ENTITIES", 0, "POLYLINE", 8, 3, 0, "VERTEX", 10, 1, 20, 2, 0, "POINT", 10, 1, 20, 1, 0, "ENDSEC"));
    expect(doc.entities[0]).toMatchObject({ type: "POLYLINE", layer: "3", vertices: [[1, 2]] });
    expect(doc.entities[1].layer).toBe("0");
  });

  it("refuses text that is not a DXF, a bad group code, a vertex without a position and a file too large", () => {
    expect(() => parseDxf("hello")).toThrow(DxfSyntaxError);
    expect(() => parseDxf(pairs("x", "SECTION"))).toThrow("should hold a group code");
    expect(() => parseDxf(pairs(0, "SECTION", 2, "ENTITIES", 0, "POLYLINE", 0, "VERTEX", 8, 1, 0, "ENDSEC"))).toThrow("no usable position");
    expect(() => parseDxf("0".repeat(MAX_DXF_BYTES + 1))).toThrow("too large");
  });

  it("ignores an ENDBLK with no BLOCK and a block with no name", () => {
    const doc = parseDxf(pairs(0, "SECTION", 2, "BLOCKS", 0, "ENDBLK", 0, "BLOCK", 0, "TEXT", 1, "a", 0, "ENDBLK", 0, "ENDSEC"));
    expect(doc.blocks).toEqual([{ name: "", entities: [expect.objectContaining({ type: "TEXT" })] }]);
  });
});
