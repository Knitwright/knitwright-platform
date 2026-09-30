import { describe, expect, it, vi } from "vitest";
import { CHART_IMPORT_LIMITS } from "./limits";
import { uploadChart } from "./upload";

const FILE_ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
const csv = (size = 20) => new File([new Uint8Array(size).fill(65)], "chart.csv", { type: "text/csv" });
const reply = (body: unknown, status = 200) => async () => Response.json(body, { status });

const grid = [{ line: 1, cells: ["Point", "S"] }];
const suggestion = { headerLine: 1, pointColumn: 0, sizeColumns: [1], toleranceColumn: null, units: "cm", unitsColumn: null, baseSize: "S" };

describe("uploadChart", () => {
  it("sends the file and gives back its id, its cells and the suggested mapping", async () => {
    const post = vi.fn(reply({ success: true, data: { fileId: FILE_ID, grid, suggestion } }));
    expect(await uploadChart(csv(), post)).toEqual({ ok: true, fileId: FILE_ID, grid, suggestion });
    expect((post.mock.calls[0] as unknown as [FormData])[0].get("file")).toBeInstanceOf(File);
  });

  it("does not send an empty file or one over the limit", async () => {
    const post = vi.fn(reply({}));
    expect(await uploadChart(csv(0), post)).toMatchObject({ ok: false, reason: expect.stringMatching(/empty/) });
    expect(await uploadChart(csv(CHART_IMPORT_LIMITS.maxBytes + 1), post)).toMatchObject({ ok: false, reason: expect.stringMatching(/KB/) });
    expect(post).not.toHaveBeenCalled();
  });

  it("passes on the server's own sentence", async () => {
    const post = reply({ success: false, error: { code: "invalid_input", message: "This is the old Excel format." } }, 400);
    expect(await uploadChart(csv(), post)).toEqual({ ok: false, reason: "This is the old Excel format." });
  });

  it("says plainly when the answer cannot be understood or nothing comes back", async () => {
    expect(await uploadChart(csv(), reply({ nonsense: true }))).toMatchObject({ ok: false, reason: expect.stringMatching(/did not work/) });
    const offline = async () => {
      throw new Error("offline");
    };
    expect(await uploadChart(csv(), offline)).toMatchObject({ ok: false, reason: expect.stringMatching(/reach the server/) });
  });
});
