import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { PRESETS } from "./fixtures/canvas";
import { applyFlowTemplate, refundFlowSpend, setFlowRunBoard, spendFlowOutput, startFlowRun } from "./service";
import { contentsText } from "./zip";

/**
 * What happens when the database says no. Every write here goes through a function that checks the
 * person's role itself, so "no" is the normal answer to a viewer, to a canvas of another brand and
 * to a board that has been removed while a run was in flight.
 */

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const CANVAS = "33333333-3333-4333-8333-333333333333";
const RUN = "44444444-4444-4444-8444-444444444444";
const BOARD = "55555555-5555-4555-8555-555555555555";
const who = { brandId: BRAND, userId: USER };

const refused = { error: { message: "permission denied", code: "42501", hint: null } };

const failing = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "nothing was thrown";
  } catch (error) {
    return (error as Error).message;
  }
};

describe("when the database refuses a write", () => {
  it("says so rather than carrying on, for every one of the four writes", async () => {
    const { client } = fakeClient({
      start_flow_run: refused,
      set_flow_run_board: refused,
      credit_spend_output: refused,
      credit_refund_spend: refused,
    });

    expect(await failing(startFlowRun(client, who, { launchProjectId: CANVAS, scope: "all", fromBoardId: null, estimateCredits: 0, template: null }))).toBeTruthy();
    expect(
      await failing(
        setFlowRunBoard(client, who, {
          runId: RUN,
          boardId: BOARD,
          kind: "mockup",
          position: 1,
          status: "ready",
          credits: 0,
          refunded: 0,
          spendEntryId: null,
          assets: 1,
          format: "png",
          outputFileId: null,
          reason: null,
        }),
      ),
    ).toBeTruthy();
    expect(await failing(spendFlowOutput(client, { brandId: BRAND, userId: USER, designVersionHash: "hash", outputKey: BOARD }))).toBeTruthy();
    expect(await failing(refundFlowSpend(client, BRAND, RUN, "A flow board did not finish"))).toBeTruthy();
  });

  it("stops opening a pack as soon as a board is refused, rather than half-wiring a canvas", async () => {
    const { client, calls } = fakeClient({ save_launch_board: refused });

    expect(await failing(applyFlowTemplate(client, who, { launchProjectId: CANVAS, template: "sponsor-pack", designProjectId: null, designVersion: null, presets: PRESETS }))).toBeTruthy();
    expect(calls.filter((call) => call.name === "connect_launch_boards")).toEqual([]);
  });
});

describe("dropping a pack where it is asked for", () => {
  it("saves every board at the place the person dropped it", async () => {
    const { client, calls } = fakeClient({ save_launch_board: { data: BOARD }, connect_launch_boards: { data: RUN } });
    await applyFlowTemplate(client, who, {
      launchProjectId: CANVAS,
      template: "sponsor-pack",
      designProjectId: null,
      designVersion: null,
      presets: PRESETS,
      origin: { x: 2_000, y: 400 },
    });
    const first = calls[0]?.steps[0]?.[1][0] as Record<string, unknown>;

    expect([first["p_x"], first["p_y"]]).toEqual([2_000, 400]);
  });
});

describe("a contents list", () => {
  it("names each file after the output it holds, so a board that makes several is not one line", () => {
    const entry = { boardId: BOARD, name: "Front render", format: "png" as const, bytes: new Uint8Array([1]), label: null };
    const written = contentsText([
      { boardId: BOARD, path: "png/front-render.png", label: null, entry },
      { boardId: BOARD, path: "png/front-render-2.png", label: "AI-generated", entry },
    ]);

    expect(written).toContain("png/front-render.png\tFront render");
    expect(written).toContain("png/front-render-2.png\tFront render\tAI-generated");
  });
});
