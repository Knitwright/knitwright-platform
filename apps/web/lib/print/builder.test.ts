import { describe, expect, it } from "vitest";
import { printFileSpecSchema, printScale, type PrintFileSpec } from "@/lib/production/contract";
import { currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { createPrintFileBuilder, envForSpec, viewOfPieceId } from "./builder";
import { makeEnv } from "./fixtures/env";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, namesAndNumbers: MARKS }));
const spec = (over: Partial<PrintFileSpec> = {}): PrintFileSpec =>
  printFileSpecSchema.parse({
    pieceId: "back",
    size: "50",
    format: "pdf",
    bleedMm: 15,
    scaleX: 1,
    scaleY: 1,
    dpi: 150,
    profile: { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" },
    ...over,
  });

describe("print file builder for releases", () => {
  it("builds a file for a spec, the same bytes twice, with the hash it reports", async () => {
    const builder = createPrintFileBuilder({ env: await makeEnv(stack) });
    const [a, b] = [await builder.build(spec()), await builder.build(spec())];
    expect(a.sha256).toBe(b.sha256);
    expect(a.bytes.length).toBeGreaterThan(1000);
    expect(a.pageWidthMm).toBeGreaterThan(300);
    expect(Buffer.from(a.bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  });
  it("takes the print parameters from the spec: bleed and scale change the page", async () => {
    const builder = createPrintFileBuilder({ env: await makeEnv(stack) });
    const plain = await builder.build(spec());
    const scaled = await builder.build(spec({ bleedMm: 20, scaleX: 1.0152, scaleY: 1.0204 }));
    expect(scaled.pageWidthMm).toBeGreaterThan(plain.pageWidthMm);
    expect(scaled.sha256).not.toBe(plain.sha256);
    const shrink = printScale({ shrinkLengthPct: { value: 2, source: "fabric-test", testId: "t" }, shrinkWidthPct: { value: 1.5, source: "fabric-test", testId: "t" } });
    expect(shrink.length).toBeCloseTo(1.0204, 4);
  });
  it("puts a player's name from the roster on a file that names the number", async () => {
    const builder = createPrintFileBuilder({ env: await makeEnv(stack), roster: [{ name: "OKAFOR", number: "7", sizeLabel: "M" }] });
    const [withPlayer, without] = [await builder.build(spec({ playerNumber: "7" })), await builder.build(spec())];
    expect(withPlayer.sha256).not.toBe(without.sha256);
  });
  it("asks which side of a pair, and refuses a piece the pattern lacks", async () => {
    const env = await makeEnv(stack);
    expect(viewOfPieceId(env, "back", "48")).toBe("back");
    expect(viewOfPieceId(env, "collar", "48")).toBe("collar");
    expect(() => viewOfPieceId(env, "sleeve", "48")).toThrow(/cut as a pair/);
    expect(() => viewOfPieceId(env, "pocket", "48")).toThrow(/no piece called pocket/);
    const builder = createPrintFileBuilder({ env });
    await expect(builder.build(spec({ size: "99" }))).rejects.toThrow(/no (piece|back)/i);
  });
  it("lays the spec over the environment without changing the environment", async () => {
    const env = await makeEnv(stack);
    const next = envForSpec(env, spec({ scaleX: 1.01, scaleY: 1.02, bleedMm: 10 }));
    expect(next.scale).toMatchObject({ length: 1.02, width: 1.01 });
    expect(next.settings.bleedMm).toBe(10);
    expect(env.settings.bleedMm).toBe(15);
  });
});
