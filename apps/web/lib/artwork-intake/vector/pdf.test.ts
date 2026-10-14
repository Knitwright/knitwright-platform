import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildPdf, SIMPLE_CONTENT, WITH_CLIP, WITH_IMAGE, WITH_JAVASCRIPT, WITH_SHADING, WITH_TEXT } from "../fixtures/pdfs";
import { intakeVector } from "./index";
import { ATTACHMENTS_DROPPED, FIRST_PAGE_ONLY, SCRIPTS_DROPPED, SPOT_COLOURS, TRANSPARENCY_FLATTENED } from "./pdf";
import { REFUSALS } from "./refuse";
import { TEXT_OMITTED } from "./svg";

const intake = (bytes: Uint8Array) => intakeVector(bytes, "pdf");

describe("a simple vector PDF", () => {
  it("becomes the restricted model, with the page flipped to y-down and sized in points", async () => {
    const result = await intake(buildPdf(SIMPLE_CONTENT));
    expect(result.doc).toMatchObject({ source: "pdf", viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(result.doc.naturalWidthMm).toBeCloseTo(70.556, 2);
    expect([result.widthPx, result.heightPx]).toEqual([267, 133]);
    const [first] = result.doc.nodes;
    // `10 10 50 30 re` is red, 10..60 across and 60..90 down from the top once flipped.
    expect(first).toMatchObject({ t: "path", fill: { kind: "colour", hex: "#ff0000" } });
    expect(first.t === "path" && first.cmds[0]).toEqual(["M", 10, 90]);
    expect(result.doc.nodes).toHaveLength(4);
  });

  it("draws the colours where the file puts them", async () => {
    const { preview } = await intake(buildPdf(SIMPLE_CONTENT));
    const { data, info } = await sharp(preview).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    const scale = info.width / 200;
    expect(at(Math.round(30 * scale), Math.round(75 * scale))).toEqual([255, 0, 0]);
    // The green square: 0..40 scaled by half and moved to (100,50): x 100..120, y from the top 30..50.
    expect(at(Math.round(110 * scale), Math.round(40 * scale))).toEqual([0, 255, 0]);
  });

  it("keeps a stroke's width and colour", async () => {
    const { doc } = await intake(buildPdf(SIMPLE_CONTENT));
    expect(doc.nodes[1]).toMatchObject({ t: "path", fill: null, stroke: { width: 3, paint: { kind: "colour", hex: "#0000ff" } } });
  });
});

describe("a PDF with something else in it", () => {
  it("drops a JavaScript action and says so; the drawing is read, the script is not kept", async () => {
    const result = await intake(WITH_JAVASCRIPT);
    expect(result.warnings).toContain(SCRIPTS_DROPPED);
    expect(result.doc.nodes.length).toBeGreaterThan(0);
    expect(result.json.toString("utf8")).not.toMatch(/JavaScript|app\.alert|OpenAction/);
  });

  it("leaves out text and says to outline it", async () => {
    const result = await intake(WITH_TEXT);
    expect(result.warnings).toContain(TEXT_OMITTED);
    expect(result.doc.textOmitted).toBe(true);
  });

  it("uses only the first page and says so", async () => {
    expect((await intake(buildPdf(SIMPLE_CONTENT, { pages: 2 }))).warnings).toContain(FIRST_PAGE_ONLY);
  });

  it("applies a clip path to what follows, and not to what comes after it is restored", async () => {
    const { doc } = await intake(WITH_CLIP);
    expect(doc.clips).toHaveLength(1);
    expect(doc.nodes).toHaveLength(2);
    expect(doc.nodes[0]).toMatchObject({ t: "g", clip: "c1" });
    expect(doc.nodes[1]).toMatchObject({ t: "path", fill: { hex: "#0000ff" } });
  });

  it("says when spot colours and transparency effects were not kept", async () => {
    const spot = buildPdf(SIMPLE_CONTENT, { resources: "/ColorSpace << /Cs1 [/Separation /Gold /DeviceRGB << /FunctionType 2 /Domain [0 1] /C0 [1 1 1] /C1 [1 0.8 0] /N 1 >>] >>" });
    expect((await intake(spot)).warnings).toContain(SPOT_COLOURS);
    const soft = buildPdf(`/G1 gs ${SIMPLE_CONTENT}`, { resources: "/ExtGState << /G1 << /BM /Multiply /ca 0.5 >> >>" });
    const result = await intake(soft);
    expect(result.warnings).toContain(TRANSPARENCY_FLATTENED);
    expect(result.doc.nodes[0]).toMatchObject({ fillOpacity: 0.5 });
  });

  it.each([
    ["a gradient", WITH_SHADING],
    ["a picture", WITH_IMAGE],
  ])("is refused, with what to do instead, when it holds %s", async (_name, file) => {
    await expect(intake(file)).rejects.toThrow(REFUSALS.pdfNeedsPixels);
  });

  it("is refused when it is not a PDF, is empty, or draws nothing", async () => {
    await expect(intake(new TextEncoder().encode("%PDF-1.4 but not really"))).rejects.toThrow(REFUSALS.notPdf);
    await expect(intake(buildPdf(""))).rejects.toThrow(REFUSALS.empty);
    await expect(intake(new Uint8Array(16 * 1024 * 1024))).rejects.toThrow(/too large/);
  });

  it("is refused when it needs a password", async () => {
    // A document whose trailer names an encryption dictionary that cannot be opened without a password.
    const encrypted = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n" +
        "4 0 obj<</Filter/Standard/V 1/R 2/O(01234567890123456789012345678901)/U(01234567890123456789012345678901)/P -4>>endobj\n" +
        "trailer<</Size 5/Root 1 0 R/Encrypt 4 0 R/ID[<00000000000000000000000000000000><00000000000000000000000000000000>]>>\n%%EOF",
    );
    await expect(intake(encrypted)).rejects.toThrow(/password|could not be read as a PDF/);
  });

  it("notes attached files when the file carries them", async () => {
    const withFile = buildPdf(SIMPLE_CONTENT, {
      catalog: "/Names << /EmbeddedFiles << /Names [(a.txt) 5 0 R] >> >>",
      extraObjects: ["<< /Type /Filespec /F (a.txt) /EF << /F 6 0 R >> >>", "<< /Type /EmbeddedFile /Length 3 >>\nstream\nabc\nendstream"],
    });
    expect((await intake(withFile)).warnings).toContain(ATTACHMENTS_DROPPED);
  });
});
