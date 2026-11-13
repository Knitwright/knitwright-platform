import { describe, expect, it } from "vitest";
import { fileIdsOf, mediaPool, poolFromHandOffs, RENDER_ITEM, stillInPool } from "./media";

const DESIGN = "11111111-1111-4111-8111-111111111111";
const FILE_A = "22222222-2222-4222-8222-222222222222";
const FILE_B = "33333333-3333-4333-8333-333333333333";

const payload = (designProjectId: string | null, media: unknown[]) => ({ kind: "launch-listing", designProjectId, media });

describe("the mockup library's pool", () => {
  it("takes each picture handed over for this design once, with its AI label, and leaves clips and other designs out", () => {
    const pool = poolFromHandOffs(
      [
        payload(DESIGN, [{ fileId: FILE_A, name: "Flat lay", role: "image", label: null }, { fileId: FILE_B, name: "Pitch", role: "image", label: "AI-generated" }, { fileId: FILE_B, name: "Again", role: "image", label: null }]),
        payload(DESIGN, [{ fileId: "44444444-4444-4444-8444-444444444444", name: "Walk-out", role: "video", label: "AI-generated" }, { nonsense: true }]),
        payload("55555555-5555-4555-8555-555555555555", [{ fileId: FILE_A, name: "Other", role: "image", label: null }]),
        "not a payload",
      ],
      DESIGN,
    );
    expect(pool).toEqual([
      { id: `flow-${FILE_A}`, source: "flow", ref: FILE_A, label: "Flat lay", aiLabel: null },
      { id: `flow-${FILE_B}`, source: "flow", ref: FILE_B, label: "Pitch", aiLabel: "AI-generated" },
    ]);
    expect(poolFromHandOffs([payload(DESIGN, [{ fileId: FILE_A, name: "", role: "image", label: null }])], DESIGN)[0]!.label).toBe("Mockup");
  });

  it("puts the render first, keeps a selection to what the pool holds, and names the files to link", () => {
    const flow = { id: `flow-${FILE_A}`, source: "flow" as const, ref: FILE_A, label: "Flat lay", aiLabel: null };
    expect(mediaPool([flow], true)).toEqual([RENDER_ITEM, flow]);
    expect(mediaPool([flow], false)).toEqual([flow]);
    expect(stillInPool([flow, { ...flow, id: "gone" }], [RENDER_ITEM, flow])).toEqual([flow]);
    expect(fileIdsOf([RENDER_ITEM, flow])).toEqual([FILE_A]);
  });
});
