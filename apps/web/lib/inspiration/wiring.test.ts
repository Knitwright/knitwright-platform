import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefineAction } from "@/lib/server/core/create-define-action";
import { makeDeps } from "@/lib/server/core/test-deps";
import { jersey } from "./fixtures/designs";
import { UNWIRED_ARTICLES, UNWIRED_INSPIRATION_PORTS, UNWIRED_LIBRARY, UNWIRED_MOOD, UNWIRED_SCREEN, type InspirationPorts } from "./ports";
import type { Board } from "./types";

/**
 * The production wiring (plan v6 D4, decision 0135). Every server action of the board builds it on the live ports,
 * and every suggestion is validated with the same live validation ports as the design's own save. Before this, the
 * actions passed no ports and the checker passed `UNWIRED_PORTS`, so production ran on the unit tests' stand-ins.
 */

const boardFor = vi.fn();
const livePorts = vi.fn();
const specInput = vi.fn();
const LIVE_VALIDATION = { catalogue: { live: true }, moderation: { live: true } };
const PROJECT = "11111111-1111-4111-8111-111111111111";
const EMPTY_BOARD: Board = { query: { tags: [], text: "", removed: [] }, sources: [], searchLinks: [], tookMs: 0 };

vi.mock("@/lib/server/define-action", async () => ({ defineAction: createDefineAction(makeDeps().deps) }));
vi.mock("@/lib/server/deps", () => ({ adminClient: () => ({ admin: true }), sessionClient: async () => ({ session: true }), productionDeps: {}, imageProvider: () => null }));
vi.mock("@/lib/config/env", () => ({ getEnv: () => ({ NEXT_PUBLIC_SITE_URL: "https://studio.example" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/projects/project-reads", () => ({ getProject: async () => ({ spec: jersey(), currentVersion: 3 }) }));
vi.mock("./store", () => ({ readMoodboard: async () => [], readSteer: async () => ({}), saveItem: vi.fn(), removeItem: vi.fn(), writeSteer: vi.fn() }));
vi.mock("@/lib/validation/live-ports", () => ({ livePorts: (...args: unknown[]) => livePorts(...args) }));
vi.mock("@/lib/validation/spec-input", () => ({ specInput: (...args: unknown[]) => specInput(...args), standardRegistry: () => ({}) }));
vi.mock("@/lib/validation/service", () => ({ loadFactoryProfile: async () => ({ id: "profile" }) }));
vi.mock("@/lib/validation/validate", () => ({ validateDesign: () => ({ findings: [] }) }));
vi.mock("./server", async (original) => ({ ...(await original<typeof import("./server")>()), boardFor: (...args: unknown[]) => boardFor(...args) }));

const portsOf = (call: unknown[] | undefined): InspirationPorts => (call?.[4] as { ports: InspirationPorts }).ports;

const expectLive = (ports: InspirationPorts): void => {
  expect(ports).not.toBe(UNWIRED_INSPIRATION_PORTS);
  expect(ports.articles).not.toBe(UNWIRED_ARTICLES);
  expect(ports.mood).not.toBe(UNWIRED_MOOD);
  expect(ports.library).not.toBe(UNWIRED_LIBRARY);
  expect(ports.screen).not.toBe(UNWIRED_SCREEN);
};

describe("the board's server actions", () => {
  beforeEach(() => {
    boardFor.mockReset();
    boardFor.mockResolvedValue(EMPTY_BOARD);
  });

  it("build the board on the live ports, never the unwired ones", async () => {
    const { inspirationBoardAction } = await import("./actions");
    const result = await inspirationBoardAction({ projectId: PROJECT, productLinks: [], withMoodImage: false });
    expect(result.success).toBe(true);
    expect(boardFor).toHaveBeenCalledTimes(1);
    expectLive(portsOf(boardFor.mock.calls[0]));
  });

  it("rebuild the board on the live ports before a save, so a card is only saved when the real board showed it", async () => {
    const { saveToMoodboardAction } = await import("./actions");
    const result = await saveToMoodboardAction({ projectId: PROJECT, productLinks: [], cardId: "knitwright-library:library:x" });
    expect(result.success).toBe(false);
    expect(boardFor).toHaveBeenCalledTimes(1);
    expectLive(portsOf(boardFor.mock.calls[0]));
  });
});

describe("the suggestion checker", () => {
  beforeEach(() => {
    livePorts.mockReset();
    livePorts.mockReturnValue(LIVE_VALIDATION);
    specInput.mockReset();
    specInput.mockResolvedValue({});
  });

  it("validates a suggestion with the live validation ports: the parameter ranges and the kept moderation results", async () => {
    const { designChecker } = await import("./server");
    await designChecker({} as never, "brand-1")(jersey());
    expect(livePorts).toHaveBeenCalledWith({ admin: true });
    expect(specInput).toHaveBeenCalledWith(expect.anything(), "brand-1", LIVE_VALIDATION);
  });
});
