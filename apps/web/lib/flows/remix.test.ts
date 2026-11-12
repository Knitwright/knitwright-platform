import { describe, expect, it } from "vitest";
import { canvasOfTemplate } from "./fixtures/canvas";
import { planRemix, REMIX_DRAWN_LINE } from "./remix";

describe("Remix", () => {
  it("moves a generated board's remix count on and keeps every other setting", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const scene = graph.boards.find((one) => one.id === "line-up")!;

    const once = planRemix(scene);
    expect(once).toMatchObject({ ok: true, remix: 1 });
    if (!once.ok) return;
    expect(once.settings).toEqual({ ...scene.settings, remix: 1 });
    expect(planRemix({ ...scene, settings: once.settings })).toMatchObject({ ok: true, remix: 2 });
  });

  it("refuses a picture the platform drew", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const render = graph.boards.find((one) => one.id === "render-front")!;
    expect(planRemix(render)).toEqual({ ok: false, reason: REMIX_DRAWN_LINE, ruleId: "R-GAP-000" });
  });
});
