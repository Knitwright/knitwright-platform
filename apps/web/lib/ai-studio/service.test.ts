import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const calls: string[] = [];
let next = 0;

vi.mock("@/lib/launch/service", () => ({
  createLaunchProject: vi.fn(async () => "launch-1"),
  saveBoard: vi.fn(async (_admin: unknown, _who: unknown, input: { kind: string; settings: Record<string, unknown>; inputVersion: number | null }) => {
    calls.push(`board:${input.kind}:${input.inputVersion ?? "-"}:${JSON.stringify(input.settings).slice(0, 40)}`);
    next += 1;
    return `board-${next}`;
  }),
  connectBoards: vi.fn(async (_admin: unknown, _who: unknown, input: { fromBoardId: string; toBoardId: string; inputIndex: number }) => {
    calls.push(`link:${input.fromBoardId}->${input.toBoardId}#${input.inputIndex}`);
    return "edge";
  }),
}));

vi.mock("@/lib/flows/service", () => ({
  applyFlowTemplate: vi.fn(async (_admin: unknown, _who: unknown, input: { template: string; designVersion: number | null }) => {
    calls.push(`template:${input.template}:${input.designVersion}`);
    return { boardIds: {}, plan: { assets: 0 } };
  }),
}));

const { startCanvas } = await import("./service");

const admin = {} as SupabaseClient;
const who = { brandId: "b", userId: "u" };
const SIZE = { width: 1080, height: 1080 };

describe("startCanvas", () => {
  beforeEach(() => {
    calls.length = 0;
    next = 0;
  });

  it("lays a flow template out with the design and its version", async () => {
    const id = await startCanvas(admin, who, { name: "x", designProjectId: "p", designVersion: 3, plan: { template: "colourway-set" }, presets: [] });
    expect(id).toBe("launch-1");
    expect(calls).toEqual(["template:colourway-set:3"]);
  });

  it("saves every board, the Design board with the design and its version, then every connector", async () => {
    const plan = {
      boards: [
        { key: "design", kind: "design" as const, name: "Design", size: SIZE, settings: {}, feeds: [] },
        { key: "hanger", kind: "mockup" as const, name: "Hanger", size: SIZE, settings: { scene: "hanger" }, feeds: ["design"] },
        { key: "post", kind: "marketing" as const, name: "Post", size: SIZE, settings: {}, feeds: ["hanger"] },
      ],
    };
    await startCanvas(admin, who, { name: "x", designProjectId: "p", designVersion: 2, plan, presets: [] });
    expect(calls[0]).toBe('board:design:2:{"designProjectId":"p"}');
    expect(calls[1]).toContain("board:mockup:-");
    expect(calls.slice(3)).toEqual(["link:board-1->board-2#1", "link:board-2->board-3#1"]);
  });
});
