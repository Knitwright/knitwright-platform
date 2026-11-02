import { describe, expect, it } from "vitest";
import { BOARD_KINDS } from "@/lib/launch";
import { capabilityFor, capabilityNotes, capabilityOf, EMPTY_REGISTRY, OPERATION_OF_KIND, OPERATIONS_USED } from "./capabilities";
import { canvasOfTemplate } from "./fixtures/canvas";
import { runFlow } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";

/**
 * Who makes each board's picture. A flow runs boards; it draws none of them, and it imports nothing
 * from another workstream's unmerged directory (plan v5, Lesson 9).
 */

describe("the capability registry", () => {
  it("names an operation, or none, for every board kind the platform has", () => {
    expect(Object.keys(OPERATION_OF_KIND).sort()).toEqual([...BOARD_KINDS].sort());
  });

  it("asks the files service only for the operations a flow board could need", () => {
    expect([...OPERATIONS_USED]).toEqual(["render_garment", "transfer_design"]);
  });

  it("says which kinds would cost money once a real adapter lands, and which are stubbed today", () => {
    const notes = capabilityNotes();

    expect(notes.filter((note) => note.paid).map((note) => note.kind)).toEqual(["mockup", "ai_image"]);
    expect(notes.every((note) => note.stubbed)).toBe(true);
    expect(notes.every((note) => note.ruleId === "R-GAP-000")).toBe(true);
  });

  it("says plainly in its own note that nothing is wired and nothing is charged", () => {
    expect(EMPTY_REGISTRY.note).toContain("deterministic stub");
    expect(EMPTY_REGISTRY.note).toContain("Nothing is charged and no model is called");
    expect(Object.keys(EMPTY_REGISTRY.byKind)).toEqual([]);
  });

  it("uses a registered capability where there is one, and the stub where there is not", async () => {
    const calls: string[] = [];
    const registry = {
      byKind: {
        mockup: {
          run: async (request: Parameters<ReturnType<typeof stubCapability>["run"]>[0]) => {
            calls.push(request.boardId);
            return { ok: false, reason: "The mockup renderer said no.", ruleId: "R-GAP-000" } as const;
          },
        },
      },
      note: "The mockup renderer is wired; everything else is a stub.",
    };

    expect(capabilityFor("mockup", registry)).toBe(registry.byKind.mockup);
    expect(capabilityFor("marketing", registry)).not.toBe(registry.byKind.mockup);

    const { graph } = canvasOfTemplate("sponsor-pack");
    const report = await runFlow(
      { capability: capabilityOf(registry), meter: stubMeter(), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );

    expect(calls).toEqual(["kit-render", "close-up"]);
    expect(report.lines.filter((line) => line.state === "failed").map((line) => line.boardId)).toEqual(["kit-render", "close-up"]);
    expect(report.lines.find((line) => line.boardId === "kit-render")?.reason).toBe("The mockup renderer said no.");
    expect(capabilityNotes(registry).find((note) => note.kind === "mockup")?.stubbed).toBe(false);
  });

  it("runs every board with the stub when no registry is given at all", async () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const report = await runFlow(
      { capability: capabilityOf(), meter: stubMeter(), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );

    expect(report.state).toBe("done");
    expect(report.assets).toBe(4);
  });
});
